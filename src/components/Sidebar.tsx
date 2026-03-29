import { useState, useRef, useEffect, type ReactNode } from 'react';
import { UNCATEGORIZED } from '../types';

interface SidebarProps {
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  categories: string[];
  categoryCounts: Record<string, number>;
  onAddCategory: (name: string) => void;
  onEditCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (name: string) => void;
  stats: {
    total: number;
    avgRating: number;
  };
  syncStatus?: ReactNode;
}

export function Sidebar({
  selectedCategory, onCategorySelect,
  categories, categoryCounts,
  onAddCategory, onEditCategory, onDeleteCategory,
  stats, syncStatus,
}: SidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingCategory && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCategory]);

  const handleAddSubmit = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (trimmed === UNCATEGORIZED || categories.includes(trimmed)) return;
    onAddCategory(trimmed);
    setNewCategoryName('');
    setIsAdding(false);
  };

  const handleEditSubmit = () => {
    if (!editingCategory) return;
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === UNCATEGORIZED) {
      setEditingCategory(null);
      return;
    }
    if (trimmed !== editingCategory && categories.includes(trimmed)) {
      setEditingCategory(null);
      return;
    }
    onEditCategory(editingCategory, trimmed);
    setEditingCategory(null);
  };

  const handleDeleteClick = (name: string) => {
    const count = categoryCounts[name] || 0;
    const msg = count > 0
      ? `"${name}"分类下有 ${count} 条笔记，删除后将移至"其他"。确定删除？`
      : `确定删除"${name}"分类？`;
    if (window.confirm(msg)) {
      onDeleteCategory(name);
    }
  };

  const renderCategoryItem = (cat: string, isUncategorized = false) => {
    const isSelected = selectedCategory === cat;
    const count = categoryCounts[cat] || 0;
    const isEditing = editingCategory === cat;

    if (isEditing) {
      return (
        <div key={cat} className="flex items-center gap-1 px-1">
          <input
            ref={editInputRef}
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditSubmit();
              if (e.key === 'Escape') setEditingCategory(null);
            }}
            onBlur={handleEditSubmit}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
            maxLength={20}
          />
        </div>
      );
    }

    return (
      <button
        key={cat}
        onClick={() => onCategorySelect(cat)}
        className={`group w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between ${
          isSelected
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="truncate">{cat}</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {!isUncategorized && (
            <span className="hidden group-hover:flex items-center gap-0.5">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCategory(cat);
                  setEditingName(cat);
                }}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="编辑"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(cat);
                }}
                className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 cursor-pointer"
                title="删除"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </span>
          )}
          <span className={`text-xs tabular-nums ml-1 ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}>
            {count}
          </span>
        </span>
      </button>
    );
  };

  return (
    <aside className="w-60 bg-white border-r border-gray-100 min-h-screen p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-base font-semibold text-gray-900 tracking-tight">播客笔记</h1>
        <p className="text-xs text-gray-400 mt-0.5">记录你的收听收获</p>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-0.5">已记录</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">{stats.avgRating.toFixed(1)}</p>
            <p className="text-xs text-gray-400 mt-0.5">平均评分</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            分类
          </h2>
          <button
            onClick={() => { setIsAdding(true); setNewCategoryName(''); }}
            className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
            title="添加分类"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="space-y-0.5">
          {/* 全部笔记 */}
          <button
            onClick={() => onCategorySelect(null)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between ${
              selectedCategory === null
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>全部笔记</span>
            <span className={`text-xs tabular-nums ${selectedCategory === null ? 'text-gray-500' : 'text-gray-400'}`}>
              {stats.total}
            </span>
          </button>

          {/* 动态分类列表 */}
          {categories.map(cat => renderCategoryItem(cat))}

          {/* 新增分类输入框 */}
          {isAdding && (
            <div className="flex items-center gap-1 px-1">
              <input
                ref={addInputRef}
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubmit();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
                onBlur={() => {
                  if (!newCategoryName.trim()) setIsAdding(false);
                  else handleAddSubmit();
                }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="输入分类名称"
                maxLength={20}
              />
            </div>
          )}

          {/* "其他"分类 - 始终显示在最后 */}
          {renderCategoryItem(UNCATEGORIZED, true)}
        </div>
      </div>

      {syncStatus && (
        <div className="mt-auto pt-6 border-t border-gray-100">
          <h2 className="text-xs font-medium text-gray-900 mb-2 uppercase tracking-wider">
            云端同步
          </h2>
          {syncStatus}
        </div>
      )}
    </aside>
  );
}
