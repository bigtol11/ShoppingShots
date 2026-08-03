import React from 'react';
import { Star, Moon, FolderKanban, Settings, Sparkles, LogOut, LogIn, RefreshCw, Plus } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  projectName: string;
  userEmail?: string;
  onLogout?: () => void;
  onLogin?: () => void;
  isLoggingIn?: boolean;
  onNewProject?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, projectName, userEmail, onLogout, onLogin, isLoggingIn, onNewProject }) => {
  return (
    <header className="bg-[#12111d] border-b border-[#2d2948] px-2.5 sm:px-4 py-2.5 flex items-center justify-between text-slate-200 select-none sticky top-0 z-50">
      <div className="flex items-center space-x-2 sm:space-x-6 min-w-0">
        {/* Brand Logo — also doubles as a home button */}
        <button
          onClick={() => setActiveTab('trend')}
          title="첫 화면으로"
          className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 hover:opacity-80 transition-opacity"
        >
          <div className="bg-gradient-to-tr from-purple-600 to-indigo-500 p-1.5 rounded-lg shadow-md shadow-purple-900/30 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="hidden xs:flex items-center space-x-1.5 min-w-0">
            <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent truncate">
              ShoppingShots
            </span>
            <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.5 rounded shrink-0">
              v{__APP_VERSION__}
            </span>
            <Star className="hidden sm:block w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
          </div>
        </button>

        {/* Project gallery — separate from the pipeline steps in StepNav below, so it
            stays here rather than in the horizontal step bar. Icon-only on narrow
            screens now that there's no sidebar drawer to fall back on for mobile. */}
        <button
          onClick={() => setActiveTab('projects')}
          title="내 프로젝트"
          className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-medium transition-colors shrink-0 ${
            activeTab === 'projects'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 font-semibold shadow-sm'
              : 'text-slate-300 hover:bg-[#1d1a33] hover:text-white'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">📁 내 프로젝트</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* New project reset - available from any tab, discards current in-progress project */}
        {onNewProject && (
          <button
            onClick={onNewProject}
            title="새 쇼핑쇼츠 기획 (현재 진행중인 내용 초기화)"
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-md min-h-[40px] bg-[#231d40] hover:bg-rose-950/60 border border-[#3b3266] hover:border-rose-700/50 text-purple-200 hover:text-rose-200"
          >
            <Plus className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span className="hidden sm:inline">새 쇼핑쇼츠 기획(초기화)</span>
          </button>
        )}

        {/* Settings button shortcut - icon-only on narrow screens */}
        <button
          onClick={() => setActiveTab('settings')}
          title="API 설정 & 요금제"
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-md min-h-[40px] ${
            activeTab === 'settings'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white ring-1 ring-purple-400/50'
              : 'bg-[#231d40] hover:bg-[#2d2552] border border-[#3b3266] text-purple-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-purple-300 shrink-0" />
          <span className="hidden sm:inline">⚙️ API 설정 & 요금제</span>
        </button>

        {/* Project Name Indicator */}
        <div className="hidden lg:flex items-center space-x-2 bg-[#1b1731] border border-[#332c58] px-3 py-1 rounded-md text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300 font-medium max-w-[180px] truncate">{projectName}</span>
        </div>

        {/* Theme Toggle */}
        <button className="hidden sm:flex p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#201c3b] rounded-lg transition-colors">
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
              className="flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition shadow-md disabled:opacity-60 min-h-[40px]"
            >
              {isLoggingIn ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline">Google로 로그인</span>
            </button>
          )
        )}
      </div>
    </header>
  );
};
