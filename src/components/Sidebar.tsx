import React from 'react';
import {
  Flame,
  Link,
  FileText,
  Film,
  Mic,
  PlayCircle,
  Settings,
  CheckCircle2,
  X,
  FolderKanban
} from 'lucide-react';

interface SidebarProps {
  activeStep: string;
  setActiveStep: (step: string) => void;
  completedSteps?: string[];
  sceneCount?: number;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const STEPS = [
  { id: 'trend', label: '1. 🔥 트렌드 주제/벤치마킹', icon: Flame, badge: 'AI 탐색' },
  { id: 'product', label: '2. 🔗 쿠팡 파트너스/팩트', icon: Link, badge: '쿠팡' },
  { id: 'script', label: '3. 📝 후킹대본 생성', icon: FileText, badge: 'AI 3안' },
  { id: 'storyboard', label: '4. 🎬 스토리보드 & 미디어', icon: Film, badge: 'AI 영상' },
  { id: 'audio', label: '5. 🎙️ 오디오/TTS', icon: Mic, badge: 'SRT동기' },
  { id: 'render', label: '6. 🚀 렌더링 & 출고', icon: PlayCircle, badge: 'MP4' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeStep,
  setActiveStep,
  completedSteps = [],
  isMobileOpen = false,
  onMobileClose,
}) => {
  const totalCoreSteps = STEPS.length;
  const completedCount = completedSteps.filter((s) => s !== 'settings' && s !== 'projects').length;
  const progressPercent = Math.round((completedCount / totalCoreSteps) * 100) || 0;

  const handleSelect = (stepId: string) => {
    setActiveStep(stepId);
    onMobileClose?.();
  };

  // Shared nav content — rendered once inside the static desktop rail, once inside the mobile drawer.
  const navContent = (
    <>
      <div>
        <div className="flex items-center justify-between px-2 mb-2.5">
          <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider">
            쇼핑쇼츠 자동화 파이프라인
          </span>
          <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/60 px-1.5 py-0.5 rounded font-mono">
            v4.0
          </span>
        </div>

        <nav className="space-y-1">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const isCompleted = completedSteps.includes(step.id);

            return (
              <button
                key={step.id}
                onClick={() => handleSelect(step.id)}
                className={`w-full flex items-center justify-between px-3 py-3 lg:py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-purple-950/60 ring-1 ring-purple-400/50'
                    : isCompleted
                    ? 'bg-[#18152b] text-slate-200 border border-[#2e274f] hover:border-purple-600'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a172e]'
                }`}
              >
                <div className="flex items-center space-x-2 truncate mr-1">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  )}
                  <span className="truncate">{step.label}</span>
                </div>

                {step.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                      isActive
                        ? 'bg-purple-950 text-purple-100 border border-purple-400/40'
                        : isCompleted
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                        : 'bg-[#1e1b36] text-slate-400 border border-[#2d294d]'
                    }`}
                  >
                    {step.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings Action Button & Progress Footer */}
      <div className="space-y-2 mt-2">
        {/* Only reachable via the header's own nav from md breakpoint up — shown here too so
            phone-width users (below md) have a way to reach it via the drawer. */}
        <button
          onClick={() => handleSelect('projects')}
          className={`lg:hidden w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all border min-h-[44px] ${
            activeStep === 'projects'
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white border-purple-400 ring-2 ring-purple-500/50 shadow-lg'
              : 'bg-[#19152e] hover:bg-[#221c3e] text-purple-200 border-[#312957]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <FolderKanban className="w-4 h-4 text-purple-400" />
            <span>📁 내 프로젝트</span>
          </div>
        </button>

        <button
          onClick={() => handleSelect('settings')}
          className={`w-full flex items-center justify-between px-3 py-3 lg:py-2.5 rounded-xl text-xs font-bold transition-all border min-h-[44px] ${
            activeStep === 'settings'
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white border-purple-400 ring-2 ring-purple-500/50 shadow-lg'
              : 'bg-[#19152e] hover:bg-[#221c3e] text-purple-200 border-[#312957]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-purple-400" />
            <span>⚙️ API 키 & 요금제 설정</span>
          </div>
          <span className="text-[9px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/60 font-mono">
            Key
          </span>
        </button>

        <div className="bg-[#181528] border border-[#2c2748] p-3 rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="font-bold">파이프라인 진행률</span>
            <span className="font-mono font-bold text-emerald-400">{progressPercent}%</span>
          </div>
          <div className="w-full bg-[#272342] h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 via-indigo-400 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            {completedCount === totalCoreSteps
              ? '✅ 완제품 MP4 비디오 출고 완료!'
              : `${completedCount}/${totalCoreSteps}단계 완료 (순차 진행)`}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: static left rail */}
      <aside className="hidden lg:flex w-60 bg-[#12111d] border-r border-[#2d2948] p-3 flex-col justify-between shrink-0 select-none">
        {navContent}
      </aside>

      {/* Mobile: slide-in drawer + backdrop, triggered by the header's hamburger button */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-[82%] max-w-[320px] bg-[#12111d] border-r border-[#2d2948] p-3 flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-[#2d2948]">
              <span className="text-xs font-bold text-white">메뉴</span>
              <button
                onClick={onMobileClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-[#201c3b] rounded-lg transition-colors"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
