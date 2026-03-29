import { useState } from 'react';
import type { User } from '@supabase/supabase-js';

interface SyncStatusProps {
  user: User | null;
  isSupabaseConfigured: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  lastSyncTime: Date | null;
  isSyncing: boolean;
}

export function SyncStatus({ 
  user, 
  isSupabaseConfigured, 
  onLoginClick, 
  onLogoutClick,
  lastSyncTime,
  isSyncing 
}: SyncStatusProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  // 未配置 Supabase
  if (!isSupabaseConfigured) {
    return (
      <div className="px-2 py-1.5 text-xs text-gray-300">
        未配置
      </div>
    );
  }

  // 未登录状态
  if (!user) {
    return (
      <button
        onClick={onLoginClick}
        className="w-full px-2 py-1.5 text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
      >
        登录开启同步
      </button>
    );
  }

  // 格式化最后同步时间
  const formatLastSync = (date: Date | null) => {
    if (!date) return '未同步';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full px-2 py-1.5 text-left text-sm hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
      >
        {isSyncing ? (
          <>
            <svg className="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-400 text-xs">同步中...</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0"></span>
            <span className="text-gray-400 text-xs">已同步</span>
          </>
        )}
      </button>

      {showDropdown && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-100 rounded-lg shadow-sm p-3 z-10">
          <div className="text-xs text-gray-400 mb-1.5">
            {user.email}
          </div>
          <div className="text-xs text-gray-400 mb-3">
            同步: {formatLastSync(lastSyncTime)}
          </div>
          <button
            onClick={() => {
              onLogoutClick();
              setShowDropdown(false);
            }}
            className="w-full px-2 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-50 rounded-md transition-colors text-left"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
