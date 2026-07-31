import React, { useState } from 'react';
import { Sparkles, Mail, Lock, KeyRound, RefreshCw } from 'lucide-react';

interface LoginViewProps {
  onAuthenticated: (user: { id: string; email: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, inviteCode };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data?.status === 'success' && data?.user) {
        onAuthenticated(data.user);
      } else {
        setErrorMessage(data?.message || '처리에 실패했습니다.');
      }
    } catch (err) {
      setErrorMessage('서버 연결에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0f0e17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#181628] border border-[#2d2948] rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="bg-gradient-to-tr from-purple-600 to-indigo-500 p-2.5 rounded-xl shadow-md shadow-purple-900/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">Lucy AI Studio</h1>
          <p className="text-xs text-slate-400">쇼핑쇼츠 자동화 파이프라인</p>
        </div>

        <div className="flex bg-[#110e20] p-1 rounded-lg border border-[#272342]">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(null); }}
            className={`flex-1 text-xs py-2 font-bold rounded-md transition ${
              mode === 'login' ? 'bg-[#2b254d] text-purple-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMessage(null); }}
            className={`flex-1 text-xs py-2 font-bold rounded-md transition ${
              mode === 'register' ? 'bg-[#2b254d] text-purple-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            초대코드로 가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5 text-purple-400" />
              <span>이메일</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#110e1c] border border-[#272342] rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>비밀번호</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#110e1c] border border-[#272342] rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              placeholder="8자 이상"
            />
          </div>

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                <span>초대코드</span>
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full bg-[#110e1c] border border-[#272342] rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                placeholder="초대받은 코드를 입력하세요"
              />
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-950/60 border border-rose-800/60 text-rose-200 text-[11px] rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>{mode === 'login' ? '로그인' : '가입하기'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
