import React, { useState } from 'react';
import { ProductFacts, ScriptCandidate } from '../types';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  ChevronRight,
  Sliders,
  MessageSquare,
  Clock,
  ShieldCheck,
  Check
} from 'lucide-react';

interface ScriptGeneratorViewProps {
  productInfo: ProductFacts;
  scripts: ScriptCandidate[];
  selectedScriptId?: string;
  targetDuration: number;
  onSelectScript: (script: ScriptCandidate) => void;
  onUpdateScripts: (scripts: ScriptCandidate[]) => void;
  onNextStep: () => void;
}

export const ScriptGeneratorView: React.FC<ScriptGeneratorViewProps> = ({
  productInfo,
  scripts,
  selectedScriptId,
  targetDuration,
  onSelectScript,
  onUpdateScripts,
  onNextStep
}) => {
  const [selectedStyle, setSelectedStyle] = useState('인스타 생활설득형');
  const [hasDialogueFormat, setHasDialogueFormat] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);

  const styleOptions = [
    {
      id: '인스타 생활설득형',
      title: '인스타 생활설득형',
      desc: '내돈내산 후기·생활 불편·댓글 후킹',
    },
    {
      id: '썰쇼츠형',
      title: '썰쇼츠형',
      desc: '질문-반전-스토리텔링으로 상품 연결',
    },
    {
      id: '글로벌 인사이트형',
      title: '글로벌 인사이트형',
      desc: '해외 사례·비즈니스 로직 해설',
    },
    {
      id: '인테리어 전문가형',
      title: '인테리어 전문가형',
      desc: '배치·동선·집의 급 설득',
    },
    {
      id: '공간 기운 설계형',
      title: '공간 기운 설계형',
      desc: '현대 풍수·안정감·복 이미지',
    },
    {
      id: '살림,생활 직설형',
      title: '살림,생활 직설형',
      desc: '훈수형 후킹·가성비·살림/생활 꿀팁',
    },
    {
      id: '기획 천재 발견형',
      title: '기획 천재 발견형',
      desc: '불편 해결·제품 기획 감탄',
    },
    {
      id: '심리자극형',
      title: '심리자극형',
      desc: '우월감·보상 심리·변화된 나',
    },
  ];

  const handleGenerateScript = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFacts: productInfo,
          targetDuration,
          selectedStyle,
          additionalInstructions
        })
      });

      const data = await response.json();
      if (data?.data && Array.isArray(data.data)) {
        onUpdateScripts(data.data);
        if (data.data.length > 0) {
          onSelectScript(data.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptId(id);
    setTimeout(() => setCopiedScriptId(null), 2000);
  };

  return (
    <div className="p-4 md:p-6 bg-[#0f0e17] text-slate-200 min-h-full space-y-5 overflow-x-hidden w-full max-w-full">
      {/* Top Banner / Step Header */}
      <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-4 md:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">3단계: 📝 쇼핑 쇼츠 대본 생성 & 선택</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            원하는 마케팅 콘셉트를 선택하고 15~30초 쇼츠 맞춤형 쇼핑 대본을 생성 및 선택하세요.
          </p>
        </div>

        <button
          onClick={() => {
            if (!selectedScriptId && scripts.length > 0) {
              onSelectScript(scripts[0]);
            }
            onNextStep();
          }}
          className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs px-5 py-2.5 rounded-xl font-bold shadow-md shadow-purple-900/50 flex items-center justify-center space-x-2 transition shrink-0"
        >
          <span>4단계 오디오/TTS 스튜디오로 이동</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Settings Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  대본 생성 엔진
                </span>
                <h2 className="text-base font-bold text-white">쇼핑 쇼츠 대본 생성</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">15~30초 최적화</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              주제/시나리오와 수집된 상품 JSON 팩트를 바탕으로 환각 없는 쇼핑쇼츠 대본을 3가지 콘셉트로 자동 생성합니다.
            </p>

            {/* Style Selector Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 block">대본 스타일 선택</label>
              <div className="grid grid-cols-2 gap-2">
                {styleOptions.map((opt) => {
                  const isSelected = selectedStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedStyle(opt.id)}
                      className={`p-2.5 rounded-lg border text-left transition relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#28214c] border-purple-500 text-white shadow-md shadow-purple-950/50'
                          : 'bg-[#121020] border-[#292446] text-slate-300 hover:border-purple-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.title}</span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-purple-400"></span>}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dialogue Format Toggle */}
            <div className="flex items-center justify-between bg-[#121020] border border-[#272342] p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">화자 대사 형식</span>
                  <span className="text-[10px] text-slate-400">2인 이상의 화자 대화 모드로 세팅</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasDialogueFormat}
                onChange={(e) => setHasDialogueFormat(e.target.checked)}
                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
              />
            </div>

            {/* Additional Instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">추가 지시사항 (선택)</label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="타깃 연령, 금지 표현, 톤앤매너 보정 등 추가 지시사항을 입력하세요."
                rows={3}
                className="w-full bg-[#110e1c] border border-[#272342] rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateScript}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>대본 3안 생성 중 (Gemini 3.6 Flash)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>쇼핑 대본 생성</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Script Candidates Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <h2 className="text-base font-bold text-white">생성된 대본 후보 목록</h2>
              </div>
            </div>

            <div className="space-y-4">
              {scripts.map((script) => {
                const isSelected = selectedScriptId === script.id;

                return (
                  <div
                    key={script.id}
                    onClick={() => onSelectScript(script)}
                    className={`border rounded-xl p-4 transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#1d1838] border-purple-500 shadow-xl shadow-purple-950/60 ring-1 ring-purple-500'
                        : 'bg-[#121020] border-[#292446] hover:border-purple-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="bg-purple-900/80 text-purple-200 text-xs px-2.5 py-0.5 rounded-md font-bold border border-purple-700/50">
                          {script.style}
                        </span>
                        <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>예상 {script.target_duration_sec}초</span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText(script.id, script.full_text);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white bg-[#201c38] rounded-md transition"
                          title="대본 복사"
                        >
                          {copiedScriptId === script.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {isSelected ? (
                          <span className="bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>선택됨</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 hover:text-purple-300">선택하기</span>
                        )}
                      </div>
                    </div>

                    {/* Hook Type Badge */}
                    <div className="mb-2">
                      <span className="text-[10px] bg-[#221c3d] text-indigo-300 px-2 py-0.5 rounded border border-[#3b3263]">
                        후킹 패턴: {script.hook_type}
                      </span>
                    </div>

                    {/* Full Script Text */}
                    <p className="text-xs text-slate-200 leading-relaxed font-sans bg-[#0c0a15] p-3 rounded-lg border border-[#231f3b] mb-3">
                      {script.full_text}
                    </p>

                    {/* Fact & Safety Badges */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#231f3b]">
                      <span className="flex items-center space-x-1 text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>과장광고 안심 필터 통과 (신뢰도 {Math.round(script.confidence_score * 100)}%)</span>
                      </span>
                      <span className="text-slate-500">글자 수: {script.full_text.length}자</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Next Step Button */}
            <div className="pt-3 border-t border-[#2d2948] flex justify-end">
              <button
                onClick={() => {
                  if (!selectedScriptId && scripts.length > 0) {
                    onSelectScript(scripts[0]);
                  }
                  onNextStep();
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-950/60 flex items-center justify-center space-x-2 transition"
              >
                <span>🎙️ 4단계: 오디오/TTS 스튜디오로 이동</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
