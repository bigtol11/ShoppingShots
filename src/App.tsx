import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectData, ProductFacts, ScriptCandidate, SceneItem, AudioConfig, CompletedProject } from './types';
import { Header } from './components/Header';
import { StepNav } from './components/StepNav';
import { TrendBenchmarkingView } from './components/TrendBenchmarkingView';
import { ProductImportView } from './components/ProductImportView';
import { ScriptGeneratorView } from './components/ScriptGeneratorView';
import { StoryboardTimelineView } from './components/StoryboardTimelineView';
import { AudioStudioView } from './components/AudioStudioView';
import { VideoPreviewPlayer } from './components/VideoPreviewPlayer';
import { SettingsView } from './components/SettingsView';
import { ProjectsView } from './components/ProjectsView';
import { saveCompletedProject } from './utils/projectsStore';
import { signInWithGoogle } from './utils/firebaseAuth';
import { AlertTriangle, ArrowRight } from 'lucide-react';

// Factory (not a shared const) — every call returns fresh nested objects/arrays,
// so resetting mid-pipeline can never leak state from the discarded project via
// a shared array/object reference.
const makeEmptyProject = (): ProjectData => ({
  id: 'proj-new',
  name: '신규 쇼츠 프로젝트',
  updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  status: 'DRAFT',
  targetPlatform: 'youtube_shorts',
  targetDuration: 18,
  productInfo: {
    product_id: '',
    product_name: '',
    category_name: '',
    source_url: '',
    price: '',
    verified_facts: [],
    category_facts: [],
    use_cases: [],
    visual_features: [],
    prohibited_claims: [],
    search_terms: { ko: [], zh: [], en: [] },
    reviews_summary: { total_reviews: 0, key_points: [] }
  },
  scripts: [],
  scenes: [],
  clipCandidates: [],
  audioConfig: {
    voice_id: 'Kore',
    voice_name: 'Kore - 서연 / Seoyeon',
    voice_provider: 'gemini',
    gender: 'female',
    speed: 1.0,
    emotion_style: '밝고 자연스러운 쇼핑 전달 톤',
    bgm_id: 'upbeat_acoustic',
    bgm_volume: 0.15
  }
});

// 6-step core automation pipeline: trend -> product -> script -> storyboard -> audio -> render
const STEP_SEQUENCE = ['trend', 'product', 'script', 'storyboard', 'audio', 'render'];

