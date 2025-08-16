import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Wand2, Save, Play, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PromptData {
  originalPrompt: string;
  optimizedPrompt?: string;
  aspectRatio: string;
  style: string;
  duration: number;
  provider: string;
}

const Editor: React.FC = () => {
  const navigate = useNavigate();
  const [promptData, setPromptData] = useState<PromptData>({
    originalPrompt: '',
    aspectRatio: '16:9',
    style: 'realistic',
    duration: 10,
    provider: 'veo3'
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const aspectRatios = [
    { value: '16:9', label: '16:9 (Horizontal)' },
    { value: '9:16', label: '9:16 (Vertical)' },
    { value: '1:1', label: '1:1 (Cuadrado)' }
  ];

  const styles = [
    { value: 'realistic', label: 'Realista' },
    { value: 'cinematic', label: 'Cinematográfico' },
    { value: 'animated', label: 'Animado' },
    { value: 'artistic', label: 'Artístico' },
    { value: 'documentary', label: 'Documental' }
  ];

  const durations = [
    { value: 5, label: '5 segundos' },
    { value: 10, label: '10 segundos' },
    { value: 15, label: '15 segundos' },
    { value: 30, label: '30 segundos' }
  ];

  const providers = [
    { value: 'veo3', label: 'Google Veo 3' },
    { value: 'sora', label: 'OpenAI Sora' }
  ];

  const handleOptimizePrompt = async () => {
    if (!promptData.originalPrompt.trim()) {
      toast.error('Por favor, ingresa un prompt para optimizar');
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await fetch('/api/prompts/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptData.originalPrompt,
          aspectRatio: promptData.aspectRatio,
          style: promptData.style,
          duration: promptData.duration
        })
      });

      if (!response.ok) {
        throw new Error('Error al optimizar el prompt');
      }

      const data = await response.json();
      setPromptData(prev => ({
        ...prev,
        optimizedPrompt: data.optimizedPrompt
      }));
      toast.success('Prompt optimizado exitosamente');
    } catch (error) {
      console.error('Error optimizando prompt:', error);
      toast.error('Error al optimizar el prompt');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateVideo = async () => {
    const promptToUse = promptData.optimizedPrompt || promptData.originalPrompt;
    
    if (!promptToUse.trim()) {
      toast.error('Por favor, ingresa un prompt para generar el video');
      return;
    }

    setIsGenerating(true);
    try {
      const endpoint = promptData.provider === 'sora' ? '/api/videos/generate-sora' : '/api/videos/generate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptToUse,
          aspectRatio: promptData.aspectRatio,
          style: promptData.style,
          duration: promptData.duration,
          resolution: '720',
          originalPrompt: promptData.originalPrompt,
          optimizedPrompt: promptData.optimizedPrompt
        })
      });

      if (!response.ok) {
        throw new Error('Error al generar el video');
      }

      const data = await response.json();
      toast.success('Video en proceso de generación');
      navigate(`/generator?jobId=${data.jobId}`);
    } catch (error) {
      console.error('Error generando video:', error);
      toast.error('Error al generar el video');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Editor de Prompts</h1>
        <p className="text-lg text-gray-600">
          Crea y optimiza prompts para generar videos increíbles con IA
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Prompt Input Section */}
        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
              <Wand2 className="w-6 h-6 text-purple-600" />
              <span>Tu Prompt</span>
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Describe tu video
                </label>
                <textarea
                  value={promptData.originalPrompt}
                  onChange={(e) => setPromptData(prev => ({ ...prev, originalPrompt: e.target.value }))}
                  placeholder="Ej: Un gato naranja jugando en un jardín lleno de flores coloridas durante un atardecer dorado..."
                  className="input-field h-32 resize-none"
                />
              </div>
              
              <button
                onClick={handleOptimizePrompt}
                disabled={isOptimizing || !promptData.originalPrompt.trim()}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                {isOptimizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{isOptimizing ? 'Optimizando...' : 'Optimizar con IA'}</span>
              </button>
            </div>
          </div>

          {/* Optimized Prompt */}
          {promptData.optimizedPrompt && (
            <div className="card space-y-4 border-green-200 bg-green-50">
              <h3 className="text-lg font-semibold text-green-800 flex items-center space-x-2">
                <Sparkles className="w-5 h-5" />
                <span>Prompt Optimizado</span>
              </h3>
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <p className="text-gray-800">{promptData.optimizedPrompt}</p>
              </div>
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div className="space-y-6">
          <div className="card space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Configuración</h2>
            
            <div className="space-y-4">
              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relación de Aspecto
                </label>
                <select
                  value={promptData.aspectRatio}
                  onChange={(e) => setPromptData(prev => ({ ...prev, aspectRatio: e.target.value }))}
                  className="input-field"
                >
                  {aspectRatios.map(ratio => (
                    <option key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estilo
                </label>
                <select
                  value={promptData.style}
                  onChange={(e) => setPromptData(prev => ({ ...prev, style: e.target.value }))}
                  className="input-field"
                >
                  {styles.map(style => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duración
                </label>
                <select
                  value={promptData.duration}
                  onChange={(e) => setPromptData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="input-field"
                >
                  {durations.map(duration => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor de IA
                </label>
                <select
                  value={promptData.provider}
                  onChange={(e) => setPromptData(prev => ({ ...prev, provider: e.target.value }))}
                  className="input-field"
                >
                  {providers.map(provider => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="card space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Antes de generar:</p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Asegúrate de que tu prompt sea descriptivo</li>
                  <li>Considera usar la optimización con IA</li>
                  <li>La generación puede tomar varios minutos</li>
                </ul>
              </div>
            </div>
            
            <button
              onClick={handleGenerateVideo}
              disabled={isGenerating || (!promptData.originalPrompt.trim() && !promptData.optimizedPrompt)}
              className="btn-primary w-full flex items-center justify-center space-x-2 text-lg py-3"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              <span>{isGenerating ? 'Generando...' : 'Generar Video'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;