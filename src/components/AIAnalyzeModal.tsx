import { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import { analyzePodcastTranscript, type AnalysisResult } from '../services/openai';

interface AIAnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzed: (result: AnalysisResult) => void;
}

const API_KEY_STORAGE_KEY = 'podcast-notes-api-key';

export function AIAnalyzeModal({ isOpen, onClose, onAnalyzed }: AIAnalyzeModalProps) {
  const [transcript, setTranscript] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从 localStorage 加载保存的 API Key
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // 保存 API Key 到 localStorage
  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    }
  };

  // 清除保存的 API Key
  const clearApiKey = () => {
    setApiKey('');
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  };

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // 根据文件类型选择不同的读取方式
    if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      // Word 文档 - 使用 mammoth 解析
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setTranscript(result.value);
      } catch (err) {
        setError('Word 文档解析失败，请尝试复制粘贴文本内容');
      }
    } else {
      // 纯文本文件
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setTranscript(content);
      };
      reader.onerror = () => {
        setError('文件读取失败');
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError('请先输入或上传播客原文');
      return;
    }
    if (!apiKey.trim()) {
      setError('请输入 OpenAI API Key');
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">🤖 智能添加播客笔记</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isAnalyzing}
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* API Key 输入 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">
                API Key
                <span className="text-gray-400 font-normal ml-2">(支持 iDealab / OpenAI / Kimi)</span>
              </label>
              {apiKey && (
                <button
                  type="button"
                  onClick={clearApiKey}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  清除已保存的 Key
                </button>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="sk-... 或 Kimi API Key"
              disabled={isAnalyzing}
            />
            <p className="text-xs text-gray-400 mt-1">
              {apiKey ? '✅ API Key 已自动保存，下次无需重新输入' : 'API Key 仅保存在本地浏览器，不会上传到任何服务器'}
            </p>
          </div>

          {/* 文件上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              上传播客原文文件
              <span className="text-gray-400 font-normal ml-2">(.txt, .md, .doc)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isAnalyzing}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <span>📁</span>
              {transcript ? '重新选择文件' : '点击选择文件'}
            </button>
          </div>

          {/* 或直接粘贴 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              或直接粘贴播客原文
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
              disabled={isAnalyzing}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              placeholder="将播客转录文本粘贴到这里..."
            />
            {transcript && (
              <p className="text-xs text-gray-400 mt-1">
                已输入 {transcript.length} 字符
              </p>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              ❌ {error}
            </div>
          )}

          {/* 进度提示 */}
          {progress && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 text-sm flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              {progress}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isAnalyzing}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !transcript.trim() || !apiKey.trim()}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <span className="animate-spin">⚡</span>
                分析中...
              </>
            ) : (
              <>
                <span>✨</span>
                开始分析
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
