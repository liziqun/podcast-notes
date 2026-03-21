import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { PodcastCard } from './components/PodcastCard';
import { NoteModal } from './components/NoteModal';
import { AIAnalyzeModal } from './components/AIAnalyzeModal';
import type { PodcastNote } from './types';
import type { AnalysisResult } from './services/openai';
import { sampleNotes } from './data/sampleData';

function App() {
  const [notes, setNotes] = useState<PodcastNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIAnalyzeOpen, setIsAIAnalyzeOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PodcastNote | null>(null);
  const [aiAnalyzedData, setAiAnalyzedData] = useState<Partial<PodcastNote> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('podcast-notes');
    if (stored) {
      setNotes(JSON.parse(stored));
    } else {
      setNotes(sampleNotes);
      localStorage.setItem('podcast-notes', JSON.stringify(sampleNotes));
    }
  }, []);

  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('podcast-notes', JSON.stringify(notes));
    }
  }, [notes]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.keyPoints.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === null || note.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [notes, searchQuery, selectedTag]);

  const stats = useMemo(() => ({
    total: notes.length,
    avgRating: notes.length > 0 
      ? notes.reduce((sum, n) => sum + n.rating, 0) / notes.length 
      : 0
  }), [notes]);

  const handleSave = (note: PodcastNote) => {
    setNotes(prev => {
      const exists = prev.find(n => n.id === note.id);
      if (exists) {
        return prev.map(n => n.id === note.id ? note : n);
      }
      return [note, ...prev];
    });
  };

  const handleDelete = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const openAddModal = () => {
    setEditingNote(null);
    setAiAnalyzedData(null);
    setIsModalOpen(true);
  };

  const openAIAnalyze = () => {
    setIsAIAnalyzeOpen(true);
  };

  const handleAIAnalyzed = (result: AnalysisResult) => {
    const newNote: Partial<PodcastNote> = {
      ...result,
      rating: 5,
      transcript: '',
    };
    setAiAnalyzedData(newNote);
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const openEditModal = (note: PodcastNote) => {
    setEditingNote(note);
    setIsModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        tags={allTags} 
        selectedTag={selectedTag}
        onTagSelect={setSelectedTag}
        stats={stats}
      />
      
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex-1 max-w-xl">
              <input
                type="text"
                placeholder="搜索播客标题、主播、观点或笔记..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
            <div className="flex gap-3 ml-4">
              <button
                onClick={openAIAnalyze}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
              >
                <span>✨</span>
                智能添加
              </button>
              <button
                onClick={openAddModal}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
              >
                <span>+</span>
                添加笔记
              </button>
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">没有找到匹配的播客笔记</p>
              <p className="text-gray-400 mt-2">点击"添加笔记"开始记录你的第一条播客笔记</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredNotes.map(note => (
                <PodcastCard 
                  key={note.id} 
                  note={note} 
                  onClick={() => openEditModal(note)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <NoteModal
        note={editingNote}
        initialData={aiAnalyzedData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        onDelete={editingNote ? handleDelete : undefined}
      />

      <AIAnalyzeModal
        isOpen={isAIAnalyzeOpen}
        onClose={() => setIsAIAnalyzeOpen(false)}
        onAnalyzed={handleAIAnalyzed}
      />
    </div>
  );
}

export default App;
