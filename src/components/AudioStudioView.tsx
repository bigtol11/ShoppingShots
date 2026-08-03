import React, { useState } from 'react';
import { AudioConfig, SceneItem } from '../types';
import { generateSrtSubtitles, downloadFile } from '../utils/exportUtils';
import { apiFetch } from '../utils/apiClient';
import {
  Volume2,
  Mic,
  Play,
  Pause,
  Sparkles,
  RefreshCw,
  FileText,
  Music,
  Download,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Upload,
  Check,
  RotateCcw
} from 'lucide-react';

interface AudioStudioViewProps {
  audioConfig: AudioConfig;
  scenes: SceneItem[];
  onUpdateAudioConfig: (config: AudioConfig) => void;
  onUpdateScenes: (scenes: SceneItem[]) => void;
  onNextStep: () => void;
  onOpenSettings?: () => void;
}

export const AudioStudioView: React.FC<AudioStudioViewProps> = ({
  audioConfig,
  scenes,
  onUpdateAudioConfig,
  onUpdateScenes,
  onNextStep,
  onOpenSettings
}) => {
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [showSrtModal, setShowSrtModal] = useState(false);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<string | null>(null);
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);

  const [hasTypecastKey, setHasTypecastKey] = useState(false);
  const [hasElevenlabsKey, setHasElevenlabsKey] = useState(false);

  const [typecastActors, setTypecastActors] = useState<any[]>([]);
  const [elevenlabsVoices, setElevenlabsVoices] = useState<any[]>([]);
  const [typecastSearchQuery, setTypecastSearchQuery] = useState('');

  const fetchVoices = async () => {
    const tcKey = localStorage.getItem('lucy_api_typecast_key');
    const elKey = localStorage.getItem('lucy_api_elevenlabs_key');

    setHasTypecastKey(Boolean(tcKey));
    setHasElevenlabsKey(Boolean(elKey));

    if (tcKey) {
      try {
        const res = await fetch('/api/tts/typecast/actors', {
          headers: { 'x-typecast-key': tcKey }
        });
        const data = await res.json();
        if (data?.actors && Array.isArray(data.actors)) {
          setTypecastActors(data.actors);
        }
      } catch (err) {
        console.error('[Fetch Typecast Actors Error]', err);
      }
    } else {
      setTypecastActors([]);
    }

    if (elKey) {
      try {
        const res = await fetch('/api/tts/elevenlabs/voices', {
          headers: { 'x-elevenlabs-key': elKey }
        });
        const data = await res.json();
        if (data?.voices && Array.isArray(data.voices)) {
          setElevenlabsVoices(data.voices);
        }
      } catch (err) {
        console.error('[Fetch ElevenLabs Voices Error]', err);
      }
    } else {
      setElevenlabsVoices([]);
    }
  };

  React.useEffect(() => {
    fetchVoices();
  }, []);

  const geminiVoices = [
    { id: 'Kore', name: 'Kore - 서연 / Seoyeon', provider: 'gemini' as const, gender: '여성', style: '밝고 자연스러운 쇼핑 전달 톤', sample: '안녕하세요! 씬스팩토리 TV 추천 쇼핑 보이스 서연입니다.' },
    { id: 'Puck', name: 'Puck - 지훈 / Jihoon', provider: 'gemini' as const, gender: '남성', style: '위트있고 생생한 썰쇼츠 톤', sample: '아직도 이거 안 쓰시는 분 계신가요? 대박 추천 꿀템 지훈입니다.' },
    { id: 'Zephyr', name: 'Zephyr - 민준 / Minjun', provider: 'gemini' as const, gender: '남성', style: '진중한 정보 및 전문가 톤', sample: '성분 분석과 실측 가성비를 검증하여 안내해 드립니다.' },
    { id: 'Charon', name: 'Charon - 수진 / Sujin', provider: 'gemini' as const, gender: '여성', style: '차분하고 설득력 있는 톤', sample: '일상 속 세련된 라이프스타일을 완성해 보세요.' },
  ];

  // Voice Preview Handler
  const handlePreviewVoice = async (voice: { id: string; provider: 'gemini' | 'typecast' | 'elevenlabs'; name: string; sample: string }, e: React.MouseEvent) => {
    e.stopPropagation();

    if (previewingVoiceId === voice.id) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPreviewingVoiceId(null);
      return;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsPreviewLoading(voice.id);
    setPreviewingVoiceId(voice.id);

    const userApiKey = voice.provider === 'typecast'
      ? localStorage.getItem('lucy_api_typecast_key')
      : localStorage.getItem('lucy_api_elevenlabs_key');

    try {
      const res = await apiFetch('/api/tts/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-typecast-key': localStorage.getItem('lucy_api_typecast_key') || '',
          'x-elevenlabs-key': localStorage.getItem('lucy_api_elevenlabs_key') || ''
        },
        body: JSON.stringify({
          voiceId: voice.id,
          voiceProvider: voice.provider,
          sampleText: voice.sample,
          apiKey: userApiKey
        })
      });
      const data = await res.json();
      setIsPreviewLoading(null);

      if (data?.audioBase64) {
        const mime = data.audioFormat === 'wav' ? 'audio/wav' : 'audio/mp3';
        const audio = new Audio(`data:${mime};base64,${data.audioBase64}`);
        audioElementRef.current = audio;
        audio.onended = () => {
          setPreviewingVoiceId(null);
          audioElementRef.current = null;
        };
        audio.onerror = () => {
          fallbackWebSpeechPreview(voice.sample, voice.id);
        };
        audio.play().catch(() => fallbackWebSpeechPreview(voice.sample, voice.id));
      } else {
        fallbackWebSpeechPreview(voice.sample, voice.id);
      }
    } catch (err) {
      setIsPreviewLoading(null);
      fallbackWebSpeechPreview(voice.sample, voice.id);
    }
  };

  const fallbackWebSpeechPreview = (text: string, voiceId: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = audioConfig.speed || 1.0;
      utterance.onend = () => setPreviewingVoiceId(null);
      utterance.onerror = () => setPreviewingVoiceId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setPreviewingVoiceId(null);
    }
  };

  // Recalculate start and end times sequentially based on durations
  const recalculateTimecodes = (updatedScenes: SceneItem[]) => {
    let currentTime = 0;
    return updatedScenes.map((s) => {
      const startTime = currentTime;
      const endTime = currentTime + s.duration;
      currentTime = endTime;
      return { ...s, start_time: startTime, end_time: endTime };
    });
  };

  const handleSceneNarrationChange = (sceneId: string, narration: string) => {
    // Auto estimate duration based on Korean char length (avg 12 chars per second)
    const estimatedSec = Math.max(2.0, Math.round((narration.length / 12) * 10) / 10);
    const updated = scenes.map((s) => (s.scene_id === sceneId ? { ...s, narration, duration: estimatedSec } : s));
    onUpdateScenes(recalculateTimecodes(updated));
  };

  const handleSceneSubtitleChange = (sceneId: string, subtitle: string) => {
    const updated = scenes.map((s) => (s.scene_id === sceneId ? { ...s, subtitle } : s));
    onUpdateScenes(updated);
  };

  const handleSceneDurationChange = (sceneId: string, duration: number) => {
    const updated = scenes.map((s) => (s.scene_id === sceneId ? { ...s, duration } : s));
    onUpdateScenes(recalculateTimecodes(updated));
  };

  // Upload custom audio for a specific scene - persisted server-side so it can be used later at render time
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);
  const handleCustomAudioUpload = async (sceneId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
        const updated = scenes.map((s) =>
          s.scene_id === sceneId ? { ...s, custom_audio_url: data.url, tts_generated: true } : s
        );
        onUpdateScenes(updated);
      }
    } catch (err) {
      console.error('[Custom Audio Upload Error]', err);
    } finally {
      setUploadingSceneId(null);
    }
  };

  // Play scene TTS or custom audio
  const handlePlaySceneAudio = (scene: SceneItem) => {
    if (playingSceneId === scene.scene_id) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setPlayingSceneId(null);
      return;
    }

    setPlayingSceneId(scene.scene_id);

    if (scene.custom_audio_url) {
      const audio = new Audio(scene.custom_audio_url);
      audio.onended = () => setPlayingSceneId(null);
      audio.play();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.lang = 'ko-KR';
      utterance.rate = audioConfig.speed;
      utterance.onend = () => setPlayingSceneId(null);
      utterance.onerror = () => setPlayingSceneId(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Generate All TTS & Auto-calculate duration & SRT timecodes.
  // The combined narration audio is stored on audioConfig so the render step can use the real voice track.
  const handleGenerateAllTts = async () => {
    setIsGeneratingTts(true);
    const fullNarration = scenes.map((s) => s.narration).join(' ');

    try {
      const response = await apiFetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullNarration,
          voiceName: audioConfig.voice_id,
          voiceProvider: audioConfig.voice_provider || 'gemini',
          typecastKey: localStorage.getItem('lucy_api_typecast_key') || '',
          elevenlabsKey: localStorage.getItem('lucy_api_elevenlabs_key') || ''
        })
      });

      const data = await response.json();

      // Update all scenes with TTS generated flag and synced timecodes
      const updatedScenes = scenes.map((s) => {
        const charDuration = Math.max(2.0, Math.round((s.narration.length / 12) * 10) / 10);
        return {
          ...s,
          duration: charDuration,
          tts_generated: true
        };
      });

      onUpdateScenes(recalculateTimecodes(updatedScenes));

      if (data?.audioBase64) {
        const format: 'wav' | 'mp3' | 'gemini_pcm' = data.audioFormat === 'wav' ? 'wav' : data.audioFormat === 'mp3' ? 'mp3' : 'gemini_pcm';
        onUpdateAudioConfig({
          ...audioConfig,
          narrationAudioBase64: data.audioBase64,
          narrationAudioFormat: format,
          narrationGeneratedAt: new Date().toISOString()
        });
        // Gemini's format is raw PCM with no container, which <audio>/data-URI playback can't
        // decode directly — only attempt browser playback for real containerized audio (WAV/MP3).
        if (format === 'wav' || format === 'mp3') {
          const audio = new Audio(`data:audio/${format === 'wav' ? 'wav' : 'mp3'};base64,${data.audioBase64}`);
          audio.play().catch(() => {});
        }
      } else if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(scenes[0]?.narration || fullNarration);
        utterance.lang = 'ko-KR';
        utterance.rate = audioConfig.speed;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const handleDownloadSrt = () => {
    const srt = generateSrtSubtitles(scenes);
    downloadFile(srt, 'shopping_shorts_subtitles.srt', 'text/plain');
  };

  const totalAudioTime = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 bg-[#0f0e17] text-slate-200 min-h-full">
      {/* Left Voice & Audio Controls (5 Cols) */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-[#181628] border border-[#2d2948] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
            <div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                쇼핑 오디오 & 보이스 스튜디오
              </span>
              <h2 className="text-base font-bold text-white">Gemini TTS & 음성 매칭</h2>
            </div>
            <span className="text-xs bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2.5 py-0.5 rounded-full font-mono">
              총 {totalAudioTime.toFixed(1)}초
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            한국어 커머스 쇼츠에 특화된 AI 보이스를 선택하거나, 각 씬에 직접 녹음한 음성을 업로드하여 오디오 파이프라인을 구축하세요.
          </p>

          {/* Voice Selectors */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 block">AI 보이스 제공자 & 성우 선택</label>
              <span className="text-[10px] text-purple-300 bg-purple-950 border border-purple-800/60 px-2 py-0.5 rounded">
                Hybrid Voice Engine
              </span>
            </div>

            <div className="space-y-4">
              {/* 1. Gemini 3.1 Flash TTS Group */}
              <div className="space-y-2 bg-[#121020] border border-[#292446] p-3 rounded-xl">
                <div className="flex items-center justify-between border-b border-[#211c38] pb-2">
                  <span className="text-xs font-bold text-white">1. 기본 제공 AI 보이스 (Gemini 3.1 Flash TTS)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-emerald-950 text-emerald-300 border-emerald-800">
                    100% 무제한 기본제공
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {geminiVoices.map((voice) => {
                    const isSelected = audioConfig.voice_id === voice.id;
                    const isPreviewing = previewingVoiceId === voice.id;
                    const isLoadingThisPreview = isPreviewLoading === voice.id;

                    return (
                      <div
                        key={voice.id}
                        onClick={() =>
                          onUpdateAudioConfig({
                            ...audioConfig,
                            voice_id: voice.id,
                            voice_name: `${voice.name} (${voice.gender})`,
                            voice_provider: voice.provider,
                            emotion_style: voice.style
                          })
                        }
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#28214c] border-purple-500 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-500'
                            : 'bg-[#18152b] border-[#2e2850] hover:border-purple-800 text-slate-300'
                        }`}
                      >
                        <div className="space-y-0.5 max-w-[68%]">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold">{voice.name}</span>
                            <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.2 rounded border border-purple-800/40">
                              {voice.gender}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{voice.style}</p>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={(e) => handlePreviewVoice(voice, e)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 border transition min-h-[30px] ${
                              isPreviewing
                                ? 'bg-purple-600 text-white border-purple-400 animate-pulse'
                                : 'bg-[#221c3d] text-purple-300 border-[#3d336b] hover:bg-purple-900/60'
                            }`}
                          >
                            {isLoadingThisPreview ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-purple-300" />
                            ) : isPreviewing ? (
                              <Pause className="w-3 h-3 text-white" />
                            ) : (
                              <Volume2 className="w-3 h-3 text-purple-400" />
                            )}
                            <span>{isPreviewing ? '정지' : '미리듣기'}</span>
                          </button>

                          {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Typecast API Voice Group */}
              <div className="space-y-2 bg-[#121020] border border-[#292446] p-3 rounded-xl">
                <div className="flex items-center justify-between border-b border-[#211c38] pb-2">
                  <span className="text-xs font-bold text-white">2. 타입캐스트 어댑터 (Typecast API)</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      hasTypecastKey
                        ? 'bg-purple-950 text-purple-300 border-purple-800'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {hasTypecastKey ? '🔑 API 키 연동 완료' : '🔓 [API 설정] 키 입력 필요'}
                  </span>
                </div>

                {hasTypecastKey && typecastActors.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={typecastSearchQuery}
                      onChange={(e) => setTypecastSearchQuery(e.target.value)}
                      placeholder={`성우 이름으로 검색 (전체 ${typecastActors.length}명)`}
                      className="w-full bg-[#0e0c18] border border-[#2e2850] rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />

                    <select
                      value={audioConfig.voice_provider === 'typecast' ? audioConfig.voice_id : ''}
                      onChange={(e) => {
                        const actor = typecastActors.find((a) => a.id === e.target.value);
                        if (!actor) return;
                        onUpdateAudioConfig({
                          ...audioConfig,
                          voice_id: actor.id,
                          voice_name: actor.name,
                          voice_provider: 'typecast',
                          emotion_style: actor.style
                        });
                      }}
                      className="w-full bg-[#18152b] border border-[#2e2850] rounded-lg px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="" disabled>성우를 선택하세요</option>
                      {typecastActors.filter((a) => a.isCustomClone).length > 0 && (
                        <optgroup label="🎙️ 내 클론 보이스">
                          {typecastActors
                            .filter((a) => a.isCustomClone && a.name.toLowerCase().includes(typecastSearchQuery.toLowerCase()))
                            .map((a) => (
                              <option key={a.id} value={a.id}>{a.name} ({a.gender})</option>
                            ))}
                        </optgroup>
                      )}
                      <optgroup label={`타입캐스트 성우 라이브러리 (${typecastActors.filter((a) => !a.isCustomClone).length}명)`}>
                        {typecastActors
                          .filter((a) => !a.isCustomClone && a.name.toLowerCase().includes(typecastSearchQuery.toLowerCase()))
                          .map((a) => (
                            <option key={a.id} value={a.id}>{a.name} ({a.gender}, {a.style})</option>
                          ))}
                      </optgroup>
                    </select>

                    {audioConfig.voice_provider === 'typecast' && (() => {
                      const selectedActor = typecastActors.find((a) => a.id === audioConfig.voice_id);
                      if (!selectedActor) return null;
                      const isPreviewing = previewingVoiceId === selectedActor.id;
                      const isLoadingThisPreview = isPreviewLoading === selectedActor.id;
                      return (
                        <button
                          onClick={(e) =>
                            handlePreviewVoice(
                              { id: selectedActor.id, provider: 'typecast', name: selectedActor.name, sample: selectedActor.sample },
                              e
                            )
                          }
                          className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 border transition min-h-[38px] ${
                            isPreviewing
                              ? 'bg-purple-600 text-white border-purple-400 animate-pulse'
                              : 'bg-[#221c3d] text-purple-300 border-[#3d336b] hover:bg-purple-900/60'
                          }`}
                        >
                          {isLoadingThisPreview ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isPreviewing ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                          <span>{isPreviewing ? '정지' : `"${selectedActor.name}" 미리듣기`}</span>
                          {selectedActor.isCustomClone && (
                            <span className="text-[9px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-1.5 py-0.2 rounded font-bold">
                              내 클론
                            </span>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-3 bg-[#171428] border border-[#2e274c] rounded-xl space-y-2 text-center my-1">
                    <p className="text-xs text-slate-300 font-semibold">
                      🔓 Typecast API Key가 등록되지 않았습니다.
                    </p>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Settings에서 Typecast Key를 등록하면 사용자의 '내 클론 보이스' 및 전체 성우 라이브러리가 오디오 스튜디오에 동적으로 로드됩니다.
                    </p>
                    {onOpenSettings && (
                      <button
                        onClick={onOpenSettings}
                        className="px-3 py-1.5 bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-600/50 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3 text-purple-300" />
                        <span>⚙️ API 설정에서 등록하기</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 3. ElevenLabs API Voice Group */}
              <div className="space-y-2 bg-[#121020] border border-[#292446] p-3 rounded-xl">
                <div className="flex items-center justify-between border-b border-[#211c38] pb-2">
                  <span className="text-xs font-bold text-white">3. 일레븐랩스 어댑터 (ElevenLabs API)</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      hasElevenlabsKey
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {hasElevenlabsKey ? '🔑 API 키 연동 완료' : '🔓 [API 설정] 키 입력 필요'}
                  </span>
                </div>

                {hasElevenlabsKey && elevenlabsVoices.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {elevenlabsVoices.map((voice) => {
                      const isSelected = audioConfig.voice_id === voice.id;
                      const isPreviewing = previewingVoiceId === voice.id;
                      const isLoadingThisPreview = isPreviewLoading === voice.id;

                      return (
                        <div
                          key={voice.id}
                          onClick={() =>
                            onUpdateAudioConfig({
                              ...audioConfig,
                              voice_id: voice.id,
                              voice_name: `${voice.name}`,
                              voice_provider: 'elevenlabs',
                              emotion_style: voice.style
                            })
                          }
                          className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#28214c] border-purple-500 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-500'
                              : 'bg-[#18152b] border-[#2e2850] hover:border-purple-800 text-slate-300'
                          }`}
                        >
                          <div className="space-y-0.5 max-w-[68%]">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                              <span className="text-xs font-bold text-white">{voice.name}</span>
                              {voice.isCustomClone && (
                                <span className="text-[9px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-1.5 py-0.2 rounded font-bold shadow-sm">
                                  My Custom Voice
                                </span>
                              )}
                              <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800/40">
                                {voice.gender || 'Ultra HD'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">{voice.style}</p>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={(e) =>
                                handlePreviewVoice(
                                  { id: voice.id, provider: 'elevenlabs', name: voice.name, sample: voice.sample },
                                  e
                                )
                              }
                              className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 border transition min-h-[30px] ${
                                isPreviewing
                                  ? 'bg-purple-600 text-white border-purple-400 animate-pulse'
                                  : 'bg-[#221c3d] text-purple-300 border-[#3d336b] hover:bg-purple-900/60'
                              }`}
                            >
                              {isLoadingThisPreview ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-purple-300" />
                              ) : isPreviewing ? (
                                <Pause className="w-3 h-3 text-white" />
                              ) : (
                                <Volume2 className="w-3 h-3 text-purple-400" />
                              )}
                              <span>{isPreviewing ? '정지' : '미리듣기'}</span>
                            </button>

                            {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-[#171428] border border-[#2e274c] rounded-xl space-y-2 text-center my-1">
                    <p className="text-xs text-slate-300 font-semibold">
                      🔓 ElevenLabs API Key가 등록되지 않았습니다.
                    </p>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Settings에서 ElevenLabs Key를 등록하면 계정의 'My Custom Voices' 및 Ultra HD 성우 카탈로그가 오디오 스튜디오에 동적으로 로드됩니다.
                    </p>
                    {onOpenSettings && (
                      <button
                        onClick={onOpenSettings}
                        className="px-3 py-1.5 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-600/50 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-300" />
                        <span>⚙️ API 설정에서 등록하기</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Speed & Volume Control */}
          <div className="space-y-3 bg-[#121020] border border-[#272342] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">발화 속도 (TTS Speed)</span>
              <span className="text-xs font-mono text-purple-300">{audioConfig.speed}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={audioConfig.speed}
              onChange={(e) => onUpdateAudioConfig({ ...audioConfig, speed: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-[#262045] rounded-lg"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-slate-300">배경음악 음량 (BGM Volume)</span>
              <span className="text-xs font-mono text-purple-300">{Math.round(audioConfig.bgm_volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.02"
              value={audioConfig.bgm_volume}
              onChange={(e) => onUpdateAudioConfig({ ...audioConfig, bgm_volume: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-[#262045] rounded-lg"
            />
          </div>

          {/* Batch Generate Actions */}
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 text-center">
              현재 선택된 보이스: <span className="text-purple-300 font-semibold">{audioConfig.voice_name}</span>
              {' '}({audioConfig.voice_provider === 'typecast' ? '타입캐스트' : audioConfig.voice_provider === 'elevenlabs' ? 'ElevenLabs' : 'Gemini'}) —
              위에서 다른 성우를 선택하면 다음 생성부터 그 성우로 적용됩니다.
            </p>
            <button
              onClick={handleGenerateAllTts}
              disabled={isGeneratingTts}
              className="w-full min-h-[48px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-950/40 flex items-center justify-center space-x-2"
            >
              {isGeneratingTts ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>TTS 오디오 & 타임코드 동기화 중...</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>전체 장면 TTS & 자막 자동 생성</span>
                </>
              )}
            </button>

            {audioConfig.narrationAudioBase64 ? (
              <div className="text-[11px] bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 rounded-lg px-3 py-2 flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>나레이션 오디오가 생성되어 렌더링에 사용될 준비가 되었습니다.</span>
              </div>
            ) : (
              <div className="text-[11px] bg-amber-950/40 border border-amber-800/40 text-amber-300 rounded-lg px-3 py-2">
                ⚠️ 아직 나레이션 오디오가 생성되지 않았습니다. 렌더링 전 위 버튼을 눌러주세요.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDownloadSrt}
                className="bg-[#1f1b3d] hover:bg-[#2b2654] border border-[#3b336b] text-purple-200 text-xs py-2.5 rounded-xl font-medium transition flex items-center justify-center space-x-1.5 min-h-[44px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SRT 자막 다운로드</span>
              </button>

              <button
                onClick={() => setShowSrtModal(true)}
                className="bg-[#1f1b3d] hover:bg-[#2b2654] border border-[#3b336b] text-purple-200 text-xs py-2.5 rounded-xl font-medium transition flex items-center justify-center space-x-1.5 min-h-[44px]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>SRT 자막 미리보기</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Scene Audio Inspector (7 Cols) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#181628] border border-[#2d2948] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
            <div className="flex items-center space-x-2">
              <Music className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white">장면별 오디오 & 자막 타임라인</h2>
            </div>

            <button
              onClick={onNextStep}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-md shadow-purple-900/30 flex items-center space-x-1.5 transition min-h-[44px]"
            >
              <span>렌더링 & 최종결과물</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {scenes.map((scene) => {
              const isPlaying = playingSceneId === scene.scene_id;

              return (
                <div
                  key={scene.scene_id}
                  className="bg-[#121020] border border-[#272342] p-4 rounded-xl space-y-3"
                >
                  {/* Scene Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="bg-purple-900/80 text-purple-200 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border border-purple-700/50">
                        {scene.scene_id}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        ({scene.start_time.toFixed(1)}s ~ {scene.end_time.toFixed(1)}s)
                      </span>
                      {scene.tts_generated && (
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-full font-bold flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>TTS 오디오 매칭</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono text-purple-300 font-bold">{scene.duration.toFixed(1)}초</span>
                    </div>
                  </div>

                  {/* Narration Textarea */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      나레이션 (음성 생성 대본)
                    </label>
                    <textarea
                      value={scene.narration}
                      onChange={(e) => handleSceneNarrationChange(scene.scene_id, e.target.value)}
                      rows={2}
                      className="w-full bg-[#0a0814] border border-[#231f3d] rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                    />
                  </div>

                  {/* Subtitle Input */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      9:16 자막 문구 (SRT)
                    </label>
                    <input
                      type="text"
                      value={scene.subtitle}
                      onChange={(e) => handleSceneSubtitleChange(scene.scene_id, e.target.value)}
                      className="w-full bg-[#0a0814] border border-[#231f3d] rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Duration Slider */}
                  <div className="flex items-center justify-between space-x-3 bg-[#18152b] p-2.5 rounded-lg border border-[#292348]">
                    <span className="text-[11px] text-slate-400 shrink-0">장면 시간 조절</span>
                    <input
                      type="range"
                      min="1.0"
                      max="10.0"
                      step="0.5"
                      value={scene.duration}
                      onChange={(e) => handleSceneDurationChange(scene.scene_id, parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer h-1.5 bg-[#28214a] rounded-lg"
                    />
                    <span className="text-xs font-mono text-purple-300 font-bold shrink-0">{scene.duration}s</span>
                  </div>

                  {/* Audio Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#231f3d]">
                    <button
                      onClick={() => handlePlaySceneAudio(scene)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                        isPlaying
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#211b40] hover:bg-[#2e2659] text-purple-200 border border-purple-800/40'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? '재생 중...' : 'TTS 음성 들어보기'}</span>
                    </button>

                    <label className="cursor-pointer bg-[#211b40] hover:bg-[#2e2659] border border-purple-800/40 text-purple-200 text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5">
                      <Upload className="w-3.5 h-3.5 text-purple-400" />
                      <span>{scene.custom_audio_url ? '내 오디오 변경' : '내 음성파일 업로드'}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => handleCustomAudioUpload(scene.scene_id, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SRT Preview Modal */}
      {showSrtModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#181628] border border-[#302a52] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#302a52] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>SRT 자막 원본 미리보기</span>
              </h3>
              <button onClick={() => setShowSrtModal(false)} className="text-slate-400 hover:text-white p-2">✕</button>
            </div>

            <pre className="bg-[#0b0a12] border border-[#272342] p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-y-auto max-h-80 leading-relaxed">
              {generateSrtSubtitles(scenes)}
            </pre>

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleDownloadSrt}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold min-h-[44px]"
              >
                SRT 다운로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
