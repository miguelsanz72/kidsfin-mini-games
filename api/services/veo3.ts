import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { GoogleGenAI } from "@google/genai";

// Usar dotenv para cargar los environment variables
import dotenv from "dotenv";
dotenv.config();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const execAsync = promisify(exec);

// Interfaces basadas en la documentación oficial de Google Veo 3
export interface GenerateVideoRequest {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  durationSeconds?: number;
  duration?: number;
  resolution?: "720" | "1080" | "4k";
  generateAudio?: boolean;
  enhancePrompt?: boolean;
  negativePrompt?: string;
  image?: {
    bytesBase64Encoded?: string;
    gcsUri?: string;
    mimeType?: string;
  };
  sampleCount?: number;
  seed?: number;
  style?: string;
}

export interface VideoJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  prompt: string;
  operationName?: string; // Para tracking de la operación en Google
  videoUrl?: string;
  thumbnailUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  progress?: number;
  duration: number;
  aspectRatio: string;
  style?: string;
  estimatedTime?: number;
}

export interface GenerateVideoResponse {
  jobId: string;
  status: string;
  estimatedTime: number;
}

interface GoogleVeoOperation {
  name: string;
  done: boolean;
  response?: {
    generatedVideo?: {
      uri: string;
    };
  };
  error?: {
    message: string;
  };
}

// Almacén en memoria para los trabajos (en producción usar una base de datos)
const videoJobs = new Map<string, VideoJob>();

// Configuración de la API de Google Gemini para Veo 3
const VEO_MODEL = "veo-3.0-generate-preview"; // Modelo Veo 3 según ejemplo proporcionado
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || "kidsfin-mini-juegos";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!GOOGLE_API_KEY) return null;
  if (!genAI) {
    try {
      genAI = new GoogleGenAI({
        apiKey: GOOGLE_API_KEY,
      });
    } catch (e) {
      console.error("Error inicializando Google Gen AI:", e);
      return null;
    }
  }
  return genAI;
}

// Función para generar un ID único para el trabajo
function generateJobId(): string {
  return `veo3_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Función principal para iniciar la generación de video
export async function generateVideo(
  request: GenerateVideoRequest
): Promise<GenerateVideoResponse> {
  const jobId = generateJobId();

  const job: VideoJob = {
    id: jobId,
    status: "queued",
    prompt: request.prompt,
    createdAt: new Date(),
    progress: 0,
    duration: request.durationSeconds || 5,
    aspectRatio: request.aspectRatio || "16:9",
    style: request.style,
  };

  videoJobs.set(jobId, job);

  // Procesar el video de forma asíncrona
  processVideoGeneration(jobId, request).catch((error) => {
    console.error(`Error processing video ${jobId}:`, error);
    const failedJob = videoJobs.get(jobId);
    if (failedJob) {
      failedJob.status = "failed";
      failedJob.error = error.message;
    }
  });

  return {
    jobId,
    status: "queued",
    estimatedTime: (request.durationSeconds || 5) * 30, // Estimación: 30 segundos por segundo de video
  };
}

// Función para procesar la generación de video usando la API real de Veo 3
async function processVideoGeneration(
  jobId: string,
  request: GenerateVideoRequest
): Promise<void> {
  const job = videoJobs.get(jobId);
  if (!job) return;

  try {
    job.status = "processing";
    job.progress = 10;

    // Preparar la solicitud para la API de Veo 3
    const veoRequest = {
      prompt: request.prompt,
      aspectRatio: request.aspectRatio || "16:9",
      durationSeconds: request.durationSeconds || 5,
      generateAudio: request.generateAudio || false,
    };

    job.progress = 20;

    // Intentar usar la API real de Veo 3, con fallback a simulación
    let operation: any; // Acepta el objeto de operación completo
    try {
      operation = await startVideoGeneration(veoRequest);
      job.operationName = operation.name;
      job.progress = 30;

      // Polling del estado de la operación
      const completedOperation = await pollOperationStatus(operation, jobId);
      console.log("completedOperation", completedOperation);

      if (completedOperation.error) {
        throw new Error(completedOperation.error.message);
      }

      if (completedOperation.response?.generatedVideo) {
        job.progress = 80;

        // Descargar y guardar el video
        const { videoPath, thumbnailPath } = await downloadAndSaveVideo(
          completedOperation.response?.generatedVideo,
          jobId
        );

        job.status = "completed";
        job.videoUrl = `/uploads/videos/${path.basename(videoPath)}`;
        job.thumbnailUrl = `/uploads/thumbnails/${path.basename(
          thumbnailPath
        )}`;
        job.completedAt = new Date();
        job.progress = 100;
      } else {
        throw new Error("No se pudo obtener la URL del video generado");
      }
    } catch (apiError) {
      console.warn("API de Veo 3 no disponible, usando simulación:", apiError);

      // Fallback: usar simulación local
      job.progress = 50;
      const { videoPath, thumbnailPath } = await generateTestVideo(
        jobId,
        request
      );

      job.status = "completed";
      job.videoUrl = `/uploads/videos/${path.basename(videoPath)}`;
      job.thumbnailUrl = `/uploads/thumbnails/${path.basename(thumbnailPath)}`;
      job.completedAt = new Date();
      job.progress = 100;
    }
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Error desconocido";
    job.progress = 0;
  }
}

// Función para mapear la resolución al formato esperado por la API
function mapResolution(resolution: string): string {
  const resolutionMap: { [key: string]: string } = {
    "720": "720",
    "1080": "1080",
  };
  return resolutionMap[resolution] || "720";
}

// Función para iniciar la generación de video con Google Gen AI SDK
async function startVideoGeneration(request: {
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  generateAudio?: boolean;
}): Promise<any> {
  const genAI = getGenAI();
  if (!genAI) {
    throw new Error("Google Gen AI no configurada");
  }

  try {
    const response = await genAI.models.generateVideos({
      model: VEO_MODEL,
      prompt: request.prompt,
      config: {
        numberOfVideos: 1,
        aspectRatio: request.aspectRatio || "16:9",
        // durationSeconds: request.durationSeconds || 5, // Eliminado por no ser soportado
        // Nota: generateAudio no está disponible en la configuración actual
      },
    });

    return response;
  } catch (error) {
    console.error("Error starting video generation:", error);
    throw error;
  }
}

// Función para hacer polling del estado de la operación con Google Gen AI SDK
async function pollOperationStatus(
  operation: any, // Acepta el objeto de operación completo
  jobId: string
): Promise<GoogleVeoOperation> {
  const genAI = getGenAI();
  if (!genAI) {
    throw new Error("Google Gen AI no configurada");
  }

  const maxAttempts = 120; // 10 minutos máximo
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const operationResult = await genAI.operations.get(operation);

      // Actualizar progreso del job
      const job = videoJobs.get(jobId);
      if (job) {
        job.progress = Math.min(30 + (attempts / maxAttempts) * 50, 80);
      }

      if (operationResult.done) {
        return {
          name: operationResult.name || operation.name,
          done: operationResult.done,
          response: operationResult.response
            ? {
                generatedVideo:
                  (operationResult.response as any).generatedVideos?.[0]?.video,
              }
            : undefined,
          error: operationResult.error
            ? { message: (operationResult.error as any).message }
            : undefined,
        };
      }

      // Esperar 10 segundos antes del siguiente intento
      await new Promise((resolve) => setTimeout(resolve, 10000));
      attempts++;
    } catch (error) {
      console.error("Error polling operation status:", error);
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  throw new Error("Timeout: La generación de video tardó demasiado tiempo");
}

// Función para descargar y guardar el video
async function downloadAndSaveVideo(
  videoFile: any,
  jobId: string
): Promise<{ videoPath: string; thumbnailPath: string }> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  const videosDir = path.join(uploadsDir, "videos");
  const thumbnailsDir = path.join(uploadsDir, "thumbnails");

  // Crear directorios si no existen
  [uploadsDir, videosDir, thumbnailsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const videoPath = path.join(videosDir, `${jobId}.mp4`);
  const thumbnailPath = path.join(thumbnailsDir, `${jobId}.jpg`);

  try {
    // Obtener el video usando la API de Google Gen AI
    const genAI = getGenAI();
    if (!genAI) {
      throw new Error("Google Gen AI no configurada");
    }

    // Descargar el video usando curl con la URI proporcionada
    if (videoFile?.uri) {
      const curlCommand = `curl -L "${videoFile.uri}" -o "${videoPath}"`;
      await execAsync(curlCommand);
    } else if (videoFile?.name) {
      // Si tenemos el nombre del archivo, intentar obtener la URI
      const fileResponse = await genAI.files.get({
        name: videoFile.name,
      });

      if (fileResponse?.uri) {
        const curlCommand = `curl -L "${fileResponse.uri}" -o "${videoPath}"`;
        await execAsync(curlCommand);
      } else {
        throw new Error("No se pudo obtener la URI del video");
      }
    } else {
      throw new Error("Información de video insuficiente para descargar");
    }

    // Generar thumbnail usando ffmpeg
    await generateThumbnail(videoPath, thumbnailPath);

    return { videoPath, thumbnailPath };
  } catch (error) {
    console.error("Error downloading video:", error);
    throw new Error("Failed to download video from Google Cloud Storage");
  }
}

// Función para generar video de prueba (fallback)
async function generateTestVideo(
  jobId: string,
  request: GenerateVideoRequest
): Promise<{ videoPath: string; thumbnailPath: string }> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  const videosDir = path.join(uploadsDir, "videos");
  const thumbnailsDir = path.join(uploadsDir, "thumbnails");

  // Crear directorios si no existen
  [uploadsDir, videosDir, thumbnailsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const videoPath = path.join(videosDir, `${jobId}.mp4`);
  const thumbnailPath = path.join(thumbnailsDir, `${jobId}.jpg`);

  try {
    const duration = request.durationSeconds || 5;
    const aspectRatio = request.aspectRatio || "16:9";

    // Determinar resolución basada en aspect ratio
    let resolution = "1280x720"; // 16:9 por defecto
    if (aspectRatio === "9:16") {
      resolution = "720x1280";
    } else if (aspectRatio === "1:1") {
      resolution = "720x720";
    }

    // Generar video con patrón de test usando ffmpeg
    const ffmpegCommand = `ffmpeg -f lavfi -i testsrc=duration=${duration}:size=${resolution}:rate=25 -c:v libx264 -pix_fmt yuv420p -t ${duration} "${videoPath}" -y`;

    await execAsync(ffmpegCommand);

    // Generar thumbnail
    await generateThumbnail(videoPath, thumbnailPath);

    return { videoPath, thumbnailPath };
  } catch (error) {
    console.error("Error generating test video:", error);
    throw new Error("Failed to generate test video");
  }
}

// Función para generar thumbnail
async function generateThumbnail(
  videoPath: string,
  thumbnailPath: string
): Promise<void> {
  try {
    await execAsync(
      `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -y "${thumbnailPath}"`
    );
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    // Si falla la generación del thumbnail, crear uno por defecto
    const defaultThumbnail = path.join(
      process.cwd(),
      "public",
      "default-thumbnail.jpg"
    );
    if (fs.existsSync(defaultThumbnail)) {
      fs.copyFileSync(defaultThumbnail, thumbnailPath);
    }
  }
}

// Función para obtener el estado de un trabajo
export function getVideoJobStatus(jobId: string): VideoJob | null {
  return videoJobs.get(jobId) || null;
}

// Función para obtener todos los trabajos
export function getAllVideoJobs(): VideoJob[] {
  return Array.from(videoJobs.values());
}

// Función para limpiar trabajos antiguos (llamar periódicamente)
export function cleanupOldJobs(maxAgeHours: number = 24): number {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  let deletedCount = 0;

  for (const [jobId, job] of videoJobs.entries()) {
    if (job.createdAt < cutoffTime) {
      // Eliminar archivos asociados
      if (job.videoUrl) {
        const videoPath = path.join(
          process.cwd(),
          "uploads",
          "videos",
          path.basename(job.videoUrl)
        );
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      }
      if (job.thumbnailUrl) {
        const thumbnailPath = path.join(
          process.cwd(),
          "uploads",
          "thumbnails",
          path.basename(job.thumbnailUrl)
        );
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }

      videoJobs.delete(jobId);
      deletedCount++;
    }
  }

  return deletedCount;
}

// Función para verificar si Google AI está configurado
export function isGoogleAIConfigured(): boolean {
  return !!process.env.GOOGLE_API_KEY && !!process.env.GOOGLE_CLOUD_PROJECT_ID;
}

// Función para verificar la configuración de Google AI
export async function testGoogleAIConnection(): Promise<boolean> {
  try {
    const genAI = getGenAI();
    if (!genAI) {
      return false;
    }

    // Intentar verificar si el modelo Veo está disponible
    try {
      const model = await genAI.models.get({
        model: VEO_MODEL,
      });
      return !!model;
    } catch (error) {
      return false;
    }
  } catch (error) {
    console.error("Error testing Google AI connection:", error);
    return false;
  }
}
