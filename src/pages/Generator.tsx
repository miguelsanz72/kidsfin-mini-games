import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Loader2, Play, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface VideoJob {
  id: string;
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  prompt: string;
  optimizedPrompt?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  progress?: number;
  duration?: number;
  aspectRatio?: string;
  style?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

const Generator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');
  
  const [job, setJob] = useState<VideoJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchJobStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/videos/status/${id}`);
      if (!response.ok) {
        throw new Error('Error al obtener el estado del trabajo');
      }
      const data = await response.json();
      setJob(data);
      return data;
    } catch (error) {
      console.error('Error fetching job status:', error);
      toast.error('Error al obtener el estado del trabajo');
      return null;
    }
  };

  useEffect(() => {
    if (!jobId) {
      navigate('/editor');
      return;
    }

    const loadJob = async () => {
      setLoading(true);
      await fetchJobStatus(jobId);
      setLoading(false);
    };

    loadJob();
  }, [jobId, navigate]);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') {
      setPolling(false);
      return;
    }

    setPolling(true);
    const interval = setInterval(async () => {
      const updatedJob = await fetchJobStatus(job.jobId);
      if (updatedJob && (updatedJob.status === 'completed' || updatedJob.status === 'failed')) {
        setPolling(false);
        if (updatedJob.status === 'completed') {
          toast.success('¡Video generado exitosamente!');
        } else {
          toast.error('Error al generar el video');
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [job]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-6 h-6 text-yellow-600" />;
      case 'processing':
        return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Clock className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'queued':
        return 'En cola';
      case 'processing':
        return 'Procesando';
      case 'completed':
        return 'Completado';
      case 'failed':
        return 'Fallido';
      default:
        return 'Desconocido';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handlePlayVideo = () => {
    if (job?.id) {
      navigate(`/player/${job.id}`);
    }
  };

  const handleRefresh = async () => {
    if (job?.jobId) {
      await fetchJobStatus(job.jobId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600">Cargando información del trabajo...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center space-y-4">
        <XCircle className="w-16 h-16 text-red-600 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-900">Trabajo no encontrado</h2>
        <p className="text-gray-600">No se pudo encontrar el trabajo solicitado.</p>
        <button
          onClick={() => navigate('/editor')}
          className="btn-primary"
        >
          Volver al Editor
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Generador de Videos</h1>
        <p className="text-lg text-gray-600">
          Monitorea el progreso de generación de tu video
        </p>
      </div>

      {/* Status Card */}
      <div className="card space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(job.status)}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Estado del Video</h2>
              <p className="text-gray-600">ID: {job.jobId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(job.status)}`}>
              {getStatusText(job.status)}
            </span>
            {polling && (
              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Actualizando...</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {job.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Progreso</span>
              <span>{job.progress || 0}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${job.progress || 0}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {job.status === 'failed' && job.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Error en la generación</h3>
                <p className="text-red-700 mt-1">{job.error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prompt Information */}
        <div className="card space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Información del Prompt</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt Original
              </label>
              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-800">
                {job.prompt}
              </div>
            </div>
            
            {job.optimizedPrompt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Optimizado
                </label>
                <div className="bg-green-50 p-3 rounded-lg text-sm text-gray-800 border border-green-200">
                  {job.optimizedPrompt}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Video Configuration */}
        <div className="card space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Configuración</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Relación de aspecto:</span>
              <span className="font-medium">{job.aspectRatio || 'No especificado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estilo:</span>
              <span className="font-medium capitalize">{job.style || 'No especificado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duración:</span>
              <span className="font-medium">{job.duration || 'No especificado'} segundos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Creado:</span>
              <span className="font-medium">
                {new Date(job.createdAt).toLocaleString()}
              </span>
            </div>
            {job.completedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Completado:</span>
                <span className="font-medium">
                  {new Date(job.completedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Preview */}
      {job.status === 'completed' && job.videoUrl && (
        <div className="card space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Video Generado</h3>
          
          <div className="space-y-4">
            {job.thumbnailUrl && (
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img 
                  src={job.thumbnailUrl} 
                  alt="Miniatura del video"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <button
                    onClick={handlePlayVideo}
                    className="bg-white/90 hover:bg-white rounded-full p-4 transition-colors duration-200"
                  >
                    <Play className="w-8 h-8 text-gray-800" />
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex space-x-4">
              <button
                onClick={handlePlayVideo}
                className="btn-primary flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Reproducir Video</span>
              </button>
              
              <a
                href={job.videoUrl}
                download
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Descargar</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={handleRefresh}
          className="btn-secondary flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Actualizar</span>
        </button>
        
        <button
          onClick={() => navigate('/editor')}
          className="btn-primary"
        >
          Crear Nuevo Video
        </button>
        
        <button
          onClick={() => navigate('/gallery')}
          className="btn-secondary"
        >
          Ver Galería
        </button>
      </div>
    </div>
  );
};

export default Generator;