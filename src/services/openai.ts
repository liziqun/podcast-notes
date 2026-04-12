// AI API 服务（支持 OpenAI、Kimi/Moonshot、阿里云百炼 DashScope 和阿里 iDealab）

// AI 分析使用的模型名称
export const AI_ANALYSIS_MODEL = 'qwen3-max';

// 安全解析 JSON，处理字符串值内部的非法字符
function safeJsonParse(str: string): any {
  // 第一次：直接解析
  try {
    return JSON.parse(str);
  } catch (e) {
    // 第二次：清理非法控制字符后再试
    // 只移除真正的非法控制字符（U+0000 到 U+001F 中除了 \t \n \r 以外的）
    // 不要替换 \n \r \t，因为它们在 JSON 结构中是合法的空白字符
    const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // 第三次：处理字符串值内部的换行符
      // 只替换 JSON 字符串值内部（引号之间）的换行符
      const fixedNewlines = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
      });
      try {
        return JSON.parse(fixedNewlines);
      } catch (e3) {
        // 最后尝试：提取 {...} 部分
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const fixedObj = objMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
            return match
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t');
          });
          return JSON.parse(fixedObj);
        }
        throw e3;
      }
    }
  }
}

// 提取 markdown 代码块中的 JSON
function extractJson(content: string): string {
  // 移除可能的 markdown 代码块标记
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export interface AnalysisResult {
  title: string;
  host: string;
  date: string;
  tags: string[];
  category: string;
  summary: string;
  keyPoints: string;
  notes: string;
}

// 检测 API Key 类型
function detectAPIType(apiKey: string): 'idealab' | 'kimi' | 'openai' | 'dashscope' {
  if (apiKey.startsWith('sk-kimi') || apiKey.includes('kimi')) {
    return 'kimi';
  } else if (/^[a-f0-9]{32}$/i.test(apiKey)) {
    return 'idealab';
  } else if (apiKey.startsWith('sk-')) {
    return 'dashscope';
  } else {
    return 'openai';
  }
}

export async function analyzePodcastTranscript(
  transcript: string,
  apiKey: string
): Promise<AnalysisResult> {
  const apiType = detectAPIType(apiKey);
  
  // iDealab 使用本地代理服务器
  if (apiType === 'idealab') {
    return analyzeWithProxy(transcript, apiKey);
  }
  
  // Kimi、OpenAI 和 DashScope 直接调用
  return analyzeDirectly(transcript, apiKey, apiType);
}

// 构建分析 prompt
function buildPrompt(transcript: string): string {
  return `你是一位专业的播客内容分析师，请深度分析以下播客转录文本，提取结构化信息并以 JSON 格式返回。

## 播客原文
${transcript.slice(0, 12000)}...

## 分析要求

请按照以下高质量播客笔记的标准进行提取：

### 1. title（播客标题）
- 优先使用原文明确标题
- 如无，生成简洁有力的标题（体现核心洞察，15字内）

### 2. host（主播/频道）
- 提取主播/频道名称
- 多个主播用顿号分隔

### 3. date（日期）
- 原文有则使用，无则填 ${new Date().toISOString().split('T')[0]}

### 4. tags（标签，3-5个）
- 提炼核心主题关键词
- 示例：["AI", "效率悖论", "经济学", "技术反思"]

### 4.5 category（分类，必选1个）
- 从以下9个分类中选择最匹配的一个：商业、科技、人文、健康、娱乐、职场、饮食、艺术、旅行
- 根据播客核心内容选择最贴切的分类

### 4.6 summary（一句话概括）
- 用一句话（30-60字）概括这期播客的核心内容
- 要求简洁有力，让读者快速了解这期节目讲了什么
- 示例："探讨AI效率悖论：技术提升效率反而加剧内卷，提出'反效率'防护机制守护注意力主权"

### 5. keyPoints（主要内容）
用2-3段话提炼该期播客的主要内容和核心观点，总字数控制在300-450字。要求：
- 每段100-150字，段落间有逻辑递进
- 涵盖核心议题、关键论点、重要案例
- 语言精炼流畅，像一篇精炼的摘要

示例：
这期播客以"AI为何让我们更累"为切入点，深入探讨了19世纪经济学家杰文斯提出的著名悖论——当资源利用效率提升时，单位成本下降反而会刺激更多使用，最终导致总消耗量不降反升。这一发现揭示了效率与消耗之间的反直觉关系。

节目通过历史对比，揭示了这一悖论在AI时代的三重重演：内容生产爆炸让创作者陷入"无限任务流"；算力需求激增导致能源危机；最严峻的是注意力稀缺，海量信息争夺让我们丧失深度思考能力。效率提升释放的需求，正在吞噬效率带来的红利。

面对这种困境，节目提出破局之道：建立"反效率"防护机制，主动设置产出上限；重新定义价值，从追求产出量转向守护注意力主权；以及培养"找问题"而非"回答问题"的能力。真正的进步不在于做更多，而在于有勇气说"这已足够"。

### 6. notes（详细笔记）
要求按以下结构组织（Markdown格式），注重可读性和视觉层次：

**📻 节目基本信息**

| 项目 | 内容 |
|------|------|
| 节目名称 | xxx |
| 本期主题 | xxx |
| 核心人物 | xxx |
| 时长 | 约xx分钟 |

---

**一句话概括**

用一句话点明本期播客的核心洞察。

---

**💡 核心逻辑**

用2-3句话说明本期节目的论证逻辑和展开脉络。

---

**一、第一大主题**（用简洁小标题概括）

**背景与现象**
描述问题背景或现象...

**本质洞察**  
点明核心观点和洞察...

**关键案例**
- 案例1：具体描述
- 案例2：具体描述

**💬 金句**："如有精彩引用，单独列出"

---

**二、第二大主题**（同上结构）
...

---

**🔧 破局之道**

针对节目提出的问题，可行的应对思路：

**1. 第一个建议**
具体做法和背后的逻辑...

**2. 第二个建议**  
具体做法和背后的逻辑...

---

**📊 核心概念对比**（如有）

| 维度 | A概念 | B概念 |
|------|-------|-------|
| 定义 | ... | ... |
| 特点 | ... | ... |

---

**💡 总结**

用1-2段话总结播客的核心启示，联系现实给出思考。

---

## 输出格式
必须严格返回以下 JSON，不要包含任何其他文字：
{
  "title": "播客标题",
  "host": "主播名称",
  "date": "YYYY-MM-DD",
  "tags": ["标签1", "标签2", "标签3"],
  "category": "从9个分类中选1个",
  "summary": "一句话概括这期播客的核心内容（30-60字）",
  "keyPoints": "用2-3段话概括播客核心内容，每段100-150字，段落间有逻辑递进...",
  "notes": "一句话核心概括\\n\\n---\\n\\n**📻 节目基本信息**\\n\\n| 项目 | 内容 |\\n|------|------|\\n| 节目名称 | xxx |\\n..."
}`;
}

// 通过 Vite 代理服务器调用 iDealab
async function analyzeWithProxy(transcript: string, apiKey: string): Promise<AnalysisResult> {
  const prompt = buildPrompt(transcript);
  
  const requestBody = {
    model: 'gpt-5.4-0305-global',
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
  };

  let response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    throw new Error('网络连接失败，请确保已连接阿里 VPN');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '未知错误');
    console.error('API Error:', response.status, errorText);
    if (response.status === 401) throw new Error('API Key 无效或已过期');
    if (response.status === 403) throw new Error(`API Key 无权访问该模型: ${errorText}`);
    if (response.status === 404) throw new Error('API 接口不存在，请检查 iDealab API 地址是否正确');
    throw new Error(`请求失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('[analyze] 响应数据:', JSON.stringify(data).substring(0, 500));
  return parseAPIResponse(data);
}

// 直接调用 API（Kimi/OpenAI/DashScope）
async function analyzeDirectly(transcript: string, apiKey: string, apiType: 'kimi' | 'openai' | 'dashscope'): Promise<AnalysisResult> {
  let config;
  if (apiType === 'kimi') {
    config = {
      url: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'moonshot-v1-8k',
    };
  } else if (apiType === 'dashscope') {
    config = {
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: AI_ANALYSIS_MODEL,
    };
  } else {
    config = {
      url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
    };
  }
  
  const prompt = buildPrompt(transcript);

  let response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
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
      }),
    });
  } catch (fetchError) {
    throw new Error('网络连接失败，请检查网络');
  }

  if (!response.ok) {
    let errorMessage = 'API 调用失败';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || error.message || `HTTP ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    
    if (response.status === 401) {
      throw new Error('API Key 无效或已过期');
    } else if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后再试');
    } else {
      throw new Error(errorMessage);
    }
  }

  const data = await response.json();
  return parseAPIResponse(data);
}

// 解析 API 响应
function parseAPIResponse(data: any): AnalysisResult {
  const content = data?.choices?.[0]?.message?.content;
  
  if (!content) {
    // 提供更详细的错误信息
    const debugInfo = JSON.stringify({
      hasChoices: Array.isArray(data?.choices),
      choicesLength: data?.choices?.length,
      hasMessage: !!data?.choices?.[0]?.message,
      error: data?.error,
    });
    console.error('API 响应结构:', debugInfo);
    console.error('完整响应:', JSON.stringify(data).substring(0, 1000));
    throw new Error(`API 返回内容为空（响应结构: ${debugInfo}）`);
  }

  try {
    // 先提取 markdown 代码块中的内容
    let jsonStr = extractJson(content);
    
    // 使用安全解析函数解析 JSON
    const result = safeJsonParse(jsonStr);
    return {
      title: result.title || '未命名播客',
      host: result.host || '未知主播',
      date: result.date || new Date().toISOString().split('T')[0],
      tags: Array.isArray(result.tags) ? result.tags : [],
      category: result.category || '',
      summary: result.summary || '',
      keyPoints: typeof result.keyPoints === 'string' ? result.keyPoints : '',
      notes: result.notes || '',
    };
  } catch (e) {
    // fallback: 尝试用正则提取 JSON 对象部分再解析
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = safeJsonParse(jsonMatch[0]);
        return {
          title: result.title || '未命名播客',
          host: result.host || '未知主播',
          date: result.date || new Date().toISOString().split('T')[0],
          tags: Array.isArray(result.tags) ? result.tags : [],
          category: result.category || '',
          summary: result.summary || '',
          keyPoints: typeof result.keyPoints === 'string' ? result.keyPoints : '',
          notes: result.notes || '',
        };
      }
    } catch (fallbackError) {
      // fallback 也失败，抛出原始错误
    }
    throw new Error('解析 API 响应失败: ' + (e as Error).message);
  }
}
