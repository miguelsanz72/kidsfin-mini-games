import fs from 'fs';
import path from 'path';

// Database configuration using JSON files for simplicity
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PROMPTS_FILE = path.join(DATA_DIR, 'prompts.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory data storage
let prompts: Prompt[] = [];
let videos: Video[] = [];
let nextPromptId = 1;
let nextVideoId = 1;

/**
 * Insert sample data
 */
function insertSampleData(): void {
    const samplePrompts: Prompt[] = [
        {
            id: 1,
            original_prompt: 'Un gato jugando en el jardín',
            optimized_prompt: 'Un adorable gato doméstico de pelaje atigrado jugando alegremente en un exuberante jardín lleno de flores coloridas, con luz natural suave y cálida que crea una atmósfera mágica y serena',
            improvements: '["Añadida descripción específica del gato", "Mejorada la descripción del entorno", "Añadida información de iluminación"]',
            confidence_score: 0.92,
            target_style: 'cinematic',
            duration: 10,
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            original_prompt: 'Paisaje de montaña',
            optimized_prompt: 'Majestuoso paisaje montañoso con picos nevados que se elevan hacia un cielo azul cristalino, praderas verdes en primer plano salpicadas de flores silvestres, y una cascada que desciende graciosamente por las rocas, capturado durante la hora dorada',
            improvements: '["Añadidos detalles específicos de los picos", "Mejorada la descripción del primer plano", "Añadido elemento de cascada", "Especificada la hora del día"]',
            confidence_score: 0.89,
            target_style: 'landscape',
            duration: 15,
            created_at: new Date().toISOString()
        }
    ];
    
    prompts.push(...samplePrompts);
    nextPromptId = 3;
    saveData();
}

/**
 * Save data to JSON files
 */
function saveData(): void {
    try {
        fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2));
        fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videos, null, 2));
    } catch (error) {
        console.error('❌ Error guardando datos:', error);
    }
}

/**
 * Initialize the database and load existing data
 */
export async function initializeDatabase(): Promise<void> {
    try {
        // Load existing data
        if (fs.existsSync(PROMPTS_FILE)) {
            const promptsData = fs.readFileSync(PROMPTS_FILE, 'utf8');
            prompts = JSON.parse(promptsData);
            nextPromptId = Math.max(...prompts.map(p => p.id || 0), 0) + 1;
        }
        
        if (fs.existsSync(VIDEOS_FILE)) {
            const videosData = fs.readFileSync(VIDEOS_FILE, 'utf8');
            videos = JSON.parse(videosData);
            nextVideoId = Math.max(...videos.map(v => v.id || 0), 0) + 1;
        }
        
        // Insert sample data if empty
        if (prompts.length === 0) {
            insertSampleData();
        }
        
        console.log('✅ Base de datos JSON inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la base de datos:', error);
        throw error;
    }
}

// Interfaces TypeScript para los modelos
export interface Prompt {
    id: number;
    original_prompt: string;
    optimized_prompt: string;
    improvements?: string; // JSON string
    confidence_score: number;
    target_style: string;
    duration: number;
    created_at: string;
}

export interface Video {
    id: number;
    prompt_id?: number;
    veo_job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    video_url?: string;
    thumbnail_url?: string;
    duration_seconds: number;
    metadata?: string; // JSON string
    created_at: string;
    completed_at?: string;
}

export interface CreatePromptData {
    original_prompt: string;
    optimized_prompt: string;
    improvements?: string;
    confidence_score?: number;
    target_style?: string;
    duration?: number;
}

export interface CreateVideoData {
    prompt_id?: number;
    veo_job_id: string;
    status?: Video['status'];
    duration_seconds?: number;
    metadata?: string;
}

// Funciones de acceso a datos
export class DatabaseService {
    // Prompts
    static async createPrompt(data: CreatePromptData): Promise<{ lastInsertRowid: number }> {
        const newPrompt: Prompt = {
            id: nextPromptId++,
            original_prompt: data.original_prompt,
            optimized_prompt: data.optimized_prompt,
            improvements: data.improvements || null,
            confidence_score: data.confidence_score || 0.8,
            target_style: data.target_style || 'cinematic',
            duration: data.duration || 10,
            created_at: new Date().toISOString()
        };
        
        prompts.push(newPrompt);
        saveData();
        
        return { lastInsertRowid: newPrompt.id };
    }
    
    static async getPromptById(id: number): Promise<Prompt | null> {
        return prompts.find(p => p.id === id) || null;
    }
    
    static async getAllPrompts(): Promise<Prompt[]> {
        return [...prompts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    // Videos
    static async createVideo(data: CreateVideoData): Promise<{ lastInsertRowid: number }> {
        const newVideo: Video = {
            id: nextVideoId++,
            prompt_id: data.prompt_id || null,
            veo_job_id: data.veo_job_id,
            status: data.status || 'queued',
            video_url: null,
            thumbnail_url: null,
            duration_seconds: data.duration_seconds || 10,
            metadata: data.metadata || null,
            created_at: new Date().toISOString(),
            completed_at: null
        };
        
        videos.push(newVideo);
        saveData();
        
        return { lastInsertRowid: newVideo.id };
    }
    
    static async getVideoById(id: number): Promise<Video | null> {
        return videos.find(v => v.id === id) || null;
    }
    
    static async getVideoByJobId(jobId: string): Promise<Video | null> {
        return videos.find(v => v.veo_job_id === jobId) || null;
    }
    
    static async updateVideoStatus(jobId: string, status: Video['status'], videoUrl?: string, thumbnailUrl?: string): Promise<void> {
        const video = videos.find(v => v.veo_job_id === jobId);
        if (video) {
            video.status = status;
            if (videoUrl) video.video_url = videoUrl;
            if (thumbnailUrl) video.thumbnail_url = thumbnailUrl;
            if (status === 'completed') {
                video.completed_at = new Date().toISOString();
            }
            saveData();
        }
    }
    
    static async getAllVideos(): Promise<Video[]> {
        return [...videos].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    static async getVideosByStatus(status: Video['status']): Promise<Video[]> {
        return videos.filter(v => v.status === status).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
}