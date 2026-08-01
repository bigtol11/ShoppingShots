import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, SceneItem } from '../types';
import { generateSrtSubtitles, downloadFile, downloadProjectManifest } from '../utils/exportUtils';
import { apiFetch } from '../utils/apiClient';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Share2,
  CheckCircle2,
  Sparkles,
  Film,
  FileText,
  Video,
  Copy,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface VideoPreviewPlayerProps {
  project: ProjectData;
  scenes: SceneItem[];
  focusSection?: 'thumbnail' | 'render' | 'metadata' | 'all';
  onRenderComplete?: (videoUrl: string) => void;
  onNextStep?: () => void;
}

export const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({
  project,
  scenes = [],
  focusSection = 'all',
  onRenderComplete,
  onNextStep
}) => {
  const safeScenes = scenes || [];
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRenderingMp4, setIsRenderingMp4] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStage, setRenderStage] = useState('');
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [usedFallbackMedia, setUsedFallbackMedia] = useState(false);

  const [activePlatform, setActivePlatform] = useState<'shorts' | 'tiktok' | 'reels' | 'naver'>('shorts');
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  // Real AI-generated SEO metadata (title/description/tags/pinned comment per platform) —
  // user-triggered only (same reasoning as the trend auto-recommend fix: don't fire a Gemini
  // call the user didn't ask for). Falls back to the static getPlatformMetadata() below until
  // generated, so nothing regresses if the user never clicks the button.
  const [aiSeoMetadata, setAiSeoMetadata] = useState<any>(null);
  const [isLoadingSeo, setIsLoadingSeo] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);

  const handleGenerateSeoMetadata = async () => {
    setIsLoadingSeo(true);
    setSeoError(null);
    try {
      const scriptText = project.scripts.find((s) => s.id === project.selectedScriptId)?.full_text || '';
      const res = await apiFetch('/api/seo/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: project.productInfo?.product_name || '추천 상품',
          scriptText,
          partnersUrl: project.productInfo?.source_url || ''
        })
      });
      const json = await res.json();
      if (json?.status === 'success' && json?.data) {
        setAiSeoMetadata(json.data);
      } else {
        setSeoError(json?.message || 'SEO 메타데이터 생성에 실패했습니다.');
      }
    } catch (err) {
      setSeoError('SEO 메타데이터 요청이 실패했습니다.');
    } finally {
      setIsLoadingSeo(false);
    }
  };

  // Maps this component's platform tab ids to the server response's platform keys
  const AI_PLATFORM_KEY: Record<'shorts' | 'tiktok' | 'reels' | 'naver', string> = {
    shorts: 'youtube_shorts',
    tiktok: 'tiktok',
    reels: 'instagram_reels',
    naver: 'naver_clip'
  };

  // Thumbnail A/B Copy selection
  const [selectedTitleOption, setSelectedTitleOption] = useState<'A' | 'B'>('A');
  const titleOptionA = `[쿠팡 1위] ${project.productInfo.product_name || '추천 상품'} - ${project.productInfo.verified_facts?.[0]?.claim || '특가 검증'}`;
  const titleOptionB = `🔥 이거 진짜 물건이네요! ${project.productInfo.product_name || '추천 상품'} 솔직 테스트`;

  const totalDuration = safeScenes.reduce((sum, s) => sum + s.duration, 0) || 18;
  const timerRef = useRef<any>(null);

  // Determine current active scene based on playback position
  let activeSceneIndex = 0;
  let accumulatedTime = 0;
  for (let i = 0; i < safeScenes.length; i++) {
    if (currentTime >= accumulatedTime && currentTime < accumulatedTime + safeScenes[i].duration) {
      activeSceneIndex = i;
      break;
    }
    accumulatedTime += safeScenes[i].duration;
  }
  const currentScene = safeScenes[activeSceneIndex] || safeScenes[0];

  // Playback Loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Real FFmpeg Render Call with Polling
  const handleRenderMp4 = async () => {
    setIsRenderingMp4(true);
    setRenderError(null);
    setUsedFallbackMedia(false);
    setRenderProgress(5);
    setRenderStage('FFmpeg 서버 인코딩 작업 등록 중...');

    try {
      const startRes = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes,
          audioConfig: project.audioConfig
        })
      });

      const startData = await startRes.json();
      const jobId = startData.jobId;

      if (!jobId) {
        throw new Error('렌더링 작업 ID를 받지 못했습니다.');
      }

      // Poll rendering status every 800ms
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/render-status/${jobId}`);
          const statusData = await statusRes.json();

          if (statusData?.job) {
            const { progress, stage, status, videoUrl, usedFallbackMedia: fellBack } = statusData.job;
            setRenderProgress(progress);
            setRenderStage(stage);

            if (status === 'error') {
              clearInterval(pollInterval);
              setIsRenderingMp4(false);
              setRenderError(stage || '렌더링 중 오류가 발생했습니다.');
              return;
            }

            if (status === 'completed') {
              clearInterval(pollInterval);
              setIsRenderingMp4(false);
              setUsedFallbackMedia(Boolean(fellBack));
              setRenderedVideoUrl(videoUrl);
              if (onRenderComplete && videoUrl) onRenderComplete(videoUrl);
            }
          }
        } catch (pollErr) {
          console.error(pollErr);
        }
      }, 800);
    } catch (err: any) {
      console.error(err);
      setIsRenderingMp4(false);
      setRenderError(err?.message || '렌더링 요청 전송에 실패했습니다.');
    }
  };

  const handleDownloadTxt = () => {
    const txt = safeScenes.map((s, idx) => `[장면 ${idx + 1} - ${s.subtitle}]\n나레이션: ${s.narration}\n`).join('\n');
    downloadFile(txt, `${project.name || 'shorts'}_narration.txt`, 'text/plain');
  };

  const handleDownloadSrt = () => {
    const srt = generateSrtSubtitles(safeScenes);
    downloadFile(srt, `${project.name || 'shorts'}_subtitles.srt`, 'text/plain');
  };

  // Platform Metadata Formatter
  const getPlatformMetadata = () => {
    const productName = project.productInfo?.product_name || '추천 상품';
    const killerFact = project.productInfo?.verified_facts?.[0]?.claim || '가성비 추천 아이템!';

    switch (activePlatform) {
      case 'shorts':
        return {
          title: `[쿠팡 1위] ${productName} - ${killerFact} #Shorts`,
          description: `⚡ 영상 속 추천 상품 바로가기 👉 고정 댓글 확인!\n\n${killerFact}\n\n#Shorts #쇼핑몰 #가성비추천 #내돈내산 #쿠팡추천템`,
          hashtags: '#Shorts #쿠팡추천템 #가성비세제 #쇼핑쇼츠'
        };
      case 'tiktok':
        return {
          title: `아직도 이거 안 쓰시는 분 계신가요? ${productName}`,
          description: `가성비 끝판왕 ${productName} 실제 테스트 💡\n프로필 링크에서 10% 추가 할인 확인해보세요!`,
          hashtags: '#틱톡쇼핑 #가성비추천 #꿀템추천 #살림꿀팁'
        };
      case 'reels':
        return {
          title: `🔥 알고리즘 탄 그 세제! ${productName}`,
          description: `${killerFact}\n댓글로 '링크' 달아주시면 구매링크를 디엠으로 보내드립니다! ✨`,
          hashtags: '#릴스 #쇼핑릴스 #자취꿀템 #내돈내산추천'
        };
      case 'naver':
        return {
          title: `네이버 클립 추천 - ${productName} 솔직 사용 후기`,
          description: `네이버 쇼핑 공식 인증 스펙 검증완료!\n${killerFact}`,
          hashtags: '#네이버클립 #쇼핑클립 #네이버쇼핑 #제품리뷰'
        };
    }
  };

  // Prefer real AI-generated metadata for the active platform once generated; otherwise
  // fall back to the static local templates so the section never shows empty content.
  const getAiMetaForPlatform = () => {
    if (!aiSeoMetadata) return null;
    const raw = aiSeoMetadata[AI_PLATFORM_KEY[activePlatform]];
    if (!raw) return null;
    const hashtagsArr: string[] = raw.hashtags || raw.tags || [];
    return {
      title: raw.title || '',
      description: raw.description || raw.caption || '',
      hashtags: hashtagsArr.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' '),
      pinned_comment: raw.pinned_comment as string | undefined
    };
  };
  const aiMeta = getAiMetaForPlatform();
  const currentMeta = aiMeta || getPlatformMetadata();

  const handleCopyMeta = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPlatform(label);
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 bg-[#0f0e17] text-slate-200 min-h-full">
      {/* Left 9:16 Vertical Video Player Frame (5 Cols) */}
      <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4">
        <div className="text-center space-y-1">
          <span className="text-[10px] bg-purple-900/80 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-700/50">
            9:16 VERTICAL SHORTS CANVAS
          </span>
          <h3 className="text-sm font-bold text-white">9:16 모바일 쇼츠 실시간 프리뷰</h3>
        </div>

        {/* Smartphone Viewport Box (1080x1920 scaled) — width caps at 280px but shrinks to fit
            narrow phones; aspect-ratio keeps the 9:16 proportions instead of a fixed height. */}
        <div className="w-[min(280px,85vw)] aspect-[9/16] bg-black rounded-3xl border-4 border-[#2d2948] overflow-hidden shadow-2xl relative flex flex-col justify-between select-none group">
          {/* Top Overlay Badge */}
          <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-center text-[10px] text-white/80 font-mono">
            <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20">
              {currentScene?.scene_id || 'S01'} ({currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s)
            </span>
            <span className="bg-purple-600/80 px-2 py-0.5 rounded-full font-bold">
              ShoppingShots
            </span>
          </div>

          {/* Media Visual Layer (Ken Burns effect for images) */}
          <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden flex items-center justify-center">
            {currentScene?.media_url ? (
              <img
                src={currentScene.media_url}
                alt={currentScene.subtitle}
                className={`w-full h-full object-cover transition-transform duration-[3000ms] ${
                  isPlaying ? 'scale-110 translate-y-1' : 'scale-100'
                }`}
              />
            ) : (
              <div className="text-center p-4">
                <Video className="w-12 h-12 text-purple-400 mx-auto mb-2 animate-bounce" />
                <p className="text-xs font-bold text-purple-200">{currentScene?.subtitle}</p>
                <p className="text-[10px] text-slate-400 mt-1">{currentScene?.required_visual}</p>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80"></div>
          </div>

          {/* Subtitle Overlay Layer (WCAG Mobile Safe Zone) */}
          <div className="absolute bottom-12 left-4 right-4 z-20 text-center space-y-1">
            <div className="bg-black/80 backdrop-blur-md border border-amber-400/40 px-3 py-1.5 rounded-xl shadow-xl inline-block max-w-[240px]">
              <p className="text-xs font-extrabold text-amber-300 tracking-tight leading-snug drop-shadow-md">
                {currentScene?.subtitle || '쇼핑쇼츠 자막 표시'}
              </p>
            </div>
          </div>

          {/* Bottom Progress Bar inside Phone */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-100"
              style={{ width: `${(currentTime / totalDuration) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Playback Controls Bar */}
        <div className="flex items-center space-x-3 bg-[#181628] border border-[#2d2948] p-2.5 rounded-xl">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={() => setCurrentTime(0)}
            className="p-2 bg-[#231f3d] hover:bg-[#2f2a52] text-slate-300 rounded-lg transition min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-300 px-2">
            {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Right Export & Output Package Panel (7 Cols) */}
      <div className="lg:col-span-7 space-y-5">
        {/* Step 6: Thumbnail & Copy CTR Section */}
        {(focusSection === 'thumbnail' || focusSection === 'all') && (
          <div className={`bg-[#181628] border rounded-2xl p-5 shadow-xl space-y-4 ${
            focusSection === 'thumbnail' ? 'border-purple-500 ring-1 ring-purple-500' : 'border-[#2d2948]'
          }`}>
            <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  워크플로우 6단계
                </span>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>6. 🖼️ 썸네일/CTR 카피 세팅</span>
                </h2>
              </div>
              <span className="text-xs bg-amber-950 text-amber-300 border border-amber-800/40 px-2.5 py-1 rounded font-bold">
                1:1 & 9:16 Split Ratio
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              시선을 사로잡는 좌/우 또는 위/아래 대비 썸네일 구도를 조합하고 CTR(클릭률)을 극대화할 A/B 테스트 제목 카피를 선택하세요.
            </p>

            {/* Split Composition Thumbnail Preview */}
            <div className="bg-[#121020] border border-[#272342] p-4 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-200 block">좌/우 대비 썸네일 구도 미리보기</span>
              <div className="w-full h-36 bg-black rounded-xl overflow-hidden border border-[#302a54] flex relative">
                {/* Left Split Image */}
                <div className="w-1/2 h-full relative border-r-2 border-amber-400 overflow-hidden">
                  <img
                    src={scenes[0]?.media_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80'}
                    alt="Left contrast"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                    사용 전 BEFORE
                  </div>
                </div>
                {/* Right Split Image */}
                <div className="w-1/2 h-full relative overflow-hidden">
                  <img
                    src={scenes[1]?.media_url || scenes[0]?.media_url || 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=800&auto=format&fit=crop&q=80'}
                    alt="Right contrast"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                    사용 후 AFTER
                  </div>
                </div>

                {/* Center Badge Overlay */}
                <div className="absolute inset-x-0 bottom-2 text-center">
                  <span className="bg-amber-400 text-black text-xs font-black px-3 py-1 rounded-full shadow-lg border border-amber-200">
                    🔥 3초의 혁신 검증!
                  </span>
                </div>
              </div>

              {/* CTR Title A/B Selector */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-purple-300 block">CTR 극대화 제목 카피 A/B 선택</span>
                <div className="space-y-2">
                  <div
                    onClick={() => setSelectedTitleOption('A')}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedTitleOption === 'A'
                        ? 'bg-[#251e47] border-purple-500 text-white shadow-md'
                        : 'bg-[#18152b] border-[#2b254d] text-slate-300 hover:border-purple-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.2 rounded border border-purple-800/40 font-mono">
                        A안 (검증 팩트형)
                      </span>
                      <p className="text-xs font-bold text-slate-100">{titleOptionA}</p>
                    </div>
                    {selectedTitleOption === 'A' && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
                  </div>

                  <div
                    onClick={() => setSelectedTitleOption('B')}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedTitleOption === 'B'
                        ? 'bg-[#251e47] border-purple-500 text-white shadow-md'
                        : 'bg-[#18152b] border-[#2b254d] text-slate-300 hover:border-purple-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-800/40 font-mono">
                        B안 (호기심 자극형)
                      </span>
                      <p className="text-xs font-bold text-slate-100">{titleOptionB}</p>
                    </div>
                    {selectedTitleOption === 'B' && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
                  </div>
                </div>
              </div>

              {onNextStep && focusSection === 'thumbnail' && (
                <button
                  onClick={onNextStep}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-1 mt-2"
                >
                  <span>다음 단계: 7. 🚀 렌더링/출고 진행</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 7: Render & Output Section */}
        {(focusSection === 'render' || focusSection === 'all') && (
          <div className={`bg-[#181628] border rounded-2xl p-5 shadow-xl space-y-4 ${
            focusSection === 'render' ? 'border-purple-500 ring-1 ring-purple-500' : 'border-[#2d2948]'
          }`}>
            <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  워크플로우 7단계
                </span>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Film className="w-4 h-4 text-emerald-400" />
                  <span>7. 🚀 비디오 렌더링 & 파일 출고</span>
                </h2>
              </div>
              <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800/40 px-2.5 py-1 rounded font-bold">
                1080x1920 (9:16) H.264 MP4
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              유튜브 쇼츠, 틱톡, 인스타그램 리얼스 최신 플랫폼 가이드라인(9:16, H.264 MP4, 1080x1920)에 맞춘 완성본 패키지를 합성하고 다운로드하세요.
            </p>

            {/* Render MP4 Progress Block */}
            <div className="bg-[#121020] border border-[#272342] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                  <Film className="w-4 h-4 text-purple-400" />
                  <span>FFmpeg 백엔드 9:16 MP4 파이프라인</span>
                </span>
                <span className="font-mono text-purple-300 font-bold">{renderProgress}%</span>
              </div>

              {renderStage && (
                <p className="text-[11px] font-mono text-emerald-400 bg-[#0c0a17] p-2 rounded border border-purple-900/40">
                  ⚡ {renderStage}
                </p>
              )}

              <div className="w-full bg-[#1e1b36] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${renderProgress}%` }}
                ></div>
              </div>

              <button
                onClick={handleRenderMp4}
                disabled={isRenderingMp4}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[48px]"
              >
                {isRenderingMp4 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>FFmpeg 비디오 인코딩 렌더링 중 ({renderProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>최종 9:16 MP4 쇼츠 렌더링 시작</span>
                  </>
                )}
              </button>

              {renderError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-200 leading-relaxed">
                  ⚠️ 렌더링 실패: {renderError}
                </div>
              )}

              {renderedVideoUrl && (
                <div className="space-y-2">
                  {usedFallbackMedia && (
                    <div className="p-2.5 bg-amber-950/50 border border-amber-800/50 rounded-xl text-[11px] text-amber-200">
                      ⚠️ 일부 장면의 미디어를 불러오지 못해 샘플 소스로 대체되었습니다. 스토리보드 단계에서 장면별 이미지/영상을 확인해 주세요.
                    </div>
                  )}
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-emerald-200 block">MP4 쇼츠 비디오 렌더링 완료!</span>
                        <span className="text-[10px] text-slate-400 font-mono">1080x1920 / AAC Audio</span>
                      </div>
                    </div>

                    <a
                      href={renderedVideoUrl}
                      download="shopping_shorts_1080x1920.mp4"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-lg font-bold flex items-center space-x-1 transition min-h-[40px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>MP4 파일 다운로드</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Downloads Section */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-200 block">원클릭 결과물 다운로드 항목</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <button
                  onClick={handleDownloadSrt}
                  className="bg-[#131122] hover:bg-[#201d38] border border-[#2d284e] p-3 rounded-xl text-left transition flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-purple-300 block">한국어 자막 (.SRT)</span>
                    <span className="text-[10px] text-slate-500">타임코드 완벽 동기화</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-purple-300" />
                </button>

                <button
                  onClick={handleDownloadTxt}
                  className="bg-[#131122] hover:bg-[#201d38] border border-[#2d284e] p-3 rounded-xl text-left transition flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-indigo-300 block">나레이션 대본 (.TXT)</span>
                    <span className="text-[10px] text-slate-500">장면별 대본 텍스트</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-300" />
                </button>

                <button
                  onClick={() => downloadProjectManifest(project)}
                  className="bg-[#131122] hover:bg-[#201d38] border border-[#2d284e] p-3 rounded-xl text-left transition flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-300 block">프로젝트 매니페스트 (.JSON)</span>
                    <span className="text-[10px] text-slate-500">전체 프로젝트 백업</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-300" />
                </button>
              </div>
            </div>

            {onNextStep && focusSection === 'render' && (
              <button
                onClick={onNextStep}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-1 mt-2"
              >
                <span>다음 단계: 8. 📲 플랫폼 메타데이터 카피</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </button>
            )}
          </div>
        )}

        {/* Step 8: Platform Metadata Section */}
        {(focusSection === 'metadata' || focusSection === 'all') && (
          <div className={`bg-[#181628] border rounded-2xl p-5 shadow-xl space-y-4 ${
            focusSection === 'metadata' ? 'border-purple-500 ring-1 ring-purple-500' : 'border-[#2d2948]'
          }`}>
            <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  워크플로우 8단계
                </span>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <span>8. 📲 플랫폼별 메타데이터 원클릭 카피</span>
                </h2>
              </div>
              <span className="text-xs bg-purple-950 text-purple-300 border border-purple-800/40 px-2.5 py-1 rounded font-bold">
                Auto Copy
              </span>
            </div>

            {/* Platform Auto-Formatter & One-Click Copy */}
            <div className="space-y-3 bg-[#121020] border border-[#272342] p-4 rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#272342] pb-2">
                <span className="text-xs font-bold text-purple-300">플랫폼 맞춤 카피 생성기</span>
                <span className="text-[10px] text-slate-400">쇼츠 / 틱톡 / 릴스 / 네이버클립</span>
              </div>

              {/* AI-generated metadata trigger — user-triggered, not auto-fired */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#18152b] border border-purple-800/40 p-2.5 rounded-xl">
                <span className="text-[11px] text-slate-400 leading-snug">
                  {aiSeoMetadata
                    ? '✅ AI가 최신 플랫폼 정책 기준으로 생성한 문구를 보고 있습니다.'
                    : '아래는 기본 템플릿입니다. AI로 플랫폼별 최신 SEO 문구를 생성할 수 있습니다.'}
                </span>
                <button
                  onClick={handleGenerateSeoMetadata}
                  disabled={isLoadingSeo}
                  className="bg-purple-700/80 hover:bg-purple-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 disabled:opacity-50 shrink-0"
                >
                  {isLoadingSeo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isLoadingSeo ? '생성 중...' : aiSeoMetadata ? '다시 생성' : 'AI로 SEO 문구 생성'}</span>
                </button>
              </div>

              {seoError && (
                <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-lg p-2">
                  ⚠️ {seoError}
                </div>
              )}

              {/* Platform Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'shorts', name: '🔴 YouTube Shorts' },
                  { id: 'tiktok', name: '🎵 TikTok' },
                  { id: 'reels', name: '📸 Instagram Reels' },
                  { id: 'naver', name: '🟢 Naver Clip' },
                ].map((plat) => (
                  <button
                    key={plat.id}
                    onClick={() => setActivePlatform(plat.id as any)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition border ${
                      activePlatform === plat.id
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-[#181528] text-slate-400 border-[#2b254d] hover:text-white'
                    }`}
                  >
                    {plat.name}
                  </button>
                ))}
              </div>

              {/* Platform Card Detail */}
              <div className="bg-[#18152b] p-3.5 rounded-xl border border-[#2e2854] space-y-3 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400 font-bold">권장 제목 (Title)</span>
                    <button
                      onClick={() => handleCopyMeta(selectedTitleOption === 'B' ? titleOptionB : currentMeta.title, '제목')}
                      className="text-[10px] bg-[#29224d] hover:bg-[#382f69] text-purple-200 px-2 py-0.5 rounded border border-purple-700/40 flex items-center space-x-1"
                    >
                      {copiedPlatform === '제목' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPlatform === '제목' ? '복사됨' : '복사'}</span>
                    </button>
                  </div>
                  <p className="bg-[#0f0d1c] p-2 rounded text-slate-200 font-semibold border border-[#272147]">
                    {selectedTitleOption === 'B' ? titleOptionB : currentMeta.title}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400 font-bold">설명 및 링크 안내문 (Description)</span>
                    <button
                      onClick={() => handleCopyMeta(currentMeta.description, '설명')}
                      className="text-[10px] bg-[#29224d] hover:bg-[#382f69] text-purple-200 px-2 py-0.5 rounded border border-purple-700/40 flex items-center space-x-1"
                    >
                      {copiedPlatform === '설명' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPlatform === '설명' ? '복사됨' : '복사'}</span>
                    </button>
                  </div>
                  <p className="bg-[#0f0d1c] p-2 rounded text-slate-300 font-mono whitespace-pre-line border border-[#272147]">
                    {currentMeta.description}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400 font-bold">추천 태그 (Hashtags)</span>
                    <button
                      onClick={() => handleCopyMeta(currentMeta.hashtags, '태그')}
                      className="text-[10px] bg-[#29224d] hover:bg-[#382f69] text-purple-200 px-2 py-0.5 rounded border border-purple-700/40 flex items-center space-x-1"
                    >
                      {copiedPlatform === '태그' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPlatform === '태그' ? '복사됨' : '복사'}</span>
                    </button>
                  </div>
                  <p className="bg-[#0f0d1c] p-2 rounded text-amber-300 font-mono border border-[#272147]">
                    {currentMeta.hashtags}
                  </p>
                </div>

                {aiMeta?.pinned_comment && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400 font-bold">고정 댓글 (Pinned Comment)</span>
                      <button
                        onClick={() => handleCopyMeta(aiMeta.pinned_comment!, '고정댓글')}
                        className="text-[10px] bg-[#29224d] hover:bg-[#382f69] text-purple-200 px-2 py-0.5 rounded border border-purple-700/40 flex items-center space-x-1"
                      >
                        {copiedPlatform === '고정댓글' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPlatform === '고정댓글' ? '복사됨' : '복사'}</span>
                      </button>
                    </div>
                    <p className="bg-[#0f0d1c] p-2 rounded text-emerald-300 font-mono whitespace-pre-line border border-[#272147]">
                      {aiMeta.pinned_comment}
                    </p>
                  </div>
                )}
              </div>

              {onNextStep && focusSection === 'metadata' && (
                <button
                  onClick={onNextStep}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-1 mt-2"
                >
                  <span>9. ⚙️ API 설정/요금제 이동</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

