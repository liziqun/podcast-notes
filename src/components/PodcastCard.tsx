import type { PodcastNote } from '../types';

interface PodcastCardProps {
  note: PodcastNote;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export function PodcastCard({ note, onClick, onDelete }: PodcastCardProps) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-sm ${
          i < rating ? 'text-yellow-400' : 'text-gray-200'
        }`}
      >
        ★
      </span>
    ));
  };

  // 从 notes markdown 中提取"一句话概括"内容
  const extractSummary = (notes: string): string => {
    const match = notes.match(/\*{0,2}一句话概括\*{0,2}\s*\n+([\s\S]*?)(?=\n---|\n\*{2})/);
    if (match?.[1]) return match[1].trim();
    return '';
  };

  const summaryText = extractSummary(note.notes) || note.summary || note.keyPoints;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer flex flex-col"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-0.5">{renderStars(note.rating)}</div>
        {note.category && (
          <span className="text-xs text-gray-400 font-medium">
            {note.category}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
        {note.title}
      </h3>

      {note.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 mb-2">
          {note.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {summaryText && (
        <div className="text-sm text-gray-600 line-clamp-4 mt-8">
          {summaryText}
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">{note.date}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`确定要删除「${note.title}」吗？`)) {
                onDelete(note.id);
              }
            }}
            className="text-xs text-gray-300 hover:text-red-500 transition-colors"
          >
            删除
          </button>
          <span className="text-xs text-blue-600 font-medium">查看详情 →</span>
        </div>
      </div>
    </div>
  );
}
