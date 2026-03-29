export interface PodcastNote {
  id: string;
  title: string;
  host: string;
  date: string;
  rating: number;
  tags: string[];
  keyPoints: string;  // 核心观点概括（文本形式）
  notes: string;
  transcript?: string;  // 播客原文/转录文本
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
