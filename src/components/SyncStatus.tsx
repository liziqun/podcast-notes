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
      <div className="px-3 py-2 text-xs text-gray-400">
        云端同步未配置
      </div>
    );
  }

  // 未登录状态
  if (!user) {
    return (
      <button
        onClick={onLoginClick}
        className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        登录开启云端同步
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
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
      >
        {isSyncing ? (
          <>
            <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-blue-600">同步中...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-600">已同步</span>
          </>
        )}
      </button>

      {showDropdown && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
          <div className="text-xs text-gray-500 mb-2">
            账号: {user.email}
          </div>
          <div className="text-xs text-gray-500 mb-3">
            上次同步: {formatLastSync(lastSyncTime)}
          </div>
          <button
            onClick={() => {
              onLogoutClick();
              setShowDropdown(false);
            }}
            className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