export default function App() {
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.status === 'success' && data?.user) setAuthUser(data.user);
      })
      .catch(() => {})
      .finally(() => setIsAuthChecked(true));
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const idToken = await signInWithGoogle();
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (data?.status === 'success' && data?.user) {
        setAuthUser(data.user);
      } else {
        setAuthError(data?.message || '로그인에 실패했습니다.');
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError('구글 로그인에 실패했습니다.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthUser(null);
    }
  };

  const [activeStep, setActiveStep] = useState<string>('trend');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [project, setProject] = useState<ProjectData>(makeEmptyProject);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Discards all in-progress work (product/script/storyboard/audio/render state)
  // and returns to a blank step 1 — used by the "+ 새 쇼핑쇼츠 기획" reset button,
  // available from any step so the user isn't stuck mid-pipeline with something
  // they don't want to continue.
  const handleResetProject = () => {
    setProject(makeEmptyProject());
    setCompletedSteps([]);
    setValidationWarning(null);
    setActiveStep('trend');
    setIsResetConfirmOpen(false);
  };

  const markStepCompleted = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps((prev) => [...prev, stepId]);
    }
  };

  const [validationWarning, setValidationWarning] = useState<{
    step: string;
    message: string;
    nextStep: string;
  } | null>(null);

  const getStepMissingMessage = (step: string): string | null => {
    if (step === 'product') {
      if (!project.productInfo.source_url && !project.productInfo.product_name) {
        return '쿠팡 파트너스 링크 또는 상품 데이터가 아직 수집되지 않았습니다.';
      }
    } else if (step === 'script') {
      if (!project.selectedScriptId) {
        return '생성된 대본 후보 중 다음 단계에 적용할 쇼츠 대본이 선택되지 않았습니다.';
      }
    } else if (step === 'storyboard') {
      if (!project.scenes || project.scenes.length === 0) {
        return '스토리보드 장면이 아직 구성되지 않았습니다.';
      }
    }
    return null;
  };

  const handleNextStepFrom = (currentStep: string) => {
    markStepCompleted(currentStep);
    const currentIndex = STEP_SEQUENCE.indexOf(currentStep);
    if (currentIndex >= 0 && currentIndex < STEP_SEQUENCE.length - 1) {
      const nextStep = STEP_SEQUENCE[currentIndex + 1];

      const missingMsg = getStepMissingMessage(currentStep);
      if (missingMsg) {
        setValidationWarning({ step: currentStep, message: missingMsg, nextStep });
        return;
      }

      setActiveStep(nextStep);
    }
  };

  const confirmNextStepWarning = () => {
    if (validationWarning) {
      const { nextStep } = validationWarning;
      setValidationWarning(null);
      setActiveStep(nextStep);
    }
  };

  // Used only by the benchmark-video reverse-engineering flow: script + scenes were just
  // constructed together in the same handler and are known-valid, so this jumps straight to
  // audio instead of going through handleNextStepFrom('storyboard') — which re-validates
  // against `project` state that's still stale at this point in the same event handler
  // (setProject from the scripts/scenes updates hasn't re-rendered yet), and would
  // incorrectly show a "no script selected" warning right after applying one.
  const handleBenchmarkFlowComplete = () => {
    markStepCompleted('script');
    markStepCompleted('storyboard');
    setActiveStep('audio');
  };

  // State handlers
  const handleUpdateProductInfo = (newInfo: ProductFacts) => {
    setProject((prev) => ({
      ...prev,
      productInfo: newInfo,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    }));
    markStepCompleted('product');
  };

  const handleSelectScript = (script: ScriptCandidate) => {
    setProject((prev) => ({
      ...prev,
      selectedScriptId: script.id,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    }));
    markStepCompleted('script');
  };

  const handleUpdateScripts = (scripts: ScriptCandidate[]) => {
    setProject((prev) => ({
      ...prev,
      scripts,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    }));
  };

  const handleUpdateScenes = (scenes: SceneItem[]) => {
    setProject((prev) => ({
      ...prev,
      scenes,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    }));
    if (scenes.length > 0) markStepCompleted('storyboard');
  };

  const handleUpdateAudioConfig = (audioConfig: AudioConfig) => {
    setProject((prev) => ({
      ...prev,
      audioConfig,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    }));
    markStepCompleted('audio');
  };

  const handleSaveCompletedProject = (videoUrl: string) => {
    markStepCompleted('render');
    const completed: CompletedProject = {
      id: `proj_${Date.now()}`,
      title: project.scripts.find((s) => s.id === project.selectedScriptId)?.title || project.name,
      productName: project.productInfo.product_name || project.name,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      durationSec: project.scenes.reduce((sum, s) => sum + (s.duration || 0), 0),
      videoUrl,
      thumbnailUrl: project.scenes[0]?.media_url || videoUrl,
      fileSizeMb: 0,
      resolution: '1080x1920',
      fps: 30,
      srtContent: '',
      metaData: {
        youtubeTitle: project.productInfo.product_name || project.name,
        hashtags: [],
        description: ''
      },
      safetyScore: 0,
      safetyStatus: 'SAFE',
      complianceDetails: {
        exaggeratedPhrasesFixed: 0,
        coupangNoticeInserted: false,
        copyrightGrade: 'B',
        reusedContentRisk: 0
      }
    };
    saveCompletedProject(completed);
  };

  if (!isAuthChecked) {
    return <div className="min-h-screen w-full bg-[#0f0e17]" />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f0e17] text-slate-100 font-sans overflow-hidden">
      <Header
        activeTab={activeStep}
        setActiveTab={setActiveStep}
        projectName={project.productInfo.product_name || project.name}
        userEmail={authUser?.email}
        onLogout={handleLogout}
        onLogin={handleGoogleLogin}
        isLoggingIn={isLoggingIn}
        onNewProject={() => setIsResetConfirmOpen(true)}
      />

      <StepNav activeStep={activeStep} setActiveStep={setActiveStep} completedSteps={completedSteps} />

      {authError && (
        <div className="bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs px-4 py-2 flex items-center justify-between">
          <span>{authError}</span>
          <button onClick={() => setAuthError(null)} className="text-rose-300 hover:text-white px-2">✕</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 overflow-y-auto bg-[#0b0a12] relative min-w-0 w-full overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full min-h-full w-full max-w-full overflow-x-hidden"
            >
              {activeStep === 'trend' && (
                <TrendBenchmarkingView
                  onSelectTopic={(topic, keywords) => {
                    const coupangSearchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(topic)}`;
                    handleUpdateProductInfo({
                      ...project.productInfo,
                      product_name: topic,
                      source_url: coupangSearchUrl,
                      search_terms: {
                        ko: keywords && keywords.length > 0 ? keywords : [topic],
                        zh: [],
                        en: []
                      }
                    });
                    handleNextStepFrom('trend');
                  }}
                />
              )}

              {activeStep === 'product' && (
                <ProductImportView
                  productInfo={project.productInfo}
                  onUpdateProductInfo={handleUpdateProductInfo}
                  onNextStep={() => handleNextStepFrom('product')}
                  viewMode="input"
                />
              )}

              {activeStep === 'script' && (
                <ScriptGeneratorView
                  productInfo={project.productInfo}
                  scripts={project.scripts}
                  selectedScriptId={project.selectedScriptId}
                  targetDuration={project.targetDuration}
                  onSelectScript={handleSelectScript}
                  onUpdateScripts={handleUpdateScripts}
                  onNextStep={() => handleNextStepFrom('script')}
                />
              )}

              {activeStep === 'storyboard' && (
                <StoryboardTimelineView
                  scenes={project.scenes}
                  clipCandidates={project.clipCandidates}
                  onUpdateScenes={handleUpdateScenes}
                  onNextStep={() => handleNextStepFrom('storyboard')}
                  scriptText={project.scripts.find((s) => s.id === project.selectedScriptId)?.full_text}
                  targetDuration={project.targetDuration}
                  productName={project.productInfo.product_name}
                  onUpdateScripts={handleUpdateScripts}
                  onSelectScript={handleSelectScript}
                  onBenchmarkFlowComplete={handleBenchmarkFlowComplete}
                />
              )}

              {activeStep === 'audio' && (
                <AudioStudioView
                  audioConfig={project.audioConfig}
                  scenes={project.scenes}
                  onUpdateAudioConfig={handleUpdateAudioConfig}
                  onUpdateScenes={handleUpdateScenes}
                  onNextStep={() => handleNextStepFrom('audio')}
                  onOpenSettings={() => setActiveStep('settings')}
                />
              )}

              {activeStep === 'render' && (
                <VideoPreviewPlayer
                  project={project}
                  scenes={project.scenes}
                  focusSection="all"
                  onRenderComplete={handleSaveCompletedProject}
                />
              )}

              {activeStep === 'settings' && <SettingsView onSettingsUpdated={() => markStepCompleted('settings')} />}

              {activeStep === 'projects' && <ProjectsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {isResetConfirmOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a172c] border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center space-x-3 text-rose-400 border-b border-[#2d284e] pb-3">
                <div className="p-2 bg-rose-950/60 rounded-xl border border-rose-800/50">
                  <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">새 쇼핑쇼츠 기획을 시작할까요?</h3>
                  <span className="text-[11px] text-rose-300/80 font-medium">현재까지 진행한 내용은 되돌릴 수 없습니다</span>
                </div>
              </div>

              <div className="bg-[#121020] border border-[#2b254d] p-3.5 rounded-xl space-y-1 text-xs text-slate-300">
                <p className="leading-relaxed">
                  상품 정보, 생성된 대본, 스토리보드, 오디오 설정 등 현재 진행 중인 모든 내용이 초기화되고
                  1단계(트렌드 탐색)부터 새로 시작합니다. 이미 완성해서 저장한 영상은 "내 프로젝트"에
                  그대로 남아있으니 걱정하지 않으셔도 됩니다.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="flex-1 bg-[#231f3c] hover:bg-[#2e294f] text-slate-200 text-xs py-2.5 rounded-xl font-medium border border-[#3b3464] transition text-center"
                >
                  취소
                </button>
                <button
                  onClick={handleResetProject}
                  className="flex-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs py-2.5 rounded-xl font-bold shadow-md shadow-rose-900/40 flex items-center justify-center space-x-1 transition"
                >
                  <span>초기화하고 새로 시작</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {validationWarning && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a172c] border border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center space-x-3 text-amber-400 border-b border-[#2d284e] pb-3">
                <div className="p-2 bg-amber-950/60 rounded-xl border border-amber-800/50">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">권장 입력 항목 미충족 안내</h3>
                  <span className="text-[11px] text-amber-300/80 font-medium">안내 확인 후 바로 진행이 가능합니다</span>
                </div>
              </div>

              <div className="bg-[#121020] border border-[#2b254d] p-3.5 rounded-xl space-y-1 text-xs text-slate-300">
                <p className="leading-relaxed">{validationWarning.message}</p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setValidationWarning(null)}
                  className="flex-1 bg-[#231f3c] hover:bg-[#2e294f] text-slate-200 text-xs py-2.5 rounded-xl font-medium border border-[#3b3464] transition text-center"
                >
                  현재 단계에서 보완하기
                </button>
                <button
                  onClick={confirmNextStepWarning}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs py-2.5 rounded-xl font-bold shadow-md shadow-purple-900/40 flex items-center justify-center space-x-1 transition"
                >
                  <span>무시하고 진행하기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
