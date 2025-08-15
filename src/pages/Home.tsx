import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Edit3, Sparkles, Image, ArrowRight, Video, Zap, Palette } from 'lucide-react';

const Home: React.FC = () => {
  const features = [
    {
      icon: Sparkles,
      title: 'IA Generativa',
      description: 'Crea videos increíbles usando la potente API de Veo 3 de Google'
    },
    {
      icon: Edit3,
      title: 'Editor Intuitivo',
      description: 'Interfaz fácil de usar para crear y editar prompts de video'
    },
    {
      icon: Zap,
      title: 'Optimización Automática',
      description: 'OpenAI optimiza tus prompts para obtener mejores resultados'
    },
    {
      icon: Video,
      title: 'Reproductor Avanzado',
      description: 'Reproduce y gestiona tus videos con controles personalizados'
    }
  ];

  const quickActions = [
    {
      title: 'Crear Video',
      description: 'Comienza a crear tu primer video con IA',
      icon: Sparkles,
      link: '/editor',
      color: 'from-purple-600 to-blue-600'
    },
    {
      title: 'Ver Galería',
      description: 'Explora todos tus videos creados',
      icon: Image,
      link: '/gallery',
      color: 'from-green-600 to-teal-600'
    },
    {
      title: 'Generador',
      description: 'Accede al generador de videos',
      icon: Play,
      link: '/generator',
      color: 'from-orange-600 to-red-600'
    }
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 leading-tight">
            Crea Videos Increíbles con
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"> IA</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Transforma tus ideas en videos espectaculares usando la tecnología más avanzada de inteligencia artificial. 
            Powered by Veo 3 y OpenAI.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/editor"
            className="btn-primary flex items-center space-x-2 text-lg px-8 py-3"
          >
            <Sparkles className="w-5 h-5" />
            <span>Comenzar Ahora</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/gallery"
            className="btn-secondary flex items-center space-x-2 text-lg px-8 py-3"
          >
            <Image className="w-5 h-5" />
            <span>Ver Galería</span>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-gray-900">Características Principales</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Descubre todas las herramientas que tenemos para ti
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="card text-center space-y-4 hover:shadow-xl transition-shadow duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center mx-auto">
                  <Icon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-gray-900">Acciones Rápidas</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Accede rápidamente a las funciones más utilizadas
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.link}
                className="group relative overflow-hidden rounded-xl p-6 bg-white border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative space-y-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-gray-800">
                      {action.title}
                    </h3>
                    <p className="text-gray-600 group-hover:text-gray-700">
                      {action.description}
                    </p>
                  </div>
                  <div className="flex items-center text-sm font-medium text-gray-500 group-hover:text-gray-700">
                    <span>Ir ahora</span>
                    <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white">
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold">Potenciado por las Mejores Tecnologías</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="text-3xl font-bold">Veo 3</div>
              <div className="text-purple-100">Generación de Video IA</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold">OpenAI</div>
              <div className="text-purple-100">Optimización de Prompts</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold">React</div>
              <div className="text-purple-100">Interfaz Moderna</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;