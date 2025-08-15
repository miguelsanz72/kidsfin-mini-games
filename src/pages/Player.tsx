import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  SkipBack, 
  SkipForward,
  Download,
  Share2,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Video {
  id: string;
  jobId: string;
  status: string;
  prompt: string;
  optimizedPrompt?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  aspectRatio?: string;
  style?: string;
  createdAt: string;
  completedAt?: string;
}

const Player: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) {
      navigate('/gallery');
      return;
    }

    const fetchVideo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/videos/${id}`);
        if (!response.ok) {
          throw new Error('Video no encontrado');
        }
        const data = await response.json();
        setVideo(data);
      } catch (error) {
        console.error('Error fetching video:', error);
        toast.error('Error al cargar el video');
        navigate('/gallery');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [id, navigate]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(videoElement.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('ended', handleEnded);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, [video]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = progressRef.current;
    const videoElement = videoRef.current;
    if (!progressBar || !videoElement) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    videoElement.currentTime = newTime;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isMuted) {
      videoElement.volume = volume;
      setIsMuted(false);
    } else {
      videoElement.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = async () => {
    const videoContainer = videoRef.current?.parentElement;
    if (!videoContainer) return;

    try {
      if (isFullscreen) {
        await document.exitFullscreen();
      } else {
        await videoContainer.requestFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  const skipTime = (seconds: number) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.currentTime = Math.max(0, Math.min(duration, videoElement.currentTime + seconds));
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
    setControlsTimeout(timeout);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado al portapapeles');
    } catch (error) {
      toast.error('Error al copiar el enlace');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600">Cargando video...</p>
        </div>
      </div>
    );
  }

  if (!video || !video.videoUrl) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Video no disponible</h2>
        <p className="text-gray-600">El video solicitado no está disponible o aún se está procesando.</p>
        <button
          onClick={() => navigate('/gallery')}
          className="btn-primary"
        >
          Volver a la Galería
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/gallery')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver a la Galería</span>
        </button>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleShare}
            className="btn-secondary flex items-center space-x-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartir</span>
          </button>
          
          <a
            href={video.videoUrl}
            download
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Descargar</span>
          </a>
        </div>
      </div>

      {/* Video Player */}
      <div 
        className={`relative bg-black rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'aspect-video'}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="w-full h-full object-contain"
          onClick={togglePlay}
          poster={video.thumbnailUrl}
        />
        
        {/* Play/Pause Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <button
              onClick={togglePlay}
              className="bg-white/90 hover:bg-white rounded-full p-6 transition-colors duration-200"
            >
              <Play className="w-12 h-12 text-gray-800" />
            </button>
          </div>
        )}
        
        {/* Controls */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Progress Bar */}
          <div 
            ref={progressRef}
            className="w-full h-2 bg-white/30 rounded-full cursor-pointer mb-4 group"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-150 group-hover:bg-blue-500"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => skipTime(-10)}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              
              <button
                onClick={togglePlay}
                className="text-white hover:text-blue-400 transition-colors"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
              </button>
              
              <button
                onClick={() => skipTime(10)}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              
              <div className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
            
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Video Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">Información del Video</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt Original
              </label>
              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-800">
                {video.prompt}
              </div>
            </div>
            
            {video.optimizedPrompt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Optimizado
                </label>
                <div className="bg-green-50 p-3 rounded-lg text-sm text-gray-800 border border-green-200">
                  {video.optimizedPrompt}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="card space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">Detalles Técnicos</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              <span className="font-medium capitalize">{video.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Relación de aspecto:</span>
              <span className="font-medium">{video.aspectRatio || 'No especificado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estilo:</span>
              <span className="font-medium capitalize">{video.style || 'No especificado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duración:</span>
              <span className="font-medium">{video.duration || 'No especificado'} segundos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Creado:</span>
              <span className="font-medium">
                {new Date(video.createdAt).toLocaleString()}
              </span>
            </div>
            {video.completedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Completado:</span>
                <span className="font-medium">
                  {new Date(video.completedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;