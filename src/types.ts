// 默认分类列表（首次使用时初始化）
export const DEFAULT_CATEGORIES = ['商业', '科技', '人文', '健康', '娱乐', '职场', '饮食', '艺术', '旅行'];

// 特殊分类：不可删除/编辑，始终显示在列表最后
export const UNCATEGORIZED = '其他';

export interface PodcastNote {
  id: string;
  title: string;
  host: string;
  date: string;
  rating: number;
  category: string;
  tags: string[];
  summary: string;      // 一句话概括
  keyPoints: string;    // 核心观点概括（文本形式）
  notes: string;
  transcript?: string;  // 播客原文/转录文本
  sourceUrl?: string;   // 播客来源链接
  createdAt: number;
}

export interface PodcastMetadata {
  title: string;
  host: string;
  date: string;
  description: string;
  duration: number;       // 秒
  audioUrl: string;
  coverUrl?: string;
}

export interface TranscribeProgress {
  phase: 'parsing' | 'transcribing' | 'analyzing';
  percentage: number;     // 0-100
  message: string;
}
