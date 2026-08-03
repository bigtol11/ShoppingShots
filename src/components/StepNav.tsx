import React from 'react';
import { Flame, Link as LinkIcon, FileText, Film, Mic, PlayCircle, CheckCircle2 } from 'lucide-react';

interface StepNavProps {
  activeStep: string;
  setActiveStep: (step: string) => void;
  completedSteps?: string[];
}

const STEPS = [
  { id: 'trend', label: '트렌드', icon: Flame },
  { id: 'product', label: '상품등록', icon: LinkIcon },
  { id: 'script', label: '대본', icon: FileText },
  { id: 'storyboard', label: '스토리보드', icon: Film },
  { id: 'audio', label: '오디오', icon: Mic },
  { id: 'render', label: '렌더링', icon: PlayCircle }
];

// Single horizontal step bar replacing the old vertical left sidebar — all 6 pipeline
// steps in one row, numbered by position so no verbose labels are needed. Centered when
// it fits (desktop/tablet); horizontally scrollable when it doesn't (narrow phones).
export const StepNav: React.FC<StepNavProps> = ({ activeStep, setActiveStep, completedSteps = [] }) => {
  return (
    <nav className="bg-[#12111d] border-b border-[#2d2948] px-2 sm:px-4">
      <div className="flex items-center justify-center flex-nowrap gap-1.5 sm:gap-2.5 py-2.5 overflow-x-auto no-scrollbar">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          const isCompleted = completedSteps.includes(step.id);

          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 min-h-[44px] ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-400/50'
                  : isCompleted
                  ? 'bg-[#18152b] text-slate-100 border border-[#2e274f] hover:border-purple-600'
                  : 'text-slate-300 hover:text-white hover:bg-[#1a172e] border border-transparent'
              }`}
            >
              <span className={`font-mono text-xs ${isActive ? 'text-purple-200' : 'text-slate-500'}`}>{idx + 1}</span>
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-300'}`} />
              )}
              <span className="whitespace-nowrap">{step.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
