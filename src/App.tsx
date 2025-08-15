import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Generator from './pages/Generator';
import Player from './pages/Player';
import Gallery from './pages/Gallery';
import Navbar from './components/Navbar';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/generator" element={<Generator />} />
            <Route path="/player/:id" element={<Player />} />
            <Route path="/gallery" element={<Gallery />} />
          </Routes>
        </main>
        <Toaster position="top-right" richColors />
      </div>
    </Router>
  );
}

export default App;