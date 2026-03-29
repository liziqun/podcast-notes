import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { PodcastCard } from './components/PodcastCard';
import { NoteModal } from './components/NoteModal';
import { AIAnalyzeModal } from './components/AIAnalyzeModal';
import { AuthModal } from './components/AuthModal';
import { SyncStatus } from './components/SyncStatus';
import type { PodcastNote } from './types';
import { DEFAULT_CATEGORIES, UNCATEGORIZED } from './types';
import type { AnalysisResult } from './services/openai';
import {
  isSupabaseConfigured,
  onAuthStateChange,
  getCurrentUser,
  signOut,
  fetchNotes,
  createNote,
  updateNote,
  deleteNote as deleteCloudNote,
  fetchCategories as fetchCloudCategories,
  saveCategories as saveCloudCategories
} from './services/supabase';
import type { User } from '@supabase/supabase-js';

function App() {
  const [notes, setNotes] = useState<PodcastNote[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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

  // 从 localStorage 加载笔记数据
  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem('podcast-notes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PodcastNote[];
        // 兼容旧数据：确保 tags 字段存在
        setNotes(parsed.map(n => ({ ...n, tags: n.tags || [] })));
      } catch {
        setNotes([]);
      }
    } else {
      setNotes([]);
    }
  };

  // 从 localStorage 加载分类数据
  const loadCategoriesFromLocalStorage = () => {
    const stored = localStorage.getItem('podcast-categories');
    if (stored) {
      try {
        setCategories(JSON.parse(stored));
      } catch {
        setCategories([...DEFAULT_CATEGORIES]);
      }
    } else {
      setCategories([...DEFAULT_CATEGORIES]);
    }
  };

  // 从云端加载笔记数据
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

  // 从云端加载分类数据
  const loadCloudCategories = async () => {
    try {
      const cloudCats = await fetchCloudCategories();
      if (cloudCats.length > 0) {
        setCategories(cloudCats);
      } else {
        // 云端无分类，使用默认并同步
        const defaults = [...DEFAULT_CATEGORIES];
        setCategories(defaults);
        await saveCloudCategories(defaults);
      }
    } catch (err) {
      console.error('加载云端分类失败:', err);
      setCategories([...DEFAULT_CATEGORIES]);
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
          // 已登录用户，从云端加载笔记和分类
          setIsSyncing(true);
          setCloudError(null);
          Promise.all([
            fetchNotes(),
            fetchCloudCategories()
          ])
            .then(async ([cloudNotes, cloudCats]) => {
              setNotes(cloudNotes);
              if (cloudCats.length > 0) {
                setCategories(cloudCats);
              } else {
                const defaults = [...DEFAULT_CATEGORIES];
                setCategories(defaults);
                await saveCloudCategories(defaults);
              }
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
          // 未登录，从 localStorage 加载
          loadFromLocalStorage();
          loadCategoriesFromLocalStorage();
          setIsInitialized(true);
        }
      });
      
      // 监听认证状态变化
      const subscription = onAuthStateChange((newUser) => {
        setUser(newUser);
        if (newUser) {
          loadCloudNotes();
          loadCloudCategories();
        } else {
          // 用户退出登录后，恢复到登录前的本地数据
          setCloudError(null);
          setLastSyncTime(null);
          loadFromLocalStorage();
          loadCategoriesFromLocalStorage();
        }
      });
      
      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Supabase 未配置，从 localStorage 加载
      loadFromLocalStorage();
      loadCategoriesFromLocalStorage();
      setIsInitialized(true);
    }
  }, []);

  // 保存笔记到 LocalStorage（仅未登录时）
  useEffect(() => {
    if (isInitialized && !user) {
      localStorage.setItem('podcast-notes', JSON.stringify(notes));
    }
  }, [notes, isInitialized, user]);

  // 保存分类到 LocalStorage（仅未登录时）
  useEffect(() => {
    if (isInitialized && !user) {
      localStorage.setItem('podcast-categories', JSON.stringify(categories));
    }
  }, [categories, isInitialized, user]);

  // 处理登录成功
  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadCloudNotes();
        loadCloudCategories();
      }
    });
  };

  // 处理退出登录
  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setLastSyncTime(null);
    setCloudError(null);
    loadFromLocalStorage();
    loadCategoriesFromLocalStorage();
  };

  // ===== 分类 CRUD =====

  const handleAddCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed === UNCATEGORIZED) return;
    if (categories.includes(trimmed)) return;

    const newCategories = [...categories, trimmed];
    setCategories(newCategories);

    if (user && isCloudEnabled) {
      try {
        await saveCloudCategories(newCategories);
      } catch (err) {
        console.error('同步分类到云端失败:', err);
      }
    }
  };

  const handleEditCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (oldName === UNCATEGORIZED) return;
    if (trimmed === UNCATEGORIZED) return;
    if (trimmed !== oldName && categories.includes(trimmed)) return;

    const newCategories = categories.map(c => c === oldName ? trimmed : c);
    setCategories(newCategories);

    // 联动更新笔记
    const affectedNotes = notes.filter(n => n.category === oldName);
    if (affectedNotes.length > 0) {
      setNotes(prev => prev.map(n => n.category === oldName ? { ...n, category: trimmed } : n));
    }

    // 更新 selectedCategory
    if (selectedCategory === oldName) {
      setSelectedCategory(trimmed);
    }

    if (user && isCloudEnabled) {
      try {
        await saveCloudCategories(newCategories);
        // 批量更新受影响的笔记
        for (const note of affectedNotes) {
          await updateNote(note.id, { category: trimmed });
        }
      } catch (err) {
        console.error('同步到云端失败:', err);
      }
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (name === UNCATEGORIZED) return;

    const newCategories = categories.filter(c => c !== name);
    setCategories(newCategories);

    // 笔记迁移到"其他"
    const affectedNotes = notes.filter(n => n.category === name);
    if (affectedNotes.length > 0) {
      setNotes(prev => prev.map(n => n.category === name ? { ...n, category: UNCATEGORIZED } : n));
    }

    // 重置选中分类
    if (selectedCategory === name) {
      setSelectedCategory(null);
    }

    if (user && isCloudEnabled) {
      try {
        await saveCloudCategories(newCategories);
        for (const note of affectedNotes) {
          await updateNote(note.id, { category: UNCATEGORIZED });
        }
      } catch (err) {
        console.error('同步到云端失败:', err);
      }
    }
  };

  // ===== 计算属性 =====

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(c => counts[c] = 0);
    counts[UNCATEGORIZED] = 0;
    notes.forEach(n => {
      const cat = n.category || UNCATEGORIZED;
      if (cat in counts) {
        counts[cat]++;
      } else {
        counts[UNCATEGORIZED]++;
      }
    });
    return counts;
  }, [notes, categories]);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.keyPoints.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === null
        || (selectedCategory === UNCATEGORIZED
            ? (!note.category || note.category === UNCATEGORIZED || !categories.includes(note.category))
            : note.category === selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [notes, searchQuery, selectedCategory, categories]);

  const stats = useMemo(() => ({
    total: notes.length,
    avgRating: notes.length > 0 
      ? notes.reduce((sum, n) => sum + n.rating, 0) / notes.length 
      : 0
  }), [notes]);

  // ===== 笔记 CRUD =====

  const handleSave = async (note: PodcastNote) => {
    const exists = notes.find(n => n.id === note.id);
    
    setNotes(prev => {
      if (exists) {
        return prev.map(n => n.id === note.id ? note : n);
      }
      return [note, ...prev];
    });
    
    if (user && isCloudEnabled) {
      setIsSyncing(true);
      try {
        if (exists) {
          await updateNote(note.id, note);
        } else {
          const newNote = await createNote(note);
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
    setNotes(prev => prev.filter(n => n.id !== id));
    
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

  // ===== UI 操作 =====

  const openAddModal = () => {
    setEditingNote(null);
    setAiAnalyzedData(null);
    setIsModalOpen(true);
  };

  const openAIAnalyze = () => {
    setIsAIAnalyzeOpen(true);
  };

  const handleAIAnalyzed = (result: AnalysisResult & { transcript?: string; sourceUrl?: string }) => {
    const newNote: Partial<PodcastNote> = {
      ...result,
      tags: result.tags || [],
      category: result.category || '',
      rating: 5,
      transcript: result.transcript || '',
      sourceUrl: result.sourceUrl || '',
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
    <div className="flex min-h-screen bg-[#fafafa]">
      <Sidebar 
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        categories={categories}
        categoryCounts={categoryCounts}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
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
      
      <main className="flex-1 p-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div className="flex-1 max-w-xl">
              <input
                type="text"
                placeholder="搜索播客标题、主播、标签、观点或笔记..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 text-sm placeholder:text-gray-400"
              />
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={openAIAnalyze}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                智能添加
              </button>
              <button
                onClick={openAddModal}
                className="px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                添加笔记
              </button>
            </div>
          </div>

          {cloudError ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm mb-1">{cloudError}</p>
              <button
                onClick={loadCloudNotes}
                disabled={isSyncing}
                className="mt-3 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isSyncing ? '加载中...' : '重新加载'}
              </button>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-24">
              {notes.length === 0 ? (
                <>
                  <p className="text-gray-400 text-sm">还没有播客笔记</p>
                  <p className="text-gray-300 mt-1 text-sm">点击"智能添加"或"添加笔记"开始记录</p>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm">没有找到匹配的播客笔记</p>
                  <p className="text-gray-300 mt-1 text-sm">试试调整搜索关键词或筛选条件</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredNotes.map(note => (
                <PodcastCard 
                  key={note.id} 
                  note={note} 
                  onClick={() => openEditModal(note)}
                  onDelete={handleDelete}
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
        categories={categories}
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
