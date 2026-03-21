import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PodcastNote } from '../types';

interface NoteModalProps {
  note: PodcastNote | null;
  initialData?: Partial<PodcastNote> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: PodcastNote) => void;
  onDelete?: (id: string) => void;
}

export function NoteModal({ note, initialData, isOpen, onClose, onSave, onDelete }: NoteModalProps) {
  const [formData, setFormData] = useState<Partial<PodcastNote>>({
    title: '',
    host: '',
    date: new Date().toISOString().split('T')[0],
    rating: 5,
    tags: [],
    keyPoints: '',
    notes: '',
    transcript: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'view'>('view');

  useEffect(() => {
    if (note) {
      setFormData(note);
      setActiveTab('view'); // 查看已有笔记时默认显示查看模式
    } else if (initialData) {
      setFormData({
        ...initialData,
        keyPoints: initialData.keyPoints || '',
      });
      setActiveTab('edit'); // AI分析后的数据默认编辑模式
    } else {
      setFormData({
        title: '',
        host: '',
        date: new Date().toISOString().split('T')[0],
        rating: 5,
        tags: [],
        keyPoints: '',
        notes: '',
        transcript: ''
      });
      setActiveTab('edit'); // 新建笔记时默认编辑模式
    }
  }, [note, initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
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
      <span key={i} className={`text-lg ${i < rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
    ));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">
              {note ? formData.title : '添加播客笔记'}
            </h2>
            {note && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'view' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  查看
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  编辑
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {activeTab === 'view' && note ? (
          // 查看模式
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-gray-500">{formData.host}</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">{formData.date}</span>
                <span className="text-gray-300">|</span>
                <div className="flex">{renderStars(formData.rating || 0)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags?.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {/* 核心观点 */}
              {formData.keyPoints && (
                <div className="bg-blue-50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3">💡 核心观点</h3>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {formData.keyPoints}
                  </div>
                </div>
              )}

              {/* 详细笔记 */}
              {formData.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">📝 详细笔记</h3>
                  <div className="bg-gray-50 rounded-xl p-6 text-gray-700 leading-relaxed markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-6 mb-4 pb-2 border-b border-gray-200">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-800 mt-5 mb-3 flex items-center gap-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">{children}</h3>,
                        p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="mb-4 space-y-2 ml-4">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-4 space-y-2 ml-4 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="text-gray-700 leading-relaxed">{children}</li>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-400 pl-4 py-2 my-4 bg-blue-50 rounded-r-lg italic text-gray-600">{children}</blockquote>,
                        table: ({ children }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-sm">{children}</table></div>,
                        thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
                        th: ({ children }) => <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-800 whitespace-nowrap">{children}</th>,
                        td: ({ children }) => <td className="border border-gray-200 px-3 py-2 text-gray-700">{children}</td>,
                        hr: () => <hr className="my-6 border-gray-200" />,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      }}
                    >
                      {formData.notes}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* 播客原文 */}
              {formData.transcript ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">📄 播客原文</h3>
                  <div className="bg-gray-50 rounded-xl p-5 text-gray-600 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto text-sm">
                    {formData.transcript}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <p className="text-gray-400">暂无播客原文</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    切换到编辑模式添加原文 →
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 编辑模式
          <>
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">播客标题</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入播客标题"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">主播/频道</label>
              <input
                type="text"
                required
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="主播或频道名称"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">收听日期</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">评分</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className={`text-2xl transition-colors ${
                      star <= (formData.rating || 0) ? 'text-yellow-400' : 'text-gray-200'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">标签</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="添加标签，按回车确认"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                添加
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-sm rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">核心观点</label>
            <textarea
              value={formData.keyPoints}
              onChange={(e) => setFormData({ ...formData, keyPoints: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="概括播客的核心内容，包含主要观点和关键论据..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">详细笔记</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="记录你的思考、感悟或行动计划..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">播客原文</label>
            <textarea
              value={formData.transcript}
              onChange={(e) => setFormData({ ...formData, transcript: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              placeholder="粘贴播客的转录文本或原文内容..."
            />
          </div>
        </form>

        <div className="p-6 border-t border-gray-100 flex items-center justify-between">
          {note && onDelete ? (
            <button
              type="button"
              onClick={() => { onDelete(note.id); onClose(); }}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              删除
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
