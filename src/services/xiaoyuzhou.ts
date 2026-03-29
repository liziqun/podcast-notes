// 小宇宙播客服务 - 链接校验、解析、转录编排、进度管理

import type { PodcastMetadata, TranscribeProgress } from '../types';

const POLL_INTERVAL = 5000; // 5 秒轮询一次
const POLL_TIMEOUT = 30 * 60 * 1000; // 30 分钟超时

/**
 * 校验小宇宙链接格式
 */
export function validateXiaoyuzhouUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?xiaoyuzhoufm\.com\/episode\/[\w-]+/.test(url.trim());
}

/**
 * 解析播客链接，获取元数据
 */
export async function parsePodcastUrl(url: string): Promise<PodcastMetadata> {
  const response = await fetch('/api/parse-podcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `解析失败: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 提交转录任务
 */
export async function submitTranscription(
  audioUrl: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioUrl, apiKey }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `提交转录任务失败: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.taskId) {
    throw new Error('未获取到转录任务 ID');
  }

  return data.taskId;
}

/**
 * 轮询转录任务状态，直到完成或失败
 */
export async function pollTranscriptionStatus(
  taskId: string,
  apiKey: string,
  onProgress: (progress: TranscribeProgress) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  const startTime = Date.now();

  while (true) {
    if (abortSignal?.aborted) {
      throw new Error('操作已取消');
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > POLL_TIMEOUT) {
      throw new Error('转录任务超时（已等待 30 分钟），请重试');
    }

    const response = await fetch(
      `/api/transcribe?taskId=${encodeURIComponent(taskId)}&apiKey=${encodeURIComponent(apiKey)}`
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `查询转录状态失败: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'SUCCEEDED') {
      if (!data.transcriptionUrl) {
        throw new Error('转录完成但未获取到结果地址');
      }
      onProgress({
        phase: 'transcribing',
        percentage: 70,
        message: '语音转录完成',
      });
      return data.transcriptionUrl;
    }

    if (data.status === 'FAILED') {
      throw new Error(data.error || '转录任务失败');
    }

    // 更新进度
    const elapsedSeconds = Math.floor(elapsed / 1000);
    const statusText = data.status === 'RUNNING' ? '转录处理中' : '等待处理';
    onProgress({
      phase: 'transcribing',
      percentage: Math.min(10 + Math.floor(elapsedSeconds / 2), 65),
      message: `${statusText}，已等待 ${elapsedSeconds} 秒...`,
    });

    // 等待下次轮询
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, POLL_INTERVAL);
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('操作已取消'));
        }, { once: true });
      }
    });
  }
}

/**
 * 获取转录结果文本
 */
export async function fetchTranscriptionResult(
  transcriptionUrl: string
): Promise<string> {
  const response = await fetch(transcriptionUrl);

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      throw new Error('转录结果已过期，请重新提交');
    }
    throw new Error(`获取转录结果失败: HTTP ${response.status}`);
  }

  const data = await response.json();

  // DashScope Paraformer 结果格式：
  // { transcripts: [{ text: "...", sentences: [...] }] }
  const transcripts = data?.transcripts;
  if (!transcripts || transcripts.length === 0) {
    throw new Error('转录结果为空');
  }

  // 拼接所有转录文本
  const fullText = transcripts
    .map((t: { text?: string }) => t.text || '')
    .filter(Boolean)
    .join('\n');

  if (!fullText.trim()) {
    throw new Error('转录结果文本为空');
  }

  return fullText;
}

/**
 * 格式化时长
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '未知';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}
