// Vercel Serverless Function - DashScope Paraformer 转录代理
// POST: 提交转录任务
// GET:  查询转录任务状态

const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com';
const TRANSCRIPTION_URL = `${DASHSCOPE_BASE_URL}/api/v1/services/audio/asr/transcription`;
const TASK_URL = `${DASHSCOPE_BASE_URL}/api/v1/tasks`;

// 允许的音频来源域名白名单
const ALLOWED_AUDIO_DOMAINS = [
  'xyzcdn.net',
  'xiaoyuzhoufm.com',
  'cos.ap-',           // 腾讯云 COS
  'oss-cn-',           // 阿里云 OSS
  'cdn.',
];

function isAllowedAudioUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_AUDIO_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    return handleSubmit(req, res);
  } else if (req.method === 'GET') {
    return handleQuery(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// 提交转录任务
async function handleSubmit(req, res) {
  const { audioUrl, apiKey } = req.body;

  if (!audioUrl || !apiKey) {
    res.status(400).json({ error: '缺少 audioUrl 或 apiKey 参数' });
    return;
  }

  // 域名白名单校验
  if (!isAllowedAudioUrl(audioUrl)) {
    res.status(400).json({ error: '不支持的音频来源地址' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55秒超时（Vercel函数有60秒限制）
    
    const response = await fetch(TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'paraformer-v2',
        input: {
          file_urls: [audioUrl],
        },
        parameters: {
          language_hints: ['zh'],
        },
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.message || data?.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) {
        res.status(401).json({ error: '百炼 API Key 无效或已过期' });
        return;
      }
      if (response.status === 429) {
        res.status(429).json({ error: '请求过于频繁，请稍后再试' });
        return;
      }
      res.status(response.status).json({ error: `转录任务提交失败: ${errorMsg}` });
      return;
    }

    const taskId = data?.output?.task_id;
    const taskStatus = data?.output?.task_status;

    if (!taskId) {
      res.status(500).json({ error: '未获取到任务 ID' });
      return;
    }

    res.status(200).json({
      taskId,
      status: taskStatus || 'PENDING',
    });
  } catch (error) {
    console.error('Submit transcription error:', error);
    if (error.name === 'AbortError') {
      res.status(504).json({ error: '提交转录任务超时（已等待55秒），请稍后重试' });
      return;
    }
    res.status(500).json({ error: '提交转录任务失败: ' + error.message });
  }
}

// 查询转录任务状态
async function handleQuery(req, res) {
  const { taskId, apiKey } = req.query;

  if (!taskId || !apiKey) {
    res.status(400).json({ error: '缺少 taskId 或 apiKey 参数' });
    return;
  }

  try {
    const response = await fetch(`${TASK_URL}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.message || data?.error?.message || `HTTP ${response.status}`;
      res.status(response.status).json({ error: `查询任务状态失败: ${errorMsg}` });
      return;
    }

    const output = data?.output || {};
    const taskStatus = output.task_status;

    const result = {
      status: taskStatus,
    };

    if (taskStatus === 'SUCCEEDED') {
      // 提取转录结果 URL
      const results = output.results || [];
      if (results.length > 0 && results[0].transcription_url) {
        result.transcriptionUrl = results[0].transcription_url;
      }
    } else if (taskStatus === 'FAILED') {
      result.error = output.message || output.code || '转录任务失败';
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Query transcription error:', error);
    res.status(500).json({ error: '查询转录状态失败: ' + error.message });
  }
}
