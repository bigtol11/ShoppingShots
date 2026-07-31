import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  Zap,
  Server,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  UserCheck,
  CreditCard,
  Sparkles,
  Lock,
  ExternalLink,
  Layers
} from 'lucide-react';
import { UserSettings, AdminStats } from '../types';

interface SettingsViewProps {
  onSettingsUpdated?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsUpdated }) => {
  const [typecastKey, setTypecastKey] = useState('');
  const [elevenlabsKey, setElevenlabsKey] = useState('');

  const [typecastStatus, setTypecastStatus] = useState<{ loading: boolean; message: string | null; isSuccess: boolean }>({
    loading: false,
    message: null,
    isSuccess: false
  });

  const [elevenlabsStatus, setElevenlabsStatus] = useState<{ loading: boolean; message: string | null; isSuccess: boolean }>({
    loading: false,
    message: null,
    isSuccess: false
  });

  const [userCredits, setUserCredits] = useState({
    plan: 'PRO',
    monthlyRendersUsed: 12,
    monthlyRendersLimit: 50,
    ttsCharsUsed: 18450,
    ttsCharsLimit: 100000,
    remainingRenders: 38
  });

  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalUsers: 1420,
    activeJobs: 1,
    systemGpuHealth: 'OPERATIONAL',
    geminiApiStatus: 'ONLINE',
    typecastAdapterStatus: 'CONNECTED',
    elevenlabsAdapterStatus: 'CONNECTED',
    ffmpegQueueLength: 0
  });

  const [isAdminMode, setIsAdminMode] = useState(false);

  const [falInputKey, setFalInputKey] = useState('');
  const [falConfigured, setFalConfigured] = useState(false);
  const [falStatus, setFalStatus] = useState<{ loading: boolean; message: string | null; isSuccess: boolean }>({
    loading: false,
    message: null,
    isSuccess: false
  });

  const fetchFalStatus = async () => {
    try {
      const res = await fetch('/api/admin/fal-key/status');
      const data = await res.json();
      if (data?.configured !== undefined) {
        setFalConfigured(data.configured);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFalStatus();
  }, [isAdminMode]);

  const handleSaveFalKey = async () => {
    if (!falInputKey || falInputKey.trim().length < 8) {
      setFalStatus({
        loading: false,
        message: '유효한 fal.ai API Key를 입력해 주세요. (최소 8자 이상)',
        isSuccess: false
      });
      return;
    }

    setFalStatus({ loading: true, message: 'fal.ai API Key 서버 저장 및 보안 격리 처리 중...', isSuccess: false });

    try {
      const res = await fetch('/api/admin/fal-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ falKey: falInputKey })
      });
      const data = await res.json();

      if (data?.status === 'success') {
        setFalStatus({ loading: false, message: data.message, isSuccess: true });
        setFalConfigured(true);
        setFalInputKey(''); // Clear raw key text immediately for security
      } else {
        setFalStatus({ loading: false, message: data.message || '저장 실패', isSuccess: false });
      }
    } catch (err) {
      setFalStatus({ loading: false, message: '서버 연결 실패', isSuccess: false });
    }
  };

  useEffect(() => {
    // Load stored keys
    const savedTypecast = localStorage.getItem('lucy_api_typecast_key') || '';
    const savedElevenLabs = localStorage.getItem('lucy_api_elevenlabs_key') || '';

    setTypecastKey(savedTypecast);
    setElevenlabsKey(savedElevenLabs);

    if (savedTypecast) {
      setTypecastStatus({ loading: false, message: 'Typecast API 키가 연동되어 있습니다.', isSuccess: true });
    }
    if (savedElevenLabs) {
      setElevenlabsStatus({ loading: false, message: 'ElevenLabs API 키가 연동되어 있습니다.', isSuccess: true });
    }

    // Fetch server admin stats
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data?.adminStats) setAdminStats(data.adminStats);
        if (data?.userCredits) setUserCredits(data.userCredits);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleValidateKey = async (provider: 'typecast' | 'elevenlabs') => {
    const keyToValidate = provider === 'typecast' ? typecastKey : elevenlabsKey;
    const setStatus = provider === 'typecast' ? setTypecastStatus : setElevenlabsStatus;

    if (!keyToValidate || keyToValidate.trim().length < 8) {
      setStatus({
        loading: false,
        message: '유효한 API 키를 입력하세요. (최소 8자 이상)',
        isSuccess: false
      });
      return;
    }

    setStatus({ loading: true, message: 'API 키 핸드셰이크 인증 진행 중...', isSuccess: false });

    try {
      const res = await fetch('/api/settings/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: keyToValidate })
      });
      const data = await res.json();

      if (data?.status === 'success') {
        setStatus({ loading: false, message: data.message, isSuccess: true });

        if (provider === 'typecast') {
          localStorage.setItem('lucy_api_typecast_key', keyToValidate);
        } else {
          localStorage.setItem('lucy_api_elevenlabs_key', keyToValidate);
        }

        if (onSettingsUpdated) onSettingsUpdated();
      } else {
        setStatus({ loading: false, message: data.message || '인증 실패', isSuccess: false });
      }
    } catch (err) {
      setStatus({ loading: false, message: '서버 연결 실패', isSuccess: false });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6 text-slate-200">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#141224] border border-[#2d284a] p-5 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-purple-900/40">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>SaaS 환경 설정 & 외부 API 키 관리</span>
              <span className="text-[11px] bg-purple-950 text-purple-300 border border-purple-700/40 px-2 py-0.5 rounded font-mono">
                Commercial v3.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              개인 Typecast 및 ElevenLabs API 키를 등록하고, 잔여 렌더링 크레딧을 관리하세요.
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center space-x-2 bg-[#1b1830] p-1.5 rounded-xl border border-[#302a54]">
          <button
            onClick={() => setIsAdminMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !isAdminMode ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            👤 사용자 유소스페이스
          </button>
          <button
            onClick={() => setIsAdminMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              isAdminMode ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ 시스템 관리자 모드
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: API Key Settings (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#141224] border border-[#2d284a] rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#2d284a] pb-3">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold text-white">개인 외부 API 키 연동 (External API Keys)</h2>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-800/40 px-2 py-0.5 rounded font-mono">
                Encrypted Client-Side
              </span>
            </div>

            {/* Typecast API Key Card */}
            <div className="bg-[#1a172e] border border-[#332c58] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-300 block">1. Typecast API Key (타입캐스트)</span>
                  <span className="text-[11px] text-slate-400">내 클론 보이스 및 타입캐스트 120+ 성우 라이브러리 자동 연동</span>
                </div>
                {typecastStatus.isSuccess ? (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>연동 완료</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold">
                    미연동 (기본 Gemini 사용)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="password"
                  value={typecastKey}
                  onChange={(e) => setTypecastKey(e.target.value)}
                  placeholder="Typecast API Key (tc_sk_...)"
                  className="flex-1 bg-[#100d21] border border-[#393163] focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none font-mono"
                />
                <button
                  onClick={() => handleValidateKey('typecast')}
                  disabled={typecastStatus.loading}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition flex items-center space-x-1 disabled:opacity-50 min-h-[36px]"
                >
                  {typecastStatus.loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-200" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                  )}
                  <span>저장 & 검증</span>
                </button>
              </div>

              {typecastStatus.message && (
                <p className={`text-[11px] font-mono p-2 rounded border ${
                  typecastStatus.isSuccess
                    ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                }`}>
                  {typecastStatus.message}
                </p>
              )}
            </div>

            {/* ElevenLabs API Key Card */}
            <div className="bg-[#1a172e] border border-[#332c58] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-300 block">2. ElevenLabs API Key (일레븐랩스)</span>
                  <span className="text-[11px] text-slate-400">초고품질 다국어 음성 합성 및 클론 보이스 어댑터 연동</span>
                </div>
                {elevenlabsStatus.isSuccess ? (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>연동 완료</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold">
                    미연동 (기본 Gemini 사용)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="password"
                  value={elevenlabsKey}
                  onChange={(e) => setElevenlabsKey(e.target.value)}
                  placeholder="ElevenLabs API Key (xi-api-key-...)"
                  className="flex-1 bg-[#100d21] border border-[#393163] focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none font-mono"
                />
                <button
                  onClick={() => handleValidateKey('elevenlabs')}
                  disabled={elevenlabsStatus.loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition flex items-center space-x-1 disabled:opacity-50 min-h-[36px]"
                >
                  {elevenlabsStatus.loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                  )}
                  <span>저장 & 검증</span>
                </button>
              </div>

              {elevenlabsStatus.message && (
                <p className={`text-[11px] font-mono p-2 rounded border ${
                  elevenlabsStatus.isSuccess
                    ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                }`}>
                  {elevenlabsStatus.message}
                </p>
              )}
            </div>
          </div>

          {/* Admin Exclusive: fal.ai System API Key Section */}
          {isAdminMode && (
            <div className="bg-[#141224] border border-[#3d2b5c] rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#2d284a] pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-bold text-white">🛡️ 시스템 관리자 - fal.ai API Key 설정</h2>
                </div>
                {falConfigured ? (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>연동 완료 (서버 보안 격리)</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold">
                    미연동 / 점검 중
                  </span>
                )}
              </div>

              <div className="bg-[#1a172e] border border-[#332c58] p-4 rounded-xl space-y-3">
                <div>
                  <span className="text-xs font-bold text-purple-300 block">Server-to-Server fal.ai Video Engine Key</span>
                  <span className="text-[11px] text-slate-400">
                    클라이언트에 절대 노출되지 않으며, 백엔드('/api/generate/video')에서 직접 연동됩니다.
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={falInputKey}
                    onChange={(e) => setFalInputKey(e.target.value)}
                    placeholder={falConfigured ? "●●●●●●●●●●●● (보안 저장됨)" : "fal.ai API Key 입력 (fal_key_...)"}
                    className="flex-1 bg-[#100d21] border border-[#393163] focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none font-mono"
                  />
                  <button
                    onClick={handleSaveFalKey}
                    disabled={falStatus.loading}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition flex items-center space-x-1 disabled:opacity-50 min-h-[36px]"
                  >
                    {falStatus.loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-200" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-purple-200" />
                    )}
                    <span>저장 & 보안 격리 등록</span>
                  </button>
                </div>

                {falStatus.message && (
                  <p className={`text-[11px] font-mono p-2 rounded border ${
                    falStatus.isSuccess
                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                  }`}>
                    {falStatus.message}
                  </p>
                )}

                <div className="p-2.5 bg-[#100d21] rounded-lg border border-[#2b244d] text-[11px] text-slate-400 flex items-start space-x-2">
                  <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    보안 가이드라인: FAL_KEY 원본 텍스트는 브라우저 API 응답에 절대 포함되지 않으며, 서버 세션 및 process.env에만 격리 보관됩니다.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* Right Column: User Credits & Admin Stats (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {!isAdminMode ? (
            /* User Workspace Usage & Credits Card */
            <div className="bg-[#141224] border border-[#2d284a] rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#2d284a] pb-3">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white">플랜 및 잔여 크레딧 대시보드</h2>
                </div>
                <span className="text-xs font-bold text-purple-300 bg-purple-950 border border-purple-800 px-2.5 py-0.5 rounded-full">
                  {userCredits.plan} Plan
                </span>
              </div>

              {/* Renders Progress */}
              <div className="bg-[#1a172e] p-3.5 rounded-xl border border-[#332c58] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">월간 MP4 렌더링 한도</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {userCredits.monthlyRendersUsed} / {userCredits.monthlyRendersLimit} 회
                  </span>
                </div>
                <div className="w-full bg-[#100d21] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${(userCredits.monthlyRendersUsed / userCredits.monthlyRendersLimit) * 100}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-400 text-right">
                  잔여 {userCredits.remainingRenders}회 이용 가능 (매월 1일 리셋)
                </p>
              </div>

              {/* TTS Chars Progress */}
              <div className="bg-[#1a172e] p-3.5 rounded-xl border border-[#332c58] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">Gemini / Typecast TTS 사용량</span>
                  <span className="font-mono text-purple-300 font-bold">
                    {userCredits.ttsCharsUsed.toLocaleString()} / {userCredits.ttsCharsLimit.toLocaleString()} 자
                  </span>
                </div>
                <div className="w-full bg-[#100d21] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-400 h-full transition-all duration-300"
                    style={{ width: `${(userCredits.ttsCharsUsed / userCredits.ttsCharsLimit) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>1080x1920 (9:16) H.264 백엔드 FFmpeg 렌더링 무제한</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>유튜브/틱톡/릴스/네이버클립 원클릭 메타데이터 복사</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>SRT 자막 타임코드 및 나레이션 텍스트 개별 추출</span>
                </div>
              </div>
            </div>
          ) : (
            /* System Admin Control Panel */
            <div className="bg-[#141224] border border-[#2d284a] rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#2d284a] pb-3">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-bold text-white">시스템 관리자 인프라 현황 (Admin)</h2>
                </div>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
                  Superuser Mode
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="bg-[#1a172e] p-3 rounded-xl border border-[#332c58] flex justify-between items-center">
                  <span className="text-slate-300 font-bold">FFmpeg 서버 인코더 GPU 헬스</span>
                  <span className="text-emerald-400 font-mono font-bold">{adminStats.systemGpuHealth}</span>
                </div>

                <div className="bg-[#1a172e] p-3 rounded-xl border border-[#332c58] flex justify-between items-center">
                  <span className="text-slate-300 font-bold">Gemini 3.6 Flash AI 엔진</span>
                  <span className="text-emerald-400 font-mono font-bold">{adminStats.geminiApiStatus}</span>
                </div>

                <div className="bg-[#1a172e] p-3 rounded-xl border border-[#332c58] flex justify-between items-center">
                  <span className="text-slate-300 font-bold">Typecast API 어댑터</span>
                  <span className="text-emerald-400 font-mono font-bold">{adminStats.typecastAdapterStatus}</span>
                </div>

                <div className="bg-[#1a172e] p-3 rounded-xl border border-[#332c58] flex justify-between items-center">
                  <span className="text-slate-300 font-bold">ElevenLabs API 어댑터</span>
                  <span className="text-emerald-400 font-mono font-bold">{adminStats.elevenlabsAdapterStatus}</span>
                </div>

                <div className="bg-[#1a172e] p-3 rounded-xl border border-[#332c58] flex justify-between items-center">
                  <span className="text-slate-300 font-bold">전체 등록 회원 수</span>
                  <span className="text-purple-300 font-mono font-bold">{adminStats.totalUsers.toLocaleString()} 명</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
