import express from 'express';
import { generateVideo, getVideoJobStatus, getAllVideoJobs, isGoogleAIConfigured } from '../services/veo3.js';
import { DatabaseService } from '../database.js';

const router = express.Router();

// POST /api/videos/generate - Iniciar generación de video
router.post('/generate', async (req, res) => {
    try {
        const { prompt, promptId, duration, aspectRatio, style } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'El prompt es requerido' });
        }
        
        // Generar video con Veo 3
        const videoResult = await generateVideo({
            prompt,
            duration: duration || 10,
            aspectRatio: aspectRatio || '16:9',
            style: style || 'cinematic'
        });
        
        // Guardar en base de datos
        const dbResult = await DatabaseService.createVideo({
            prompt_id: promptId || null,
            veo_job_id: videoResult.jobId,
            status: 'queued',
            duration_seconds: duration || 10,
            metadata: JSON.stringify({
                aspectRatio: aspectRatio || '16:9',
                style: style || 'cinematic',
                originalPrompt: prompt
            })
        });
        
        res.json({
            id: dbResult.lastInsertRowid,
            jobId: videoResult.jobId,
            status: videoResult.status,
            estimatedTime: videoResult.estimatedTime,
            prompt,
            duration: duration || 10,
            aspectRatio: aspectRatio || '16:9',
            style: style || 'cinematic',
            googleAIConfigured: isGoogleAIConfigured()
        });
    } catch (error) {
        console.error('Error iniciando generación de video:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/videos/status/:jobId - Verificar estado de un trabajo
router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        if (!jobId) {
            return res.status(400).json({ error: 'Job ID es requerido' });
        }
        
        // Obtener estado del servicio Veo 3
        const jobStatus = getVideoJobStatus(jobId);
        
        if (!jobStatus) {
            return res.status(404).json({ error: 'Trabajo no encontrado' });
        }
        
        // Actualizar base de datos si el estado cambió
        const dbVideo = await DatabaseService.getVideoByJobId(jobId);
        if (dbVideo && dbVideo.status !== jobStatus.status) {
            await DatabaseService.updateVideoStatus(
                jobId,
                jobStatus.status as any,
                jobStatus.videoUrl,
                jobStatus.completedAt?.toISOString()
            );
        }
        
        res.json({
            jobId: jobStatus.id,
            status: jobStatus.status,
            progress: jobStatus.progress || 0,
            videoUrl: jobStatus.videoUrl,
            thumbnailUrl: jobStatus.thumbnailUrl,
            error: jobStatus.error,
            createdAt: jobStatus.createdAt,
            completedAt: jobStatus.completedAt,
            estimatedTimeRemaining: jobStatus.status === 'processing' ? 
                Math.max(0, (jobStatus.duration * 30) - ((Date.now() - jobStatus.createdAt.getTime()) / 1000)) : 0
        });
    } catch (error) {
        console.error('Error verificando estado del video:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/videos/library - Obtener biblioteca de videos
router.get('/library', async (req, res) => {
    try {
        const { status, limit = 20, offset = 0 } = req.query;
        
        let videos;
        if (status && typeof status === 'string') {
            videos = await DatabaseService.getVideosByStatus(status as any);
        } else {
            videos = await DatabaseService.getAllVideos();
        }
        
        // Aplicar paginación
        const limitNum = parseInt(limit as string);
        const offsetNum = parseInt(offset as string);
        const paginatedVideos = videos.slice(offsetNum, offsetNum + limitNum);
        
        // Enriquecer con información de estado en tiempo real
        const enrichedVideos = paginatedVideos.map(video => {
            const jobStatus = getVideoJobStatus(video.veo_job_id);
            const metadata = video.metadata ? JSON.parse(video.metadata) : {};
            
            return {
                id: video.id,
                jobId: video.veo_job_id,
                status: jobStatus?.status || video.status,
                prompt: metadata.originalPrompt || 'Prompt no disponible',
                videoUrl: jobStatus?.videoUrl || video.video_url,
                thumbnailUrl: jobStatus?.thumbnailUrl || video.thumbnail_url,
                duration: video.duration_seconds,
                aspectRatio: metadata.aspectRatio,
                style: metadata.style,
                progress: jobStatus?.progress || (video.status === 'completed' ? 100 : 0),
                createdAt: video.created_at,
                completedAt: video.completed_at || jobStatus?.completedAt,
                error: jobStatus?.error
            };
        });
        
        res.json({
            videos: enrichedVideos,
            total: videos.length,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < videos.length
        });
    } catch (error) {
        console.error('Error obteniendo biblioteca de videos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/videos/:id - Obtener video específico
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const videoId = parseInt(id);
        
        if (isNaN(videoId)) {
            return res.status(400).json({ error: 'ID de video inválido' });
        }
        
        const video = await DatabaseService.getVideoById(videoId);
        
        if (!video) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }
        
        // Obtener estado en tiempo real del trabajo
        const jobStatus = getVideoJobStatus(video.veo_job_id);
        const metadata = video.metadata ? JSON.parse(video.metadata) : {};
        
        const enrichedVideo = {
            id: video.id,
            jobId: video.veo_job_id,
            status: jobStatus?.status || video.status,
            prompt: metadata.originalPrompt || 'Prompt no disponible',
            optimizedPrompt: metadata.optimizedPrompt,
            videoUrl: jobStatus?.videoUrl || video.video_url,
            thumbnailUrl: jobStatus?.thumbnailUrl || video.thumbnail_url,
            duration: video.duration_seconds,
            aspectRatio: metadata.aspectRatio,
            style: metadata.style,
            progress: jobStatus?.progress || (video.status === 'completed' ? 100 : 0),
            createdAt: video.created_at,
            completedAt: video.completed_at || jobStatus?.completedAt,
            error: jobStatus?.error,
            metadata: metadata
        };
        
        res.json(enrichedVideo);
    } catch (error) {
        console.error('Error obteniendo video:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/videos/test-config - Verificar configuración de Google AI
router.get('/test-config', async (req, res) => {
    try {
        const isConfigured = isGoogleAIConfigured();
        const config: any = {
            googleAIConfigured: isConfigured,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            location: process.env.GOOGLE_CLOUD_LOCATION,
            apiKeySet: !!process.env.GOOGLE_API_KEY,
            timestamp: new Date().toISOString()
        };
        
        if (isConfigured) {
            try {
                const testResult = await import('../services/veo3.js').then(module => 
                    module.testGoogleAIConnection()
                );
                config.connectionTest = testResult;
            } catch (error: any) {
                config.connectionTest = false;
                config.error = error.message;
            }
        }
        
        res.json(config);
    } catch (error) {
        console.error('Error verificando configuración:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Definición del tipo Video para la base de datos
interface Video {
  id: number;
  prompt_id: number | null;
  veo_job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  duration_seconds: number;
  video_url: string | null;
  thumbnail_url: string | null;
  metadata: string | null;
  created_at: string;
  completed_at: string | null;
}

// Función auxiliar para calcular progreso basado en estado
function getProgressFromStatus(status: string): number {
    switch (status) {
        case 'queued': return 0;
        case 'processing': return 50;
        case 'completed': return 100;
        case 'failed': return 0;
        default: return 0;
    }
}

export default router;