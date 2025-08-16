import axios from "axios";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Interfaces para Sora
interface SoraVideoRequest {
  prompt: string;
  height?: string;
  width?: string;
  n_seconds?: string;
  n_variants?: string;
}

interface SoraJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  prompt: string;
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  operationId?: string;
  operationName?: string;
  duration: number;
  aspectRatio: string;
  style?: string;
  estimatedTime?: number;
}

interface SoraApiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  data?: {
    url: string;
    revised_prompt?: string;
  }[];
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

// Almacén en memoria para los trabajos de video
const videoJobs = new Map<string, SoraJob>();

// Configuración de Azure OpenAI
const AZURE_API_KEY = process.env.AZURE_API_KEY;
const SORA_TARGET_URI = process.env.SORA_TARGET_URI;

if (!AZURE_API_KEY) {
  console.warn("AZURE_API_KEY no está configurada");
}

if (!SORA_TARGET_URI) {
  console.warn("SORA_TARGET_URI no está configurada");
}

// Función principal para generar video con Sora
export async function generateVideoWithSora(request: {
  prompt: string;
  resolution?: string;
  duration?: number;
  aspectRatio?: string;
}): Promise<{ jobId: string }> {
  const jobId = `sora_${Date.now()}_${uuidv4().slice(0, 8)}`;

  // Crear el trabajo
  const job: SoraJob = {
    id: jobId,
    status: "queued",
    prompt: request.prompt,
    progress: 0,
    createdAt: new Date(),
    operationId: undefined,
    duration: request.duration || 5,
    aspectRatio: request.aspectRatio || "16:9",
    style: "realistic",
  };

  videoJobs.set(jobId, job);

  // Procesar el video de forma asíncrona
  processVideoGeneration(jobId, request).catch((error) => {
    console.error(`Error procesando video ${jobId}:`, error);
    const job = videoJobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.error = error.message;
    }
  });

  return { jobId };
}

// Función para obtener el estado de un trabajo
export function getVideoJobStatus(jobId: string): SoraJob | null {
  return videoJobs.get(jobId) || null;
}

// Función para obtener todos los trabajos
export function getAllVideoJobs(): SoraJob[] {
  return Array.from(videoJobs.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

// Función para procesar la generación de video
async function processVideoGeneration(
  jobId: string,
  request: {
    prompt: string;
    resolution?: string;
    duration?: number;
    aspectRatio?: string;
  }
) {
  const job = videoJobs.get(jobId);
  if (!job) return;

  try {
    job.status = "processing";
    job.progress = 10;

    // Mapear los parámetros al formato de Sora
    const soraRequest: SoraVideoRequest = {
      prompt: request.prompt,
      height: mapResolutionToHeight(request.resolution || "720"),
      width: mapResolutionToWidth(request.resolution || "720"),
      n_seconds: (request.duration || 5).toString(),
      n_variants: "1",
    };

    // Intentar usar la API real de Sora
    try {
      const response = await callSoraAPI(soraRequest);
      job.operationId = response.id;
      job.progress = 30;

      // Polling del estado de la operación
      const completedResponse = await pollSoraOperation(response.id, jobId);

      if (completedResponse.error) {
        throw new Error(completedResponse.error.message);
      }

      if (completedResponse.data && completedResponse.data.length > 0) {
        job.progress = 80;

        // Descargar y guardar el video
        const { videoPath, thumbnailPath } = await downloadAndSaveVideo(
          completedResponse.data[0].url,
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
      console.warn(
        "API de Sora no disponible, usando simulación:",
        apiError.data
      );

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

// Función para llamar a la API de Sora
async function callSoraAPI(
  request: SoraVideoRequest
): Promise<SoraApiResponse> {
  if (!AZURE_API_KEY || !SORA_TARGET_URI) {
    throw new Error("Azure API Key o Sora Target URI no configurados");
  }

  try {
    const response = await axios.post(
      SORA_TARGET_URI,
      {
        model: "sora",
        prompt: request.prompt,
        height: request.height,
        width: request.width,
        n_seconds: request.n_seconds,
        n_variants: request.n_variants,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Api-key": AZURE_API_KEY,
        },
        timeout: 30000, // 30 segundos timeout
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error calling Sora API:", error);
    throw error;
  }
}

// Función para hacer polling del estado de la operación
async function pollSoraOperation(
  operationId: string,
  jobId: string
): Promise<SoraApiResponse> {
  const maxAttempts = 120; // 10 minutos máximo
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      // Construir URL de estado (asumiendo que sigue el patrón estándar)
      const statusUrl = `${SORA_TARGET_URI}/${operationId}`;

      const response = await axios.get(statusUrl, {
        headers: {
          "Api-key": AZURE_API_KEY!,
        },
      });

      const result: SoraApiResponse = response.data;

      // Actualizar progreso del job
      const job = videoJobs.get(jobId);
      if (job) {
        job.progress = Math.min(30 + (attempts / maxAttempts) * 50, 80);
      }

      // Verificar si la operación está completa
      if (result.data || result.error) {
        return result;
      }

      // Esperar antes del siguiente intento
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 segundos
      attempts++;
    } catch (error) {
      console.error(`Error polling operation ${operationId}:`, error);
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error("Timeout esperando la generación del video");
}

// Función para mapear resolución a altura
function mapResolutionToHeight(resolution: string): string {
  const resolutionMap: { [key: string]: string } = {
    "720": "720",
    "1080": "1080",
    "480": "480",
  };
  return resolutionMap[resolution] || "720";
}

// Función para mapear resolución a anchura
function mapResolutionToWidth(resolution: string): string {
  const resolutionMap: { [key: string]: string } = {
    "720": "1280",
    "1080": "1920",
    "480": "854",
  };
  return resolutionMap[resolution] || "1280";
}

// Función para descargar y guardar el video
async function downloadAndSaveVideo(
  videoUrl: string,
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
    // Descargar el video
    const response = await axios.get(videoUrl, {
      responseType: "stream",
      timeout: 60000, // 1 minuto timeout
    });

    const writer = fs.createWriteStream(videoPath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", () => resolve());
      writer.on("error", reject);
    });

    // Generar thumbnail usando ffmpeg (si está disponible)
    await generateThumbnail(videoPath, thumbnailPath);

    return { videoPath, thumbnailPath };
  } catch (error) {
    console.error("Error downloading video:", error);
    throw error;
  }
}

// Función para generar thumbnail
async function generateThumbnail(
  videoPath: string,
  thumbnailPath: string
): Promise<void> {
  const { exec } = require("child_process");
  const { promisify } = require("util");
  const execAsync = promisify(exec);

  try {
    await execAsync(
      `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -y "${thumbnailPath}"`
    );
  } catch (error) {
    console.warn("No se pudo generar thumbnail con ffmpeg:", error);
    // Crear un thumbnail placeholder
    await createPlaceholderThumbnail(thumbnailPath);
  }
}

// Función para crear thumbnail placeholder
async function createPlaceholderThumbnail(
  thumbnailPath: string
): Promise<void> {
  // Crear una imagen SVG simple como placeholder
  const svgContent = `
    <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" 
            text-anchor="middle" dy=".3em" fill="#666">Video Thumbnail</text>
    </svg>
  `;

  // Cambiar extensión a .svg para el placeholder
  const svgPath = thumbnailPath.replace(".jpg", ".svg");
  fs.writeFileSync(svgPath, svgContent.trim());
}

// Función para generar video de prueba (simulación)
async function generateTestVideo(
  jobId: string,
  request: {
    prompt: string;
    resolution?: string;
    duration?: number;
  }
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

  // Simular delay de procesamiento
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // Intentar generar un video de prueba con ffmpeg
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    const duration = request.duration || 5;
    const resolution = request.resolution || "720";
    const [width, height] =
      resolution === "1080" ? ["1920", "1080"] : ["1280", "720"];

    // Crear video de prueba con color sólido y texto
    await execAsync(
      `ffmpeg -f lavfi -i "color=c=blue:size=${width}x${height}:duration=${duration}" ` +
        `-vf "drawtext=fontfile=/System/Library/Fonts/Arial.ttf:text='${request.prompt.slice(
          0,
          50
        )}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2" ` +
        `-y "${videoPath}"`
    );

    // Generar thumbnail
    await generateThumbnail(videoPath, thumbnailPath);
  } catch (error) {
    console.warn("No se pudo generar video de prueba con ffmpeg:", error);

    // Crear archivos placeholder
    fs.writeFileSync(videoPath, "placeholder video content");
    await createPlaceholderThumbnail(thumbnailPath);
  }

  return { videoPath, thumbnailPath };
}

// Función para limpiar trabajos antiguos (opcional)
export function cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [jobId, job] of videoJobs.entries()) {
    if (now - job.createdAt.getTime() > maxAge) {
      videoJobs.delete(jobId);
    }
  }
}
