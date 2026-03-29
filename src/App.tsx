import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { PodcastCard } from './components/PodcastCard';
import { NoteModal } from './components/NoteModal';
import { AIAnalyzeModal } from './components/AIAnalyzeModal';
import { AuthModal } from './components/AuthModal';
import { SyncStatus } from './components/SyncStatus';
import type { PodcastNote } from './types';
import type { AnalysisResult } from './services/openai';
import {
  isSupabaseConfigured,
  onAuthStateChange,
  getCurrentUser,
  signOut,
  fetchNotes,
  createNote,
  updateNote,
  deleteNote as deleteCloudNote
} from './services/supabase';
import type { User } from '@supabase/supabase-js';

function App() {
  const [notes, setNotes] = useState<PodcastNote[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIAnalyzeOpen, setIsAIAnalyzeOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PodcastNote | null>(null);
  const [aiAnalyzedData, setAiAnalyzedData] = useState<Partial<PodcastNote> | null>(null);
  
  // 云端同步相关状态
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // 从 localStorage 加载数据（未登录时的主数据源）
  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem('podcast-notes');
    if (stored) {
      try {
        setNotes(JSON.parse(stored));
      } catch {
        setNotes([]);
      }
    } else {
      setNotes([]);
    }
  };

  // 从云端加载数据
  const loadCloudNotes = async () => {
    setIsSyncing(true);
    setCloudError(null);
    try {
      const cloudNotes = await fetchNotes();
      setNotes(cloudNotes);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('加载云端数据失败:', err);
      setCloudError('云端数据加载失败，请检查网络后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  // 统一的数据初始化
  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsCloudEnabled(configured);
    
    if (configured) {
      getCurrentUser().then((currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          // 已登录用户，从云端加载
          setIsSyncing(true);
          setCloudError(null);
          fetchNotes()
            .then((cloudNotes) => {
              setNotes(cloudNotes);
              setLastSyncTime(new Date());
            })
            .catch((err) => {
              console.error('加载云端数据失败:', err);
              setCloudError('云端数据加载失败，请检查网络后重试');
            })
            .finally(() => {
              setIsSyncing(false);
              setIsInitialized(true);
            });
        } else {
          // 未登录，从 localStorage 加载，不连接云端
          loadFromLocalStorage();
          setIsInitialized(true);
        }
      });
      
      // 监听认证状态变化
      const subscription = onAuthStateChange((newUser) => {
        setUser(newUser);
        if (newUser) {
          loadCloudNotes();
        } else {
          // 用户退出登录后，恢复到登录前的本地数据
          setCloudError(null);
          setLastSyncTime(null);
          loadFromLocalStorage();
        }
      });
      
      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Supabase 未配置，从 localStorage 加载
      loadFromLocalStorage();
      setIsInitialized(true);
    }
  }, []);

  // 保存到 LocalStorage，仅在未登录且初始化完成后写入
  // 登录态数据由云端管理，不写入 localStorage，避免覆盖本地数据
  useEffect(() => {
    if (isInitialized && !user) {
      localStorage.setItem('podcast-notes', JSON.stringify(notes));
    }
  }, [notes, isInitialized, user]);

  // 处理登录成功
  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadCloudNotes();
      }
    });
  };

  // 处理退出登录
  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setLastSyncTime(null);
    setCloudError(null);
    // 恢复到登录前的本地数据
    loadFromLocalStorage();
  };

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

  const handleSave = async (note: PodcastNote) => {
    const exists = notes.find(n => n.id === note.id);
    
    // 先更新本地状态
    setNotes(prev => {
      if (exists) {
        return prev.map(n => n.id === note.id ? note : n);
      }
      return [note, ...prev];
    });
    
    // 如果已登录，同步到云端
    if (user && isCloudEnabled) {
      setIsSyncing(true);
      try {
        if (exists) {
          await updateNote(note.id, note);
        } else {
          const newNote = await createNote(note);
          // 更新本地状态，使用云端返回的 ID
          setNotes(prev => prev.map(n => 
            n.id === note.id ? { ...newNote } : n
          ));
        }
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('同步到云端失败:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    // 先更新本地状态
    setNotes(prev => prev.filter(n => n.id !== id));
    
    // 如果已登录，同步删除到云端
    if (user && isCloudEnabled) {
      setIsSyncing(true);
      try {
        await deleteCloudNote(id);
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('从云端删除失败:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const openAddModal = () => {
    setEditingNote(null);
    setAiAnalyzedData(null);
    setIsModalOpen(true);
  };

  const openAIAnalyze = () => {
    setIsAIAnalyzeOpen(true);
  };

  const handleAIAnalyzed = (result: AnalysisResult & { transcript?: string }) => {
    const newNote: Partial<PodcastNote> = {
      ...result,
      rating: 5,
      transcript: result.transcript || '',
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
        syncStatus={
          <SyncStatus
            user={user}
            isSupabaseConfigured={isCloudEnabled}
            onLoginClick={() => setIsAuthModalOpen(true)}
            onLogoutClick={handleLogout}
            lastSyncTime={lastSyncTime}
            isSyncing={isSyncing}
          />
        }
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

          {cloudError ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
                <span className="text-2xl text-red-400">!</span>
              </div>
              <p className="text-red-500 text-lg font-medium">{cloudError}</p>
              <button
                onClick={loadCloudNotes}
                disabled={isSyncing}
                className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isSyncing ? '加载中...' : '重新加载'}
              </button>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-20">
              {notes.length === 0 ? (
                <>
                  <p className="text-gray-400 text-lg">还没有播客笔记</p>
                  <p className="text-gray-400 mt-2">点击"智能添加"或"添加笔记"开始记录</p>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-lg">没有找到匹配的播客笔记</p>
                  <p className="text-gray-400 mt-2">试试调整搜索关键词或筛选条件</p>
                </>
              )}
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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
