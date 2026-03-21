// 简单的代理服务器，解决 CORS 问题
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const IDEALAB_API = 'idealab.alibaba-inc.com';

const server = http.createServer(async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 代理 API 请求
  if (req.url === '/api/analyze' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { transcript, apiKey } = JSON.parse(body);
        
        const prompt = `请分析以下播客转录文本，提取关键信息并以 JSON 格式返回：

${transcript.slice(0, 8000)}...

请提取以下信息：
1. title: 播客标题（如果没有明确标题，请根据内容生成一个简洁的标题）
2. host: 主播或频道名称
3. date: 日期（如果文本中有明确日期，使用原文日期；否则使用今天日期 ${new Date().toISOString().split('T')[0]}）
4. tags: 标签数组（3-5个关键词标签，如["科技", "AI", "商业"]）
5. keyPoints: 核心观点数组（提炼3-5个最重要的观点）
6. notes: 详细笔记（总结播客的主要内容和你的理解）

请严格返回以下 JSON 格式，不要包含其他文字：
{
  "title": "播客标题",
  "host": "主播名称",
  "date": "YYYY-MM-DD",
  "tags": ["标签1", "标签2"],
  "keyPoints": ["观点1", "观点2", "观点3"],
  "notes": "详细笔记内容"
}`;

        const requestBody = JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的播客内容分析助手，擅长从播客转录文本中提取关键信息、提炼核心观点。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
        });

        const options = {
          hostname: IDEALAB_API,
          path: '/api/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(requestBody),
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          let data = '';
          proxyRes.on('data', chunk => data += chunk);
          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        proxyReq.on('error', (error) => {
          console.error('Proxy error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '代理请求失败: ' + error.message }));
        });

        proxyReq.write(requestBody);
        proxyReq.end();

      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求解析失败' }));
      }
    });
    return;
  }

  // 静态文件服务
  const filePath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = path.join(__dirname, 'dist', filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    const ext = path.extname(fullPath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    }[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
  console.log('请确保已连接阿里 VPN');
});
