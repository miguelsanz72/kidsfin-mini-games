import Anthropic from '@anthropic-ai/sdk';

// Configuración de Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface OptimizePromptRequest {
    originalPrompt: string;
    targetStyle?: string;
    duration?: number;
}

export interface OptimizePromptResponse {
    optimizedPrompt: string;
    improvements: string[];
    confidence: number;
}

/**
 * Optimiza un prompt para generar mejores videos con Veo 3
 */
export async function optimizePromptWithAnthropic(request: OptimizePromptRequest): Promise<OptimizePromptResponse> {
    try {
        const { originalPrompt, targetStyle = 'cinematic', duration = 10 } = request;
        
        const systemPrompt = `Eres un experto en optimización de prompts para generación de videos con IA, específicamente para Veo 3.

Tu tarea es mejorar prompts para crear videos de alta calidad. Considera estos aspectos:

1. **Claridad visual**: Describe elementos visuales específicos y detallados
2. **Movimiento**: Incluye descripciones de movimiento de cámara y acción
3. **Iluminación**: Especifica el tipo de iluminación y atmósfera
4. **Estilo**: Adapta el prompt al estilo solicitado (${targetStyle})
5. **Duración**: Optimiza para videos de ${duration} segundos
6. **Composición**: Describe encuadres y composición visual
7. **Calidad técnica**: Incluye términos que mejoren la calidad técnica

Devuelve tu respuesta en formato JSON con:
- optimizedPrompt: El prompt mejorado
- improvements: Array de mejoras aplicadas
- confidence: Nivel de confianza (0-1) en la optimización`;
        
        const userPrompt = `Prompt original: "${originalPrompt}"
Estilo objetivo: ${targetStyle}
Duración: ${duration} segundos

Optimiza este prompt para Veo 3.`;
        
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            temperature: 0.7,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt }
            ]
        });
        
        const response = message.content[0]?.type === 'text' ? message.content[0].text : null;
        
        if (!response) {
            throw new Error('No se recibió respuesta de Anthropic');
        }
        
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(response);
        } catch (error) {
            console.error('Error parsing Anthropic response:', error);
            throw new Error('Respuesta inválida de Anthropic');
        }
        
        // Validar la respuesta
        if (!parsedResponse.optimizedPrompt || !Array.isArray(parsedResponse.improvements)) {
            throw new Error('Formato de respuesta inválido de Anthropic');
        }
        
        return {
            optimizedPrompt: parsedResponse.optimizedPrompt,
            improvements: parsedResponse.improvements,
            confidence: Math.min(Math.max(parsedResponse.confidence || 0.8, 0), 1)
        };
        
    } catch (error) {
        console.error('Error optimizando prompt con Anthropic:', error);
        
        // Fallback: optimización básica sin Anthropic
        return createFallbackOptimization(request);
    }
}

/**
 * Optimización de fallback cuando OpenAI no está disponible
 */
function createFallbackOptimization(request: OptimizePromptRequest): OptimizePromptResponse {
    const { originalPrompt, targetStyle = 'cinematic', duration = 10 } = request;
    
    let optimizedPrompt = originalPrompt;
    const improvements: string[] = [];
    
    // Agregar estilo si no está presente
    if (!originalPrompt.toLowerCase().includes(targetStyle.toLowerCase())) {
        optimizedPrompt += `, filmado en estilo ${targetStyle}`;
        improvements.push(`Agregado estilo ${targetStyle}`);
    }
    
    // Agregar detalles de calidad técnica
    if (!originalPrompt.toLowerCase().includes('alta calidad') && 
        !originalPrompt.toLowerCase().includes('4k') && 
        !originalPrompt.toLowerCase().includes('hd')) {
        optimizedPrompt += ', alta calidad, 4K';
        improvements.push('Agregada especificación de calidad técnica');
    }
    
    // Agregar movimiento de cámara si no está presente
    if (!originalPrompt.toLowerCase().includes('cámara') && 
        !originalPrompt.toLowerCase().includes('movimiento')) {
        optimizedPrompt += ', con movimientos suaves de cámara';
        improvements.push('Agregado movimiento de cámara');
    }
    
    // Agregar duración contextual
    if (duration > 10) {
        optimizedPrompt += ', secuencia extendida con múltiples tomas';
        improvements.push('Optimizado para duración extendida');
    }
    
    return {
        optimizedPrompt,
        improvements,
        confidence: 0.6 // Menor confianza para fallback
    };
}

/**
 * Verifica si Anthropic está configurado correctamente
 */
export function isAnthropicConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Prueba la conexión con Anthropic
 */
export async function testAnthropicConnection(): Promise<boolean> {
    try {
        if (!isAnthropicConfigured()) {
            return false;
        }
        
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Test' }]
        });
        
        return !!message.content[0];
    } catch (error) {
        console.error('Error testing Anthropic connection:', error);
        return false;
    }
}