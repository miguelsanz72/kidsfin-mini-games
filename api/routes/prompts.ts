import express from 'express';
import { optimizePromptWithAnthropic, isAnthropicConfigured } from '../services/anthropic.js';
import { DatabaseService } from '../database.js';

const router = express.Router();

// POST /api/prompts/optimize - Optimizar un prompt usando OpenAI
router.post('/optimize', async (req, res) => {
    try {
        const { prompt, targetStyle, duration } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'El prompt es requerido' });
        }
        
        // Optimizar prompt con OpenAI
        const optimizationResult = await optimizePromptWithAnthropic({
            originalPrompt: prompt,
            targetStyle: targetStyle || 'cinematic',
            duration: duration || 10
        });
        
        // Guardar en base de datos
        const dbResult = await DatabaseService.createPrompt({
            original_prompt: prompt,
            optimized_prompt: optimizationResult.optimizedPrompt,
            improvements: JSON.stringify(optimizationResult.improvements),
            confidence_score: optimizationResult.confidence,
            target_style: targetStyle || 'cinematic',
            duration: duration || 10
        });
        
        const savedPrompt = await DatabaseService.getPromptById(dbResult.lastInsertRowid as number);
        
        res.json({
            id: savedPrompt?.id,
            originalPrompt: savedPrompt?.original_prompt,
            optimizedPrompt: savedPrompt?.optimized_prompt,
            improvements: savedPrompt?.improvements ? JSON.parse(savedPrompt.improvements) : [],
            confidence: savedPrompt?.confidence_score,
            targetStyle: savedPrompt?.target_style,
            duration: savedPrompt?.duration,
            createdAt: savedPrompt?.created_at,
            anthropicConfigured: isAnthropicConfigured()
        });
    } catch (error) {
        console.error('Error optimizando prompt:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * GET /api/prompts
 * Obtiene todos los prompts
 */
router.get('/', async (req, res) => {
    try {
        const prompts = await DatabaseService.getAllPrompts();
        
        // Parsear los JSON strings
        const formattedPrompts = prompts.map(prompt => ({
            ...prompt,
            improvements: prompt.improvements ? JSON.parse(prompt.improvements) : []
        }));
        
        res.json({
            prompts: formattedPrompts,
            total: formattedPrompts.length
        });
        
    } catch (error) {
        console.error('Error obteniendo prompts:', error);
        res.status(500).json({
            error: 'Error al obtener los prompts'
        });
    }
});

/**
 * GET /api/prompts/:id
 * Obtiene un prompt específico por ID
 */
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({
                error: 'ID debe ser un número válido'
            });
        }
        
        const prompt = await DatabaseService.getPromptById(id);
        
        if (!prompt) {
            return res.status(404).json({
                error: 'Prompt no encontrado'
            });
        }
        
        // Parsear el JSON string
        const formattedPrompt = {
            ...prompt,
            improvements: prompt.improvements ? JSON.parse(prompt.improvements) : []
        };
        
        res.json(formattedPrompt);
        
    } catch (error) {
        console.error('Error obteniendo prompt:', error);
        res.status(500).json({
            error: 'Error al obtener el prompt'
        });
    }
});

export default router;