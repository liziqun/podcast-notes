import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PodcastNote } from '../types';
import { UNCATEGORIZED } from '../types';

interface NoteModalProps {
  note: PodcastNote | null;
  initialData?: Partial<PodcastNote> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: PodcastNote) => void;
  onDelete?: (id: string) => void;
  categories: string[];
}

export function NoteModal({ note, initialData, isOpen, onClose, onSave, onDelete, categories }: NoteModalProps) {
  const [formData, setFormData] = useState<Partial<PodcastNote>>({
    title: '',
    host: '',
    date: new Date().toISOString().split('T')[0],
    rating: 5,
    category: '',
    tags: [],
    keyPoints: '',
    notes: '',
    transcript: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'view'>('view');
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  useEffect(() => {
    setTranscriptExpanded(false);
    if (note) {
      setFormData({ ...note, tags: note.tags || [] });
      setActiveTab('view');
    } else if (initialData) {
      setFormData({
        ...initialData,
        tags: initialData.tags || [],
        keyPoints: initialData.keyPoints || '',
      });
      setActiveTab('edit');
    } else {
      setFormData({
        title: '',
        host: '',
        date: new Date().toISOString().split('T')[0],
        rating: 5,
        category: '',
        tags: [],
        keyPoints: '',
        notes: '',
        transcript: ''
      });
      setTagInput('');
      setActiveTab('edit');
    }
  }, [note, initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      tags: formData.tags || [],
      id: note?.id || Date.now().toString(),
      keyPoints: formData.keyPoints || '',
      createdAt: note?.createdAt || Date.now()
    } as PodcastNote);
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...(formData.tags || []), tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags?.filter(t => t !== tagToRemove) || [] });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-base ${i < rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
    ));
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {note ? formData.title : '添加播客笔记'}
            </h2>
            {note && (
              <div className="flex bg-gray-100 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    activeTab === 'view' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  查看
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    activeTab === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  编辑
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl transition-colors">&times;</button>
        </div>

        {activeTab === 'view' && note ? (
          // 查看模式
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3 text-sm">
                <span className="text-gray-500">{formData.host}</span>
                <span className="text-gray-200">|</span>
                <span className="text-gray-500">{formData.date}</span>
                <span className="text-gray-200">|</span>
                <div className="flex">{renderStars(formData.rating || 0)}</div>
              </div>
              {formData.sourceUrl && (
                <div className="mb-3">
                  <a
                    href={formData.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-400 hover:text-gray-600 hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {formData.sourceUrl}
                  </a>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {formData.category && (
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-sm rounded font-medium">
                    {formData.category}
                  </span>
                )}
                {formData.tags?.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-50 text-gray-400 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {formData.keyPoints && (
                <div className="bg-gray-50 rounded-lg p-5">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">核心观点</h3>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                    {formData.keyPoints}
                  </div>
                </div>
              )}

              {formData.notes && (
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">详细笔记</h3>
                  <div className="bg-gray-50 rounded-lg p-6 text-gray-700 leading-relaxed markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-lg font-semibold text-gray-900 mt-6 mb-4 pb-2 border-b border-gray-200">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-medium text-gray-800 mt-5 mb-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-medium text-gray-800 mt-4 mb-2">{children}</h3>,
                        p: ({ children }) => <p className="mb-3 text-gray-600 leading-relaxed text-sm">{children}</p>,
                        ul: ({ children }) => <ul className="mb-3 space-y-1.5 ml-4">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-3 space-y-1.5 ml-4 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="text-gray-600 leading-relaxed text-sm">{children}</li>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 pl-4 py-1 my-3 text-gray-500 text-sm">{children}</blockquote>,
                        table: ({ children }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse text-sm">{children}</table></div>,
                        thead: ({ children }) => <thead className="border-b border-gray-200">{children}</thead>,
                        th: ({ children }) => <th className="px-3 py-2 text-left font-medium text-gray-700 text-sm">{children}</th>,
                        td: ({ children }) => <td className="px-3 py-2 text-gray-600 border-b border-gray-100 text-sm">{children}</td>,
                        hr: () => <hr className="my-6 border-gray-100" />,
                        strong: ({ children }) => <strong className="font-medium text-gray-800">{children}</strong>,
                      }}
                    >
                      {formData.notes}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {formData.transcript ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                    className="flex items-center gap-2 mb-3 group"
                  >
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">播客原文</h3>
                    <span className={`text-gray-300 text-xs transition-transform ${transcriptExpanded ? 'rotate-180' : ''}`}>&#9660;</span>
                  </button>
                  {transcriptExpanded && (
                    <div className="bg-gray-50 rounded-lg p-5 text-gray-500 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto text-sm">
                      {formData.transcript}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-sm">暂无播客原文</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    className="mt-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
                  >
                    切换到编辑模式添加原文
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 编辑模式
          <>
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">播客标题</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
                placeholder="输入播客标题"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">主播/频道</label>
              <input
                type="text"
                required
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
                placeholder="主播或频道名称"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">收听日期</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">评分</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className={`text-xl transition-colors ${
                      star <= (formData.rating || 0) ? 'text-amber-400' : 'text-gray-200'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">分类</label>
            <select
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-sm"
            >
              <option value="">请选择分类</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">标签</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
                placeholder="添加标签，按回车确认"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              >
                添加
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 text-sm rounded"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">核心观点</label>
            <textarea
              value={formData.keyPoints}
              onChange={(e) => setFormData({ ...formData, keyPoints: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none text-sm"
              placeholder="概括播客的核心内容，包含主要观点和关键论据..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">详细笔记</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none text-sm"
              placeholder="记录你的思考、感悟或行动计划..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">播客原文</label>
            <textarea
              value={formData.transcript}
              onChange={(e) => setFormData({ ...formData, transcript: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none text-sm"
              placeholder="粘贴播客的转录文本或原文内容..."
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {note && onDelete ? (
            <button
              type="button"
              onClick={() => { onDelete(note.id); onClose(); }}
              className="px-3 py-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
            >
              删除
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              保存
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
