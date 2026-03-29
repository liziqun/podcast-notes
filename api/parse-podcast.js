// Vercel Serverless Function - 小宇宙播客链接解析

export default async function handler(req, res) {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: '缺少 url 参数' });
    return;
  }

  // 校验 URL 格式
  const urlPattern = /^https?:\/\/(www\.)?xiaoyuzhoufm\.com\/episode\/[\w-]+/;
  if (!urlPattern.test(url)) {
    res.status(400).json({ error: '请输入有效的小宇宙播客链接' });
    return;
  }

  try {
    // 请求小宇宙页面
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        res.status(404).json({ error: '播客页面不存在，请检查链接是否正确' });
        return;
      }
      res.status(response.status).json({ error: `请求小宇宙页面失败: HTTP ${response.status}` });
      return;
    }

    const html = await response.text();

    // 方式1: 从 __NEXT_DATA__ 提取数据（小宇宙是 Next.js 应用）
    let metadata = extractFromNextData(html);

    // 方式2: 备用 - 从 meta 标签提取
    if (!metadata) {
      metadata = extractFromMetaTags(html);
    }

    if (!metadata) {
      res.status(500).json({ error: '无法解析播客信息，页面结构可能已变化' });
      return;
    }

    // 校验音频 URL
    if (!metadata.audioUrl) {
      res.status(500).json({ error: '无法提取音频地址' });
      return;
    }

    res.status(200).json(metadata);
  } catch (error) {
    console.error('Parse podcast error:', error);
    res.status(500).json({ error: '解析播客链接失败: ' + error.message });
  }
}

// 从 __NEXT_DATA__ script 标签提取结构化数据
function extractFromNextData(html) {
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch) return null;

  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const pageProps = nextData?.props?.pageProps;

    if (!pageProps) return null;

    // 小宇宙的数据结构中，episode 信息可能在不同的字段
    const episode = pageProps.episode || pageProps.episodeData || pageProps;

    if (!episode) return null;

    const title = episode.title || '';
    const podcast = episode.podcast || {};
    const host = podcast.title || podcast.author || episode.author || '';
    const description = episode.description || episode.shownotes || episode.summary || '';
    const duration = episode.duration || 0;
    const coverUrl = episode.image?.picUrl || episode.image?.largePicUrl || podcast.image?.picUrl || '';

    // 音频 URL
    const audioUrl = episode.enclosure?.url || episode.mediaKey || episode.url || '';

    // 日期处理
    let date = '';
    if (episode.pubDate) {
      date = new Date(episode.pubDate).toISOString().split('T')[0];
    } else if (episode.publishTime) {
      date = new Date(episode.publishTime).toISOString().split('T')[0];
    }

    if (!title && !audioUrl) return null;

    return {
      title,
      host,
      date: date || new Date().toISOString().split('T')[0],
      description: description.slice(0, 500),
      duration,
      audioUrl: ensureHttps(audioUrl),
      coverUrl: coverUrl || undefined,
    };
  } catch (e) {
    console.error('Failed to parse __NEXT_DATA__:', e);
    return null;
  }
}

// 从 meta 标签提取数据（备用方案）
function extractFromMetaTags(html) {
  const getMeta = (property) => {
    const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*?)["']`, 'i'))
      || html.match(new RegExp(`content=["']([^"']*?)["'][^>]+(?:property|name)=["']${property}["']`, 'i'));
    return match ? match[1] : '';
  };

  const title = getMeta('og:title') || getMeta('twitter:title');
  const description = getMeta('og:description') || getMeta('twitter:description');
  const audioUrl = getMeta('og:audio') || getMeta('og:audio:url');
  const coverUrl = getMeta('og:image');

  if (!title && !audioUrl) return null;

  return {
    title,
    host: getMeta('og:site_name') || '',
    date: new Date().toISOString().split('T')[0],
    description: description.slice(0, 500),
    duration: 0,
    audioUrl: ensureHttps(audioUrl),
    coverUrl: coverUrl || undefined,
  };
}

function ensureHttps(url) {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
}
