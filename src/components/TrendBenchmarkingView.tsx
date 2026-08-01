import React, { useState, useRef, useEffect } from 'react';
import { Flame, Sparkles, TrendingUp, ExternalLink, ArrowRight, Play, CheckCircle2, Search, Video, ChevronDown, X } from 'lucide-react';

interface TrendTopic {
  id: string;
  title: string;
  platform: string;
  estimated_views: string;
  hook_style: string;
  viral_points: string[];
  benchmark_url: string;
  recommended_keywords: string[];
}

interface TrendBenchmarkingViewProps {
  onSelectTopic: (topicTitle: string, keywords: string[]) => void;
}

const CATEGORY_PRESETS = [
  '주방 / 생활 아이디어',
  '생활 / 가전',
  '뷰티 / 화장품',
  '패션 / 잡화',
  '육아 / 출산용품',
  '스포츠 / 레저',
  '반려동물용품',
  '자동차용품',
  '건강 / 식품',
  '기타 (직접 입력)'
];

export const TrendBenchmarkingView: React.FC<TrendBenchmarkingViewProps> = ({ onSelectTopic }) => {
  const [category, setCategory] = useState<string>('주방 / 생활 아이디어');
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [keyword, setKeyword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const keywordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCategoryPreset = (preset: string) => {
    if (preset === '기타 (직접 입력)') {
      setCategory('');
    } else {
      setCategory(preset);
    }
    setIsCategoryOpen(false);
  };
  const [trends, setTrends] = useState<TrendTopic[]>([]);

  const handleAnalyzeTrends = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trends/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, keyword })
      });
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
        setTrends(json.data);
      }
    } catch (err) {
      console.error('Trend fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900/60 via-indigo-900/40 to-slate-900 border border-purple-500/30 p-6 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Flame className="w-48 h-48 text-purple-400" />
        </div>
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center space-x-2 bg-purple-950/80 border border-purple-500/40 px-3 py-1 rounded-full text-xs text-purple-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>탭 1: 🔥 트렌드 주제 & 벤치마킹 분석 엔진</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            바이럴 쇼핑 트렌드 실시간 탐색
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            카테고리와 키워드를 입력하면 조회수 100만 회 이상 폭발한 쇼핑쇼츠 주제, 후킹 패턴, 벤치마킹 소스를 자동 수집합니다.
          </p>
        </div>
      </div>

      {/* Input Controls */}
      <div className="bg-[#18152b] border border-[#2d284a] p-5 rounded-2xl space-y-4 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hybrid Category ComboBox / Dropdown */}
          <div className="relative" ref={categoryDropdownRef}>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              📦 카테고리 선택 / 직접 입력
            </label>
            <div className="relative">
              <input
                type="text"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (!isCategoryOpen) setIsCategoryOpen(true);
                }}
                onFocus={() => setIsCategoryOpen(true)}
                placeholder="카테고리 선택 또는 직접 입력"
                className="w-full bg-[#110e20] border border-[#342d59] rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-300 transition-colors p-1"
                tabIndex={-1}
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isCategoryOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#110e20] border border-purple-500/30 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-purple-950/40 custom-scrollbar backdrop-blur-md">
                {CATEGORY_PRESETS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectCategoryPreset(item)}
                    className={`w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-purple-600/30 hover:text-white transition-colors flex items-center justify-between ${
                      category === item ? 'bg-purple-900/40 font-bold text-purple-300' : ''
                    }`}
                  >
                    <span>{item}</span>
                    {category === item && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Keyword Input with Placeholder & Clear (X) Button */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              🔍 핵심 키워드 입력
            </label>
            <div className="relative">
              <input
                ref={keywordInputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 기름때 클리너, 무선 선풍기, 차량용 햇빛가리개"
                className="w-full bg-[#110e20] border border-[#342d59] rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              {keyword.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword('');
                    keywordInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors p-1"
                  title="초기화"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyzeTrends}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>실시간 바이럴 트렌드 알고리즘 분석 중...</span>
            </>
          ) : (
            <>
              <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>🔥 트렌드 주제 & 벤치마킹 AI 분석 실행</span>
            </>
          )}
        </button>
      </div>

      {/* Trend Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <span>수집된 바이럴 트렌드 주제 ({trends.length}건)</span>
          </h3>
          <span className="text-xs text-slate-400">원하는 주제를 선택하여 쿠팡 파트너스 팩트 수집으로 진행하세요.</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {trends.length === 0 ? (
            <div className="bg-[#141224] border border-[#272242] p-8 rounded-2xl text-center space-y-3">
              <Sparkles className="w-8 h-8 text-purple-400 mx-auto opacity-70 animate-pulse" />
              <p className="text-sm font-bold text-slate-200">탐색된 바이럴 트렌드가 없습니다.</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                상단의 [🔥 트렌드 주제 & 벤치마킹 AI 분석 실행] 버튼을 클릭하거나 관심 키워드를 입력하여 실시간 트렌드를 탐색해 보세요.
              </p>
            </div>
          ) : (
            trends.map((t) => (
            <div
              key={t.id}
              className="bg-[#18152b] border border-[#2f2854] hover:border-purple-500/60 p-5 rounded-2xl transition-all shadow-md hover:shadow-purple-950/40 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="bg-purple-950 text-purple-300 border border-purple-700/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {t.platform}
                  </span>
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                    예상 조회수 {t.estimated_views}
                  </span>
                </div>
                <button
                  onClick={() => onSelectTopic(t.title, t.recommended_keywords)}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 shadow-md"
                >
                  <span>이 주제로 제작 시작</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <h4 className="text-lg font-bold text-white">{t.title}</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="bg-[#120f23] p-3 rounded-xl border border-[#262045] space-y-1">
                  <span className="text-[11px] font-bold text-purple-300 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>3초 후킹 패턴</span>
                  </span>
                  <p className="text-xs text-slate-200">{t.hook_style}</p>
                </div>

                <div className="bg-[#120f23] p-3 rounded-xl border border-[#262045] space-y-1">
                  <span className="text-[11px] font-bold text-purple-300 flex items-center space-x-1">
                    <Video className="w-3 h-3 text-indigo-400" />
                    <span>바이럴 시각적 포인트</span>
                  </span>
                  <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
                    {t.viral_points.map((pt, idx) => (
                      <li key={idx} className="truncate">{pt}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#262142]/80 text-xs">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span>추천 연관 키워드:</span>
                  {t.recommended_keywords.map((kw, i) => (
                    <span key={i} className="bg-[#211b3d] text-slate-300 px-2 py-0.5 rounded text-[11px]">
                      #{kw}
                    </span>
                  ))}
                </div>

                <a
                  href={t.benchmark_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-[11px] font-medium flex items-center space-x-1"
                >
                  <span>벤치마킹 샘플 보기</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )))
        }</div>
      </div>
    </div>
  );
};
