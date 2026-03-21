import type { PodcastNote } from '../types';

interface PodcastCardProps {
  note: PodcastNote;
  onClick: () => void;
}

export function PodcastCard({ note, onClick }: PodcastCardProps) {
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

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
            {note.title}
          </h3>
          <p className="text-sm text-gray-500">{note.host}</p>
        </div>
        <div className="flex gap-0.5 ml-3">{renderStars(note.rating)}</div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {note.tags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-medium"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          核心观点
        </p>
        <div className="text-sm text-gray-600 line-clamp-4">
          {note.keyPoints}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">{note.date}</span>
        <span className="text-xs text-blue-600 font-medium">查看详情 →</span>
      </div>
    </div>
  );
}
