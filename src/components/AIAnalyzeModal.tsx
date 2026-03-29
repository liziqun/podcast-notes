import { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import { analyzePodcastTranscript, type AnalysisResult } from '../services/openai';
import {
  validateXiaoyuzhouUrl,
  parsePodcastUrl,
  submitTranscription,
  pollTranscriptionStatus,
  fetchTranscriptionResult,
  formatDuration,
} from '../services/xiaoyuzhou';
import type { PodcastMetadata, TranscribeProgress } from '../types';

interface AIAnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzed: (result: AnalysisResult & { transcript?: string; sourceUrl?: string }) => void;
}

const API_KEY_STORAGE_KEY = 'podcast-notes-api-key';
const DASHSCOPE_KEY_STORAGE_KEY = 'podcast-notes-dashscope-key';

export function AIAnalyzeModal({ isOpen, onClose, onAnalyzed }: AIAnalyzeModalProps) {
  // 共享状态
  const [activeTab, setActiveTab] = useState<'paste' | 'url'>('url');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyExpanded, setApiKeyExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab 1: 粘贴原文 相关状态
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: 播客链接 相关状态
  const [dashscopeApiKey, setDashscopeApiKey] = useState('');
  const [podcastUrl, setPodcastUrl] = useState('');
  const [podcastMeta, setPodcastMeta] = useState<PodcastMetadata | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<TranscribeProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 从 localStorage 加载保存的 API Key
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) setApiKey(savedKey);
    const savedDashscopeKey = localStorage.getItem(DASHSCOPE_KEY_STORAGE_KEY);
    if (savedDashscopeKey) setDashscopeApiKey(savedDashscopeKey);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    }
  };

  const clearApiKey = () => {
    setApiKey('');
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  };

  const saveDashscopeKey = (key: string) => {
    setDashscopeApiKey(key);
    if (key.trim()) {
      localStorage.setItem(DASHSCOPE_KEY_STORAGE_KEY, key);
    }
  };

  const clearDashscopeKey = () => {
    setDashscopeApiKey('');
    localStorage.removeItem(DASHSCOPE_KEY_STORAGE_KEY);
  };

  // 清理函数：取消正在进行的操作
  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  if (!isOpen) return null;

  const isBusy = isAnalyzing || isParsing || isProcessing;

  // ===== Tab 1: 粘贴原文 =====

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setTranscript(result.value);
      } catch {
        setError('Word 文档解析失败，请尝试复制粘贴文本内容');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setTranscript(content);
      };
      reader.onerror = () => setError('文件读取失败');
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError('请先输入或上传播客原文');
      return;
    }
    if (!apiKey.trim()) {
      setError('请输入 API Key');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress('正在分析播客内容...');

    try {
      const result = await analyzePodcastTranscript(transcript, apiKey);
      onAnalyzed(result);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAnalyzing(false);
      setProgress('');
    }
  };

  // ===== Tab 2: 播客链接 =====

  const handleParseUrl = async () => {
    const url = podcastUrl.trim();
    if (!url) {
      setError('请输入小宇宙播客链接');
      return;
    }
    if (!validateXiaoyuzhouUrl(url)) {
      setError('请输入有效的小宇宙播客链接（如 https://www.xiaoyuzhoufm.com/episode/...）');
      return;
    }

    setIsParsing(true);
    setError(null);
    setPodcastMeta(null);

    try {
      const metadata = await parsePodcastUrl(url);
      setPodcastMeta(metadata);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSmartAdd = async () => {
    if (!dashscopeApiKey.trim()) {
      setError('请输入百炼 API Key（用于语音转录）');
      return;
    }
    if (!apiKey.trim()) {
      setError('请输入 iDealab API Key（用于 AI 分析）');
      return;
    }
    if (!podcastMeta) {
      setError('请先解析播客链接');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 阶段 1: 提交转录任务
      setTranscribeProgress({
        phase: 'transcribing',
        percentage: 5,
        message: '正在提交转录任务...',
      });

      const taskId = await submitTranscription(podcastMeta.audioUrl, dashscopeApiKey);

      // 阶段 2: 轮询转录状态
      setTranscribeProgress({
        phase: 'transcribing',
        percentage: 10,
        message: '转录任务已提交，等待处理...',
      });

      const transcriptionUrl = await pollTranscriptionStatus(
        taskId,
        dashscopeApiKey,
        setTranscribeProgress,
        controller.signal
      );

      // 阶段 3: 获取转录结果
      setTranscribeProgress({
        phase: 'transcribing',
        percentage: 75,
        message: '正在获取转录结果...',
      });

      const transcriptText = await fetchTranscriptionResult(transcriptionUrl);

      // 阶段 4: AI 分析
      setTranscribeProgress({
        phase: 'analyzing',
        percentage: 80,
        message: '正在进行 AI 内容分析...',
      });

      const analysisResult = await analyzePodcastTranscript(transcriptText, apiKey);

      // 合并结果：解析元数据优先于 AI 分析结果
      const finalResult: AnalysisResult & { transcript?: string; sourceUrl?: string } = {
        ...analysisResult,
        title: podcastMeta.title || analysisResult.title,
        host: podcastMeta.host || analysisResult.host,
        date: podcastMeta.date || analysisResult.date,
        transcript: transcriptText,
        sourceUrl: podcastUrl.trim(),
      };

      setTranscribeProgress({
        phase: 'analyzing',
        percentage: 100,
        message: '处理完成',
      });

      onAnalyzed(finalResult);
      onClose();
    } catch (err) {
      if ((err as Error).message !== '操作已取消') {
        setError((err as Error).message);
      }
    } finally {
      setIsProcessing(false);
      setTranscribeProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleClose = () => {
    cancelProcessing();
    onClose();
  };

  // ===== 进度步骤渲染 =====
  const renderProgressSteps = () => {
    if (!transcribeProgress) return null;

    const steps = [
      { key: 'parsing', label: '解析链接', done: !!podcastMeta },
      { key: 'transcribing', label: '语音转录', done: transcribeProgress.phase === 'analyzing' },
      { key: 'analyzing', label: 'AI 分析', done: transcribeProgress.percentage >= 100 },
    ];

    return (
      <div className="space-y-2.5">
        {steps.map((step) => {
          const isActive = transcribeProgress.phase === step.key;
          const isDone = step.done;
          return (
            <div key={step.key} className="flex items-center gap-2.5 text-sm">
              <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-xs
                ${isDone ? 'bg-gray-200 text-gray-600' : isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {isDone ? '\u2713' : isActive ? '\u25CF' : '\u25CB'}
              </span>
              <span className={isDone ? 'text-gray-500' : isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                {step.label}
              </span>
              {isActive && (
                <span className="text-gray-400 text-xs">{transcribeProgress.message}</span>
              )}
            </div>
          );
        })}

        {/* 进度条 */}
        <div className="mt-2">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-900 rounded-full transition-all duration-500"
              style={{ width: `${transcribeProgress.percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right tabular-nums">{transcribeProgress.percentage}%</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">智能添加播客笔记</h2>
          <button
            onClick={handleClose}
            className="text-gray-300 hover:text-gray-500 text-xl transition-colors"
            disabled={isBusy}
          >
            &times;
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="px-6 pt-3 flex gap-1 border-b border-gray-100">
          <button
            onClick={() => !isBusy && setActiveTab('paste')}
            disabled={isBusy}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'paste'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            文本上传
          </button>
          <button
            onClick={() => !isBusy && setActiveTab('url')}
            disabled={isBusy}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            播客链接
          </button>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'paste' ? (
            /* ===== Tab 1: 粘贴原文 ===== */
            <>
              {/* 文件上传 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  上传播客原文文件
                  <span className="text-gray-400 font-normal ml-2">(.txt, .md, .doc)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="w-full px-4 py-5 border border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {transcript ? '重新选择文件' : '点击选择文件'}
                </button>
              </div>

              {/* 文本粘贴 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  或直接粘贴播客原文
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={8}
                  disabled={isBusy}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none text-sm"
                  placeholder="将播客转录文本粘贴到这里..."
                />
                {transcript && (
                  <p className="text-xs text-gray-400 mt-1">已输入 {transcript.length} 字符</p>
                )}
              </div>

              {/* API Key - 折叠区域 */}
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setApiKeyExpanded(!apiKeyExpanded)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium text-xs">API 配置</span>
                    {apiKey ? (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">已配置</span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">未配置</span>
                    )}
                  </div>
                  <span className={`text-gray-300 text-xs transition-transform ${apiKeyExpanded ? 'rotate-180' : ''}`}>&#9660;</span>
                </button>
                {apiKeyExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        API Key
                        <span className="text-gray-400 font-normal ml-2">(支持 iDealab)</span>
                      </label>
                      {apiKey && (
                        <button type="button" onClick={clearApiKey} className="text-xs text-gray-400 hover:text-red-400">
                          清除
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => saveApiKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
                      placeholder="sk-... 或 iDealab API Key"
                      disabled={isBusy}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {apiKey ? '已自动保存' : '仅保存在本地浏览器'}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ===== Tab 2: 播客链接 ===== */
            <>
              {/* 链接输入 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  小宇宙播客链接
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={podcastUrl}
                    onChange={(e) => setPodcastUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
                    placeholder="https://www.xiaoyuzhoufm.com/episode/..."
                    disabled={isProcessing}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isParsing && !isProcessing) {
                        handleParseUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleParseUrl}
                    disabled={isParsing || isProcessing || !podcastUrl.trim()}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {isParsing ? '解析中...' : '解析'}
                  </button>
                </div>
              </div>

              {/* 元数据预览 */}
              {podcastMeta && (
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg space-y-2">
                  <h3 className="font-medium text-gray-900 text-sm">{podcastMeta.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    {podcastMeta.host && <span>主播: {podcastMeta.host}</span>}
                    {podcastMeta.date && <span>日期: {podcastMeta.date}</span>}
                    {podcastMeta.duration > 0 && <span>时长: {formatDuration(podcastMeta.duration)}</span>}
                  </div>
                  {podcastMeta.description && (
                    <p className="text-xs text-gray-400 line-clamp-3">{podcastMeta.description}</p>
                  )}
                </div>
              )}

              {/* 进度展示 */}
              {transcribeProgress && (
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg">
                  {renderProgressSteps()}
                </div>
              )}

              {/* API 配置 - 折叠区域 */}
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setApiKeyExpanded(!apiKeyExpanded)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium text-xs">API 配置</span>
                    {dashscopeApiKey && apiKey ? (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">已配置</span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        {!dashscopeApiKey && !apiKey ? '未配置' : '部分配置'}
                      </span>
                    )}
                  </div>
                  <span className={`text-gray-300 text-xs transition-transform ${apiKeyExpanded ? 'rotate-180' : ''}`}>&#9660;</span>
                </button>
                {apiKeyExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-500">
                          百炼 API Key
                          <span className="text-gray-400 font-normal ml-2">(语音转录)</span>
                        </label>
                        {dashscopeApiKey && (
                          <button type="button" onClick={clearDashscopeKey} className="text-xs text-gray-400 hover:text-red-400">清除</button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={dashscopeApiKey}
                        onChange={(e) => saveDashscopeKey(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
                        placeholder="sk-..."
                        disabled={isProcessing}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {dashscopeApiKey ? '已自动保存' : '仅保存在本地'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-500">
                          iDealab API Key
                          <span className="text-gray-400 font-normal ml-2">(AI 分析)</span>
                        </label>
                        {apiKey && (
                          <button type="button" onClick={clearApiKey} className="text-xs text-gray-400 hover:text-red-400">清除</button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => saveApiKey(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
                        placeholder="iDealab API Key"
                        disabled={isProcessing}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {apiKey ? '已自动保存' : '与"文本上传"共用'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 进度提示（Tab 1） */}
          {activeTab === 'paste' && progress && (
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-600 text-sm flex items-center gap-2">
              <span className="animate-spin text-gray-400">*</span>
              {progress}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            取消
          </button>

          {activeTab === 'paste' ? (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !transcript.trim() || !apiKey.trim()}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? '分析中...' : '开始分析'}
            </button>
          ) : (
            <button
              type="button"
              onClick={isProcessing ? cancelProcessing : handleSmartAdd}
              disabled={!isProcessing && (!podcastMeta || !dashscopeApiKey.trim() || !apiKey.trim())}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isProcessing
                  ? 'bg-red-400 text-white hover:bg-red-500'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isProcessing ? '取消' : '开始转录并分析'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
