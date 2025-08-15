import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Play, 
  Download, 
  Calendar, 
  Clock, 
  Eye,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface Video {
  id: string;
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  prompt: string;
  optimizedPrompt?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  aspectRatio?: string;
  style?: string;
  createdAt: string;
  completedAt?: string;
  progress?: number;
}

interface GalleryResponse {
  videos: Video[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [styleFilter, setStyleFilter] = useState(searchParams.get('style') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  const fetchVideos = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(styleFilter !== 'all' && { style: styleFilter }),
        sort: sortBy
      });
      
      const response = await fetch(`/api/videos/library?${params}`);
      if (!response.ok) {
        throw new Error('Error al cargar los videos');
      }
      
      const data: GalleryResponse = await response.json();
      setVideos(data.videos);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      
      // Update URL params
      const newParams = new URLSearchParams();
      if (searchTerm) newParams.set('search', searchTerm);
      if (statusFilter !== 'all') newParams.set('status', statusFilter);
      if (styleFilter !== 'all') newParams.set('style', styleFilter);
      if (sortBy !== 'newest') newParams.set('sort', sortBy);
      if (currentPage > 1) newParams.set('page', currentPage.toString());
      setSearchParams(newParams);
      
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Error al cargar los videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [currentPage, statusFilter, styleFilter, sortBy]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchVideos();
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleStyleFilter = (style: string) => {
    setStyleFilter(style);
    setCurrentPage(1);
  };

  const handleSort = (sort: string) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'processing':
        return 'Procesando';
      case 'queued':
        return 'En cola';
      case 'failed':
        return 'Fallido';
      default:
        return status;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const VideoCard: React.FC<{ video: Video }> = ({ video }) => (
    <div className="card group hover:shadow-lg transition-all duration-200">
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
        {video.thumbnailUrl ? (
          <img 
            src={video.thumbnailUrl} 
            alt={`Miniatura: ${video.prompt.substring(0, 50)}...`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <div className="text-center space-y-2">
              {video.status === 'processing' ? (
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              ) : (
                <Eye className="w-8 h-8 mx-auto text-gray-400" />
              )}
              <p className="text-sm text-gray-500">
                {video.status === 'processing' ? 'Procesando...' : 'Sin miniatura'}
              </p>
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
            {getStatusText(video.status)}
          </span>
        </div>
        
        {/* Duration Badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {formatDuration(video.duration)}
          </div>
        )}
        
        {/* Play Overlay */}
        {video.status === 'completed' && video.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => navigate(`/player/${video.id}`)}
              className="bg-white/90 hover:bg-white rounded-full p-3 transition-colors duration-200"
            >
              <Play className="w-6 h-6 text-gray-800" />
            </button>
          </div>
        )}
        
        {/* Progress Bar for Processing */}
        {video.status === 'processing' && video.progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
            <div className="w-full bg-white/30 rounded-full h-1">
              <div 
                className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                style={{ width: `${video.progress}%` }}
              />
            </div>
            <p className="text-white text-xs mt-1">{video.progress}%</p>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
            {video.prompt.length > 60 ? `${video.prompt.substring(0, 60)}...` : video.prompt}
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            {video.style && (
              <span className="bg-gray-100 px-2 py-1 rounded-full text-xs capitalize">
                {video.style}
              </span>
            )}
            {video.aspectRatio && (
              <span className="bg-gray-100 px-2 py-1 rounded-full text-xs">
                {video.aspectRatio}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {video.status === 'completed' && video.videoUrl && (
              <>
                <button
                  onClick={() => navigate(`/player/${video.id}`)}
                  className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                  title="Reproducir"
                >
                  <Play className="w-4 h-4" />
                </button>
                <a
                  href={video.videoUrl}
                  download
                  className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                  title="Descargar"
                >
                  <Download className="w-4 h-4" />
                </a>
              </>
            )}
            {video.status === 'processing' && (
              <button
                onClick={() => navigate(`/generator?jobId=${video.jobId}`)}
                className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                title="Ver progreso"
              >
                <Clock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const VideoListItem: React.FC<{ video: Video }> = ({ video }) => (
    <div className="card flex items-center space-x-4 p-4">
      <div className="relative w-32 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        {video.thumbnailUrl ? (
          <img 
            src={video.thumbnailUrl} 
            alt={`Miniatura: ${video.prompt.substring(0, 50)}...`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <Eye className="w-6 h-6 text-gray-400" />
          </div>
        )}
        
        {video.status === 'completed' && video.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => navigate(`/player/${video.id}`)}
              className="bg-white/90 hover:bg-white rounded-full p-2 transition-colors duration-200"
            >
              <Play className="w-4 h-4 text-gray-800" />
            </button>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate mb-1">
              {video.prompt}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(video.createdAt).toLocaleDateString()}</span>
              </div>
              {video.duration && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(video.duration)}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3 ml-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
              {getStatusText(video.status)}
            </span>
            
            <div className="flex items-center space-x-2">
              {video.status === 'completed' && video.videoUrl && (
                <>
                  <button
                    onClick={() => navigate(`/player/${video.id}`)}
                    className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                    title="Reproducir"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <a
                    href={video.videoUrl}
                    download
                    className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </>
              )}
              {video.status === 'processing' && (
                <button
                  onClick={() => navigate(`/generator?jobId=${video.jobId}`)}
                  className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                  title="Ver progreso"
                >
                  <Clock className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Galería de Videos</h1>
          <p className="text-lg text-gray-600 mt-2">
            {total > 0 ? `${total} video${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` : 'No hay videos'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchVideos(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          
          <button
            onClick={() => navigate('/editor')}
            className="btn-primary"
          >
            Crear Video
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por prompt..."
              value={searchTerm}
              onChange={handleSearch}
              className="input-field pl-10"
            />
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4">
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="input-field min-w-0 w-auto"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completados</option>
              <option value="processing">Procesando</option>
              <option value="queued">En cola</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>
          
          {/* Style Filter */}
          <select
            value={styleFilter}
            onChange={(e) => handleStyleFilter(e.target.value)}
            className="input-field min-w-0 w-auto"
          >
            <option value="all">Todos los estilos</option>
            <option value="realistic">Realista</option>
            <option value="cinematic">Cinematográfico</option>
            <option value="animated">Animado</option>
            <option value="artistic">Artístico</option>
          </select>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value)}
            className="input-field min-w-0 w-auto"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="duration_asc">Duración (menor a mayor)</option>
            <option value="duration_desc">Duración (mayor a menor)</option>
          </select>
        </div>
      </div>

      {/* Videos Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-gray-600">Cargando videos...</p>
          </div>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center space-y-4 py-12">
          <Eye className="w-16 h-16 text-gray-400 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">No hay videos</h2>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' || styleFilter !== 'all'
              ? 'No se encontraron videos con los filtros aplicados.'
              : 'Aún no has creado ningún video. ¡Comienza creando tu primer video!'}
          </p>
          <button
            onClick={() => navigate('/editor')}
            className="btn-primary"
          >
            Crear Primer Video
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          : 'space-y-4'
        }>
          {videos.map((video) => 
            viewMode === 'grid' ? (
              <VideoCard key={video.id} video={video} />
            ) : (
              <VideoListItem key={video.id} video={video} />
            )
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
            return (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg border ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Gallery;