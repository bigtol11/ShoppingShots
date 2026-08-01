import React, { useState } from 'react';
import { SceneItem, ClipCandidate, SourceGrade } from '../types';
import { apiFetch } from '../utils/apiClient';
import {
  Film,
  Play,
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Video,
  Image as ImageIcon,
  Wand2,
  ChevronRight,
  Upload,
  CheckCircle2,
  Volume2,
  ZoomIn,
  Move,
  ArrowLeftRight,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Maximize2
} from 'lucide-react';

interface StoryboardTimelineViewProps {
  scenes: SceneItem[];
  clipCandidates: ClipCandidate[];
  onUpdateScenes: (scenes: SceneItem[]) => void;
  onNextStep: () => void;
  scriptText?: string;
  targetDuration?: number;
}

export const StoryboardTimelineView: React.FC<StoryboardTimelineViewProps> = ({
  scenes,
  clipCandidates,
  onUpdateScenes,
  onNextStep,
  scriptText,
  targetDuration = 18
}) => {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(scenes[0]?.scene_id || 'S01');
  const [isGeneratingAiPrompt, setIsGeneratingAiPrompt] = useState(false);
  const [isGeneratingFalVideo, setIsGeneratingFalVideo] = useState(false);
  const [falVideoError, setFalVideoError] = useState<string | null>(null);
  const [isPlayingMotion, setIsPlayingMotion] = useState(true);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);

  const activeScene = scenes.find((s) => s.scene_id === selectedSceneId) || scenes[0];

  // AI-generate the full scene breakdown from the selected script (Gemini scene-splitting)
  const handleGenerateStoryboard = async () => {
    if (!scriptText) {
      setStoryboardError('먼저 3단계에서 대본을 생성/선택해 주세요.');
      return;
    }
    setIsGeneratingStoryboard(true);
    setStoryboardError(null);
    try {
      const res = await apiFetch('/api/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText, targetDuration })
      });
      const data = await res.json();
      if (data?.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
        onUpdateScenes(data.data);
        setSelectedSceneId(data.data[0].scene_id);
      } else {
        setStoryboardError('스토리보드 생성에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch (err) {
      console.error('[Generate Storyboard Error]', err);
      setStoryboardError('스토리보드 생성 요청이 실패했습니다.');
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  // Call Server-to-Server fal.ai video generation route
  const handleGenerateFalVideo = async (scene: SceneItem) => {
    setIsGeneratingFalVideo(true);
    setFalVideoError(null);
    try {
      const response = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.ai_prompt || `Photorealistic 9:16 vertical commercial video clip: ${scene.required_visual}`,
          duration: Math.round(scene.duration) || 5
        })
      });

      const data = await response.json();

      if (data?.status === 'success' && data?.videoUrl) {
        handleSceneChange(scene.scene_id, {
          media_url: data.videoUrl,
          source_type: 'EXISTING',
          transition: 'HARD_CUT'
        });
      } else {
        setFalVideoError(data?.message || '시스템 영상 생성 서비스 점검 중입니다. 관리자에게 문의해 주세요.');
      }
    } catch (e) {
      setFalVideoError('시스템 영상 생성 서비스 점검 중입니다. 관리자에게 문의해 주세요.');
    } finally {
      setIsGeneratingFalVideo(false);
    }
  };

  const handleSceneChange = (id: string, updatedFields: Partial<SceneItem>) => {
    const updated = scenes.map((s) => (s.scene_id === id ? { ...s, ...updatedFields } : s));
    onUpdateScenes(updated);
  };

  const handleMoveScene = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === scenes.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const newScenes = [...scenes];
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIndex];
    newScenes[targetIndex] = temp;

    // Recalculate order & timecodes
    let currentTime = 0;
    const reordered = newScenes.map((s, idx) => {
      const start = currentTime;
      const end = currentTime + s.duration;
      currentTime = end;
      return {
        ...s,
        order: idx + 1,
        scene_id: `S0${idx + 1}`,
        start_time: start,
        end_time: end
      };
    });

    onUpdateScenes(reordered);
    setSelectedSceneId(temp.scene_id);
  };

  const handleAddScene = () => {
    const lastScene = scenes[scenes.length - 1];
    const newStart = lastScene ? lastScene.end_time : 0;
    const newOrder = scenes.length + 1;
    const newScene: SceneItem = {
      scene_id: `S0${newOrder}`,
      order: newOrder,
      start_time: newStart,
      end_time: newStart + 3.0,
      duration: 3.0,
      purpose: 'use_case',
      narration: '추가된 장면 나레이션을 입력하세요.',
      subtitle: '추가 자막 문구',
      required_visual: '제품 사용 시연 클로즈업',
      preferred_source_grade: 'A',
      source_type: 'PRODUCT_IMAGE',
      transition: 'KEN_BURNS',
      ken_burns_motion: 'ZOOM_IN',
      media_url: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?auto=format&fit=crop&w=600&q=80'
    };
    onUpdateScenes([...scenes, newScene]);
    setSelectedSceneId(newScene.scene_id);
  };

  const handleDeleteScene = (id: string) => {
    if (scenes.length <= 1) return;
    const filtered = scenes.filter((s) => s.scene_id !== id);
    onUpdateScenes(filtered);
    setSelectedSceneId(filtered[0].scene_id);
  };

  // Upload Custom Image/Video for scene - persisted server-side (not a blob: URL) so the
  // render pipeline's FFmpeg step can actually read the file later.
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);
  const handleMediaUpload = async (sceneId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    setUploadingSceneId(sceneId);
    try {
      const fileBase64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, fileName: file.name, mimeType: file.type })
      });
      const data = await res.json();

      if (data?.status === 'success' && data?.url) {
        handleSceneChange(sceneId, {
          media_url: data.url,
          source_type: isVideo ? 'EXISTING' : 'PRODUCT_IMAGE',
          transition: isVideo ? 'HARD_CUT' : 'KEN_BURNS',
          ken_burns_motion: isVideo ? 'NONE' : 'ZOOM_IN'
        });
      }
    } catch (err) {
      console.error('[Scene Media Upload Error]', err);
    } finally {
      setUploadingSceneId(null);
    }
  };

  // Call Veo AI prompt generator
  const handleGenerateAiPrompt = async (scene: SceneItem) => {
    setIsGeneratingAiPrompt(true);
    try {
      const response = await apiFetch('/api/generate-ai-video-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualDescription: scene.required_visual,
          productName: scene.narration
        })
      });
      const data = await response.json();
      if (data?.data?.veoPrompt) {
        handleSceneChange(scene.scene_id, {
          ai_prompt: data.data.veoPrompt,
          source_type: 'AI'
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAiPrompt(false);
    }
  };

  const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);

  // Return CSS animation class based on Ken Burns Motion selection
  const getKenBurnsClass = (motion?: string) => {
    switch (motion) {
      case 'ZOOM_IN':
        return 'animate-[pulse_3s_infinite_alternate] scale-125';
      case 'PAN_LEFT':
        return 'scale-125 -translate-x-3 transition-transform duration-[3000ms] ease-in-out';
      case 'PAN_RIGHT':
        return 'scale-125 translate-x-3 transition-transform duration-[3000ms] ease-in-out';
      case 'PAN_UP':
        return 'scale-125 -translate-y-3 transition-transform duration-[3000ms] ease-in-out';
      default:
        return 'scale-110';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 bg-[#0f0e17] text-slate-200 min-h-full">
      {/* Top Summary Bar */}
      <div className="lg:col-span-12 bg-[#181628] border border-[#2d2948] rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-900/60 border border-purple-700/50 p-2.5 rounded-xl">
            <Film className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>스토리보드 타임라인 & 멀티미디어 매처</span>
              <span className="text-xs font-mono bg-purple-950 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-800/40">
                총 {scenes.length}컷 / {totalDuration.toFixed(1)}초
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              장면별 미디어 자산을 업로드하거나, 정지 이미지를 9:16 Ken Burns 모션 비디오로 자동 변환하세요.
            </p>
          </div>
        </div>

        <button
          onClick={onNextStep}
          className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs px-5 py-3 rounded-xl font-bold shadow-lg shadow-purple-950/40 flex items-center justify-center space-x-2 transition min-h-[44px]"
        >
          <span>오디오 & 음성합성 단계로 이동</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {scenes.length === 0 && (
        <div className="lg:col-span-12 bg-[#181628] border border-purple-500/40 rounded-2xl p-6 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">아직 구성된 장면이 없습니다</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            선택한 대본을 AI가 장면 단위(훅-문제제기-제품소개-사용법-CTA)로 자동 분해해 드립니다.
          </p>
          <button
            onClick={handleGenerateStoryboard}
            disabled={isGeneratingStoryboard || !scriptText}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-purple-950/40 inline-flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            <span>{isGeneratingStoryboard ? 'AI 스토리보드 생성 중...' : 'AI로 스토리보드 자동 생성'}</span>
          </button>
          {!scriptText && (
            <p className="text-[11px] text-amber-300">먼저 3단계에서 대본을 생성/선택해야 합니다.</p>
          )}
          {storyboardError && <p className="text-[11px] text-rose-300">{storyboardError}</p>}
        </div>
      )}

      {/* Left Cut Sequence List (5 Cols) */}
      <div className="lg:col-span-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">장면 시퀀스 타임라인</span>
          <button
            onClick={handleAddScene}
            className="text-xs bg-[#241e45] hover:bg-[#322961] text-purple-200 border border-purple-500/30 px-3 py-1.5 rounded-lg flex items-center space-x-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>장면 추가</span>
          </button>
        </div>

        <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
          {scenes.map((scene, index) => {
            const isSelected = selectedSceneId === scene.scene_id;

            return (
              <div
                key={scene.scene_id}
                onClick={() => setSelectedSceneId(scene.scene_id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer relative flex items-center space-x-3 ${
                  isSelected
                    ? 'bg-[#1e193b] border-purple-500 shadow-md ring-1 ring-purple-500'
                    : 'bg-[#121020] border-[#272342] hover:border-purple-800'
                }`}
              >
                {/* Scene Sequence Control */}
                <div className="flex flex-col space-y-1 text-slate-500">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveScene(index, 'UP');
                    }}
                    disabled={index === 0}
                    className="p-1 hover:text-purple-300 disabled:opacity-30"
                  >
                    <MoveUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveScene(index, 'DOWN');
                    }}
                    disabled={index === scenes.length - 1}
                    className="p-1 hover:text-purple-300 disabled:opacity-30"
                  >
                    <MoveDown className="w-3 h-3" />
                  </button>
                </div>

                {/* Scene Preview Image */}
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-black shrink-0 relative border border-[#302a52]">
                  {scene.media_url ? (
                    <img
                      src={scene.media_url}
                      alt={scene.subtitle}
                      className={`w-full h-full object-cover ${getKenBurnsClass(scene.ken_burns_motion)}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600 font-mono">
                      9:16
                    </div>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/80 text-[9px] text-center font-mono text-purple-300 py-0.5">
                    {scene.duration}s
                  </span>
                </div>

                {/* Scene Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-purple-300 font-mono">
                        {scene.scene_id}
                      </span>
                      <span className="text-[10px] bg-[#28214b] text-indigo-200 px-2 py-0.5 rounded font-semibold border border-purple-800/40">
                        {scene.purpose}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      scene.preferred_source_grade === 'A'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                        : scene.preferred_source_grade === 'B'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                    }`}>
                      {scene.preferred_source_grade}등급
                    </span>
                  </div>

                  <p className="text-xs font-medium text-white truncate">{scene.subtitle}</p>
                  <p className="text-[11px] text-slate-400 truncate">{scene.narration}</p>
                </div>

                {/* Delete button */}
                {scenes.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteScene(scene.scene_id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Scene Detail & Ken Burns Motion Matcher (7 Cols) */}
      <div className="lg:col-span-7 space-y-4">
        {activeScene && (
          <div className="bg-[#181628] border border-[#2d2948] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
              <div className="flex items-center space-x-2">
                <span className="bg-purple-600 text-white font-bold text-xs px-2.5 py-1 rounded">
                  {activeScene.scene_id} 미디어 & 모션 매칭
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {activeScene.start_time.toFixed(1)}s ~ {activeScene.end_time.toFixed(1)}s ({activeScene.duration}초)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">소스 권장 등급:</span>
                <select
                  value={activeScene.preferred_source_grade}
                  onChange={(e) =>
                    handleSceneChange(activeScene.scene_id, {
                      preferred_source_grade: e.target.value as SourceGrade
                    })
                  }
                  className="bg-[#110f1e] border border-[#2d284e] text-xs text-purple-200 rounded px-2 py-1 font-bold focus:outline-none"
                >
                  <option value="A">A등급 (직접 증명)</option>
                  <option value="B">B등급 (제품군 설명)</option>
                  <option value="C">C등급 (상황 보조용)</option>
                </select>
              </div>
            </div>

            {/* Media Upload & Ken Burns Motion Box */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#121020] border border-[#272342] p-4 rounded-xl">
              {/* 9:16 Interactive Ken Burns Motion Live Preview Box */}
              <div className="md:col-span-5 flex flex-col items-center justify-center space-y-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  9:16 모션 비디오 라이브 프리뷰
                </span>

                <div className="w-[140px] h-[248px] bg-black rounded-xl overflow-hidden border-2 border-purple-500/50 shadow-xl relative flex items-center justify-center group">
                  {activeScene.media_url ? (
                    <img
                      src={activeScene.media_url}
                      alt={activeScene.subtitle}
                      className={`w-full h-full object-cover ${getKenBurnsClass(activeScene.ken_burns_motion)}`}
                    />
                  ) : (
                    <div className="p-2 text-center">
                      <ImageIcon className="w-8 h-8 text-purple-400 mx-auto mb-1 animate-pulse" />
                      <span className="text-[10px] text-slate-400">미디어 미배치</span>
                    </div>
                  )}

                  {/* Overlay Subtitle badge */}
                  <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-sm p-1 rounded text-center">
                    <p className="text-[10px] text-amber-300 font-bold truncate">
                      {activeScene.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="md:col-span-7 space-y-3 flex flex-col justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">
                    장면 미디어 업로드 및 소스 종류
                  </label>
                  <div className="flex items-center space-x-2">
                    <label className="flex-1 cursor-pointer bg-[#1b1736] hover:bg-[#28224e] border border-purple-600/40 text-purple-200 text-xs py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 min-h-[44px]">
                      <Upload className="w-4 h-4 text-purple-400" />
                      <span>이미지/영상 파일 선택</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => handleMediaUpload(activeScene.scene_id, e)}
                        className="hidden"
                      />
                    </label>

                    <select
                      value={activeScene.source_type}
                      onChange={(e) =>
                        handleSceneChange(activeScene.scene_id, {
                          source_type: e.target.value as any
                        })
                      }
                      className="bg-[#110f1e] border border-[#2d284e] text-xs text-purple-200 rounded-xl px-2.5 py-2.5 font-bold focus:outline-none min-h-[44px]"
                    >
                      <option value="PRODUCT_IMAGE">상품 정지 이미지</option>
                      <option value="EXISTING">기존 영상 소스</option>
                      <option value="AI">AI 모션 생성</option>
                    </select>
                  </div>
                </div>

                {/* 9:16 Ken Burns Motion Selector */}
                {activeScene.source_type === 'PRODUCT_IMAGE' && (
                  <div className="space-y-1.5 bg-[#18152b] p-3 rounded-xl border border-[#2d2752]">
                    <span className="text-xs font-bold text-purple-300 flex items-center space-x-1">
                      <Move className="w-3.5 h-3.5" />
                      <span>정지 이미지 ➔ 9:16 Pan & Zoom 모션 엔진</span>
                    </span>
                    <p className="text-[10px] text-slate-400">
                      정지 이미지에 시선 유도용 화면 움직임을 자동 부여합니다.
                    </p>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {[
                        { id: 'ZOOM_IN', name: '서서히 확대 (Zoom In)', icon: ZoomIn },
                        { id: 'PAN_LEFT', name: '좌측 스캔 (Pan Left)', icon: ArrowLeftRight },
                        { id: 'PAN_RIGHT', name: '우측 스캔 (Pan Right)', icon: ArrowLeftRight },
                        { id: 'PAN_UP', name: '상단 틸트 (Pan Up)', icon: ArrowUpDown },
                      ].map((m) => {
                        const isSel = (activeScene.ken_burns_motion || 'ZOOM_IN') === m.id;
                        const IconComponent = m.icon;

                        return (
                          <button
                            key={m.id}
                            onClick={() =>
                              handleSceneChange(activeScene.scene_id, {
                                ken_burns_motion: m.id as any,
                                transition: 'KEN_BURNS'
                              })
                            }
                            className={`p-2 rounded-lg border text-left text-[11px] font-bold flex items-center space-x-1.5 transition ${
                              isSel
                                ? 'bg-purple-600 border-purple-400 text-white'
                                : 'bg-[#110e1e] border-[#292348] text-slate-300 hover:border-purple-700'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{m.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Clip Candidates quick matcher */}
                {clipCandidates.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      추천 수집 영상 클립 선택
                    </label>
                    <div className="flex space-x-2 overflow-x-auto pb-1">
                      {clipCandidates.map((clip) => (
                        <button
                          key={clip.clip_id}
                          onClick={() =>
                            handleSceneChange(activeScene.scene_id, {
                              selected_clip_id: clip.clip_id,
                              media_url: clip.thumbnail_url,
                              source_type: 'EXISTING'
                            })
                          }
                          className="shrink-0 p-1 bg-[#121020] border border-[#272342] hover:border-purple-500 rounded-lg text-left"
                        >
                          <img
                            src={clip.thumbnail_url}
                            alt={clip.title}
                            className="w-16 h-12 object-cover rounded mb-0.5"
                          />
                          <p className="text-[9px] font-mono text-purple-300 w-16 truncate">{clip.title}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Narration & Subtitle Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  나레이션 대본
                </label>
                <textarea
                  value={activeScene.narration}
                  onChange={(e) => handleSceneChange(activeScene.scene_id, { narration: e.target.value })}
                  rows={2}
                  className="w-full bg-[#110e1c] border border-[#272342] rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  9:16 화면 자막 문구 (SRT 자막)
                </label>
                <input
                  type="text"
                  value={activeScene.subtitle}
                  onChange={(e) => handleSceneChange(activeScene.scene_id, { subtitle: e.target.value })}
                  className="w-full bg-[#110e1c] border border-[#272342] rounded-lg px-3 py-2 text-xs text-emerald-300 font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Visual Specs & AI Prompting */}
            <div className="bg-[#121020] border border-[#272342] p-4 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  <span>장면 비주얼 요구사항 & AI 비디오 파이프라인</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleGenerateAiPrompt(activeScene)}
                    disabled={isGeneratingAiPrompt}
                    className="bg-purple-800/60 hover:bg-purple-700 text-purple-200 border border-purple-600/40 text-[11px] px-3 py-1.5 rounded-xl font-medium transition flex items-center space-x-1 min-h-[40px]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                    <span>Veo 프롬프트 생성</span>
                  </button>
                  <button
                    onClick={() => handleGenerateFalVideo(activeScene)}
                    disabled={isGeneratingFalVideo}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[11px] px-3 py-1.5 rounded-xl font-bold shadow transition flex items-center space-x-1 min-h-[40px] disabled:opacity-50"
                  >
                    <Video className="w-3.5 h-3.5 text-purple-100" />
                    <span>{isGeneratingFalVideo ? 'AI 비디오 생성 중...' : '3초 AI 비디오 클립 생성'}</span>
                  </button>
                </div>
              </div>

              {falVideoError && (
                <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center space-x-2">
                  <Video className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{falVideoError}</span>
                </div>
              )}

              <input
                type="text"
                value={activeScene.required_visual}
                onChange={(e) => handleSceneChange(activeScene.scene_id, { required_visual: e.target.value })}
                placeholder="요구 시각 요소 (e.g. 오렌지 오일 세제 거품 클로즈업)"
                className="w-full bg-[#181528] border border-[#2f2a52] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
              />

              {activeScene.ai_prompt && (
                <div className="space-y-1">
                  <span className="text-[10px] text-purple-400 font-mono block">생성된 AI 프롬프트 (English)</span>
                  <p className="text-[11px] font-mono bg-[#0a0812] text-purple-200 p-2.5 rounded-lg border border-purple-900/50 leading-relaxed">
                    {activeScene.ai_prompt}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
