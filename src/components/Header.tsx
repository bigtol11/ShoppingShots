import React from 'react';
import { Star, Moon, FolderKanban, Settings, Sparkles, LogOut, LogIn, RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  projectName: string;
  userEmail?: string;
  onLogout?: () => void;
  onLogin?: () => void;
  isLoggingIn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, projectName, userEmail, onLogout, onLogin, isLoggingIn }) => {
  return (
    <header className="bg-[#12111d] border-b border-[#2d2948] px-4 py-2.5 flex items-center justify-between text-slate-200 select-none sticky top-0 z-50">
      <div className="flex items-center space-x-6">
        {/* Brand Logo */}
        <div className="flex items-center space-x-2">
          <div className="bg-gradient-to-tr from-purple-600 to-indigo-500 p-1.5 rounded-lg shadow-md shadow-purple-900/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent">
              Lucy AI Studio
            </span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
        </div>

        {/* Navigation Bar matching Lucy AI Studio design */}
        <nav className="hidden md:flex items-center space-x-2 text-xs font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors ${
              activeTab === 'projects'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 font-semibold shadow-sm'
                : 'hover:bg-[#1d1a33] hover:text-white'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
            <span>📁 내 프로젝트</span>
          </button>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Settings button shortcut - Primary single instance */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-md ${
            activeTab === 'settings'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white ring-1 ring-purple-400/50'
              : 'bg-[#231d40] hover:bg-[#2d2552] border border-[#3b3266] text-purple-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-purple-300" />
          <span>⚙️ API 설정 & 요금제</span>
        </button>

        {/* Project Name Indicator */}
        <div className="hidden lg:flex items-center space-x-2 bg-[#1b1731] border border-[#332c58] px-3 py-1 rounded-md text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300 font-medium max-w-[180px] truncate">{projectName}</span>
        </div>

        {/* Theme Toggle & User Avatar */}
        <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#201c3b] rounded-lg transition-colors">
          <Moon className="w-4 h-4" />
        </button>

        {userEmail ? (
          <>
            <div className="hidden md:flex items-center space-x-2 bg-[#1b1731] border border-[#332c58] px-2.5 py-1 rounded-md text-[11px] text-slate-300 max-w-[160px] truncate">
              {userEmail}
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="로그아웃"
                className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-[#201c3b] rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold border border-purple-400/30 shadow-sm">
              S
            </div>
          </>
        ) : (
          onLogin && (
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition shadow-md disabled:opacity-60"
            >
              {isLoggingIn ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>Google로 로그인</span>
            </button>
          )
        )}
      </div>
    </header>
  );
};
