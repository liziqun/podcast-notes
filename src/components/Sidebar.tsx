interface SidebarProps {
  tags: string[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
  stats: {
    total: number;
    avgRating: number;
  };
}

export function Sidebar({ tags, selectedTag, onTagSelect, stats }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900 mb-1">🎧 播客笔记</h1>
        <p className="text-sm text-gray-500">记录你的收听收获</p>
      </div>

      <div className="mb-8 p-4 bg-gray-50 rounded-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">已记录</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.avgRating.toFixed(1)}</p>
            <p className="text-xs text-gray-500">平均评分</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
          标签筛选
        </h2>
        <div className="space-y-1">
          <button
            onClick={() => onTagSelect(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedTag === null
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            全部笔记
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagSelect(tag)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedTag === tag
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
