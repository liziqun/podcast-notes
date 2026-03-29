import { createClient, SupabaseClient, type User } from '@supabase/supabase-js';
import type { PodcastNote } from '../types';

// 从环境变量获取配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 创建 Supabase 客户端（仅在配置完整时创建）
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// 用户认证相关
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Supabase 未配置');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase 未配置');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase 未配置');
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  if (!supabase) {
    return { unsubscribe: () => {} };
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // 跳过初始会话事件，初始化已由 getCurrentUser() 处理
    if (event === 'INITIAL_SESSION') return;
    callback(session?.user || null);
  });
  return subscription;
}

// 笔记数据 CRUD 操作
export async function fetchNotes(): Promise<PodcastNote[]> {
  if (!supabase) throw new Error('Supabase 未配置');
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取笔记失败:', error);
    throw error;
  }

  // 转换数据库字段为应用类型
  return (data || []).map(item => ({
    id: item.id,
    title: item.title,
    host: item.host || '',
    date: item.date || '',
    rating: item.rating || 5,
    category: item.category || '',
    tags: item.tags || [],
    summary: item.summary || '',
    keyPoints: item.key_points || '',
    notes: item.notes || '',
    transcript: item.transcript || '',
    sourceUrl: item.source_url || '',
    createdAt: new Date(item.created_at).getTime(),
  }));
}

export async function createNote(note: Omit<PodcastNote, 'id' | 'createdAt'>): Promise<PodcastNote> {
  if (!supabase) throw new Error('Supabase 未配置');
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('用户未登录');
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: note.title,
      host: note.host,
      date: note.date,
      rating: note.rating,
      category: note.category,
      tags: note.tags,
      summary: note.summary,
      key_points: note.keyPoints,
      notes: note.notes,
      transcript: note.transcript,
      source_url: note.sourceUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('创建笔记失败:', error);
    throw error;
  }

  return {
    id: data.id,
    title: data.title,
    host: data.host || '',
    date: data.date || '',
    rating: data.rating || 5,
    category: data.category || '',
    tags: data.tags || [],
    summary: data.summary || '',
    keyPoints: data.key_points || '',
    notes: data.notes || '',
    transcript: data.transcript || '',
    sourceUrl: data.source_url || '',
    createdAt: new Date(data.created_at).getTime(),
  };
}

export async function updateNote(id: string, note: Partial<PodcastNote>): Promise<void> {
  if (!supabase) throw new Error('Supabase 未配置');
  const updateData: Record<string, unknown> = {};
  
  if (note.title !== undefined) updateData.title = note.title;
  if (note.host !== undefined) updateData.host = note.host;
  if (note.date !== undefined) updateData.date = note.date;
  if (note.rating !== undefined) updateData.rating = note.rating;
  if (note.category !== undefined) updateData.category = note.category;
  if (note.tags !== undefined) updateData.tags = note.tags;
  if (note.summary !== undefined) updateData.summary = note.summary;
  if (note.keyPoints !== undefined) updateData.key_points = note.keyPoints;
  if (note.notes !== undefined) updateData.notes = note.notes;
  if (note.transcript !== undefined) updateData.transcript = note.transcript;
  if (note.sourceUrl !== undefined) updateData.source_url = note.sourceUrl;
  
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('notes')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('更新笔记失败:', error);
    throw error;
  }
}

export async function deleteNote(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase 未配置');
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('删除笔记失败:', error);
    throw error;
  }
}

// 检查 Supabase 是否已配置
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// 分类数据操作
export async function fetchCategories(): Promise<string[]> {
  if (!supabase) throw new Error('Supabase 未配置');
  const { data, error } = await supabase
    .from('categories')
    .select('name, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取分类失败:', error);
    throw error;
  }

  return (data || []).map(item => item.name);
}

export async function saveCategories(categories: string[]): Promise<void> {
  if (!supabase) throw new Error('Supabase 未配置');
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('用户未登录');
  }

  // 全量覆盖：先删除当前用户的所有分类，再插入新的
  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('删除旧分类失败:', deleteError);
    throw deleteError;
  }

  if (categories.length === 0) return;

  const rows = categories.map((name, index) => ({
    user_id: user.id,
    name,
    sort_order: index,
  }));

  const { error: insertError } = await supabase
    .from('categories')
    .insert(rows);

  if (insertError) {
    console.error('保存分类失败:', insertError);
    throw insertError;
  }
}
