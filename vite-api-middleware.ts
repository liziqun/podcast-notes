// Vite 开发环境 API 中间件
// 在 vite dev 模式下本地模拟 Vercel Serverless Functions

import { IncomingMessage, ServerResponse } from 'http';

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const result: Record<string, string> = {};
  params.forEach((v, k) => { result[k] = v; });
  return result;
}

export function apiMiddlewarePlugin() {
  return {
    name: 'api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '';

        if (url.startsWith('/api/parse-podcast')) {
          await handleParsePodcast(req, res);
        } else if (url.startsWith('/api/transcribe')) {
          await handleTranscribe(req, res);
        } else {
          next();
        }
      });
    },
  };
}

// ===== /api/parse-podcast =====
async function handleParsePodcast(req: IncomingMessage, res: ServerResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed' }); return; }

  const body = await parseBody(req);
  const { url } = body;

  if (!url) { sendJson(res, 400, { error: '缺少 url 参数' }); return; }

  const urlPattern = /^https?:\/\/(www\.)?xiaoyuzhoufm\.com\/episode\/[\w-]+/;
  if (!urlPattern.test(url)) { sendJson(res, 400, { error: '请输入有效的小宇宙播客链接' }); return; }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      sendJson(res, response.status, { error: `请求小宇宙页面失败: HTTP ${response.status}` });
      return;
    }

    const html = await response.text();
    let metadata = extractFromNextData(html) || extractFromMetaTags(html);

    if (!metadata) { sendJson(res, 500, { error: '无法解析播客信息，页面结构可能已变化' }); return; }
    if (!metadata.audioUrl) { sendJson(res, 500, { error: '无法提取音频地址' }); return; }

    sendJson(res, 200, metadata);
  } catch (error: any) {
    sendJson(res, 500, { error: '解析播客链接失败: ' + error.message });
  }
}

// ===== /api/transcribe =====
const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';
const ALLOWED_DOMAINS = ['xyzcdn.net', 'xiaoyuzhoufm.com', 'cos.ap-', 'oss-cn-', 'cdn.'];

async function handleTranscribe(req: IncomingMessage, res: ServerResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const { audioUrl, apiKey } = body;
    if (!audioUrl || !apiKey) { sendJson(res, 400, { error: '缺少 audioUrl 或 apiKey 参数' }); return; }

    try {
      const hostname = new URL(audioUrl).hostname;
      if (!ALLOWED_DOMAINS.some(d => hostname.includes(d))) {
        sendJson(res, 400, { error: '不支持的音频来源地址' }); return;
      }
    } catch { sendJson(res, 400, { error: '无效的音频 URL' }); return; }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
      
      const r = await fetch(`${DASHSCOPE_BASE}/api/v1/services/audio/asr/transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: 'paraformer-v2',
          input: { file_urls: [audioUrl] },
          parameters: { language_hints: ['zh'] },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await r.json() as any;
      if (!r.ok) {
        const msg = data?.message || data?.error?.message || `HTTP ${r.status}`;
        if (r.status === 401) { sendJson(res, 401, { error: '百炼 API Key 无效或已过期' }); return; }
        sendJson(res, r.status, { error: `转录任务提交失败: ${msg}` }); return;
      }
      sendJson(res, 200, { taskId: data?.output?.task_id, status: data?.output?.task_status || 'PENDING' });
    } catch (error: any) {
      sendJson(res, 500, { error: '提交转录任务失败: ' + error.message });
    }

  } else if (req.method === 'GET') {
    const query = parseQuery(req.url || '');
    const { taskId, apiKey } = query;
    if (!taskId || !apiKey) { sendJson(res, 400, { error: '缺少 taskId 或 apiKey 参数' }); return; }

    try {
      const r = await fetch(`${DASHSCOPE_BASE}/api/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await r.json() as any;
      if (!r.ok) {
        sendJson(res, r.status, { error: `查询任务状态失败: ${data?.message || `HTTP ${r.status}`}` }); return;
      }
      const output = data?.output || {};
      const result: any = { status: output.task_status };
      if (output.task_status === 'SUCCEEDED') {
        const results = output.results || [];
        if (results.length > 0 && results[0]?.transcription_url) {
          result.transcriptionUrl = results[0].transcription_url;
        }
      } else if (output.task_status === 'FAILED') {
        result.error = output.message || output.code || '转录任务失败';
      }
      sendJson(res, 200, result);
    } catch (error: any) {
      sendJson(res, 500, { error: '查询转录状态失败: ' + error.message });
    }

  } else {
    sendJson(res, 405, { error: 'Method not allowed' });
  }
}

// ===== 工具函数 =====
function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function ensureHttps(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
}

function extractFromNextData(html: string) {
  const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    const episode = data?.props?.pageProps?.episode || data?.props?.pageProps?.episodeData;
    if (!episode) return null;
    const podcast = episode.podcast || {};
    let date = '';
    if (episode.pubDate) date = new Date(episode.pubDate).toISOString().split('T')[0];
    const audioUrl = episode.enclosure?.url || episode.mediaKey || '';
    if (!episode.title && !audioUrl) return null;
    return {
      title: episode.title || '',
      host: podcast.title || podcast.author || '',
      date: date || new Date().toISOString().split('T')[0],
      description: (episode.description || episode.shownotes || '').slice(0, 500),
      duration: episode.duration || 0,
      audioUrl: ensureHttps(audioUrl),
      coverUrl: episode.image?.picUrl || podcast.image?.picUrl || undefined,
    };
  } catch { return null; }
}

function extractFromMetaTags(html: string) {
  const getMeta = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*?)["']`, 'i'))
      || html.match(new RegExp(`content=["']([^"']*?)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
    return m ? m[1] : '';
  };
  const title = getMeta('og:title');
  const audioUrl = getMeta('og:audio') || getMeta('og:audio:url');
  if (!title && !audioUrl) return null;
  return {
    title,
    host: getMeta('og:site_name') || '',
    date: new Date().toISOString().split('T')[0],
    description: getMeta('og:description').slice(0, 500),
    duration: 0,
    audioUrl: ensureHttps(audioUrl),
    coverUrl: getMeta('og:image') || undefined,
  };
}
