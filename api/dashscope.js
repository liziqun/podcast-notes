// Vercel Serverless Function - DashScope API 代理

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    res.status(401).json({ error: 'API Key is required' });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 300秒超时

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.message || `HTTP ${response.status}`;
      return res.status(response.status).json({ error: errorMsg });
    }
    res.status(200).json(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      res.status(504).json({ error: 'DashScope API 响应超时，请重试' });
    } else {
      console.error('DashScope proxy error:', error);
      res.status(502).json({ error: 'DashScope 代理失败: ' + error.message });
    }
  }
}
