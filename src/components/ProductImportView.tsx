import React, { useState, useEffect } from 'react';
import { ProductFacts } from '../types';
import { MOCK_PROJECTS } from '../mockData';
import { apiFetch } from '../utils/apiClient';
import {
  Download,
  Link as LinkIcon,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Search,
  FileCode,
  ShieldCheck,
  Zap,
  ChevronRight,
  X,
  Camera,
  Upload,
  Trash2
} from 'lucide-react';

interface ProductImportViewProps {
  productInfo: ProductFacts;
  onUpdateProductInfo: (info: ProductFacts) => void;
  onNextStep: () => void;
  onPrevStep?: () => void;
  viewMode?: 'input' | 'fact-check';
}

export const ProductImportView: React.FC<ProductImportViewProps> = ({
  productInfo,
  onUpdateProductInfo,
  onNextStep,
  onPrevStep,
  viewMode = 'input'
}) => {
  const [urlInput, setUrlInput] = useState(productInfo.source_url || '');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(productInfo, null, 2));
  const [activeTab, setActiveTab] = useState<'url' | 'json' | 'presets' | 'screenshot'>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Screenshot -> Gemini Vision auto-fill (product page + review page captures)
  const [screenshotFiles, setScreenshotFiles] = useState<{ id: string; base64: string; mimeType: string; name: string }[]>([]);
  const [isAnalyzingScreenshot, setIsAnalyzingScreenshot] = useState(false);

  const handleScreenshotSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setErrorMessage(null);
    const read = (file: File): Promise<{ id: string; base64: string; mimeType: string; name: string }> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, base64: reader.result as string, mimeType: file.type, name: file.name });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    const newFiles = await Promise.all(files.map(read));
    setScreenshotFiles((prev) => [...prev, ...newFiles]);
    event.target.value = '';
  };

  const handleRemoveScreenshot = (id: string) => {
    setScreenshotFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAnalyzeScreenshots = async () => {
    if (screenshotFiles.length === 0) {
      setErrorMessage('먼저 상품 페이지(또는 후기 페이지) 스크린샷을 최소 1장 업로드해 주세요.');
      return;
    }
    setIsAnalyzingScreenshot(true);
    setErrorMessage(null);
    setImportStatus('Gemini Vision이 스크린샷을 읽는 중...');
    try {
      const res = await apiFetch('/api/analyze-product-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: screenshotFiles.map((f) => ({ base64: f.base64, mimeType: f.mimeType })),
          productUrl: urlInput
        })
      });
      const data = await res.json();
      if (data?.status === 'error') {
        setErrorMessage(data.message || '스크린샷 분석에 실패했습니다.');
        setImportStatus(null);
        return;
      }
      if (data?.data) {
        const facts = data.data;
        onUpdateProductInfo({
          ...productInfo,
          product_name: facts.product_name || productInfo.product_name,
          price: facts.price || productInfo.price,
          source_url: urlInput || productInfo.source_url,
          category_name: facts.category_name || productInfo.category_name,
          verified_facts: facts.verified_facts || productInfo.verified_facts,
          category_facts: facts.category_facts || productInfo.category_facts,
          use_cases: facts.use_cases || productInfo.use_cases,
          visual_features: facts.visual_features || productInfo.visual_features,
          prohibited_claims: facts.prohibited_claims || productInfo.prohibited_claims,
          search_terms: facts.search_terms || productInfo.search_terms
        });
        setImportStatus(`'${(facts.product_name || '').slice(0, 20)}...' 스크린샷 자동 인식 완료!`);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('스크린샷 분석 요청이 실패했습니다.');
      setImportStatus(null);
    } finally {
      setIsAnalyzingScreenshot(false);
    }
  };

  // Sync urlInput and jsonInput whenever productInfo changes (e.g. from Tab 1 topic selection)
  useEffect(() => {
    if (productInfo) {
      setUrlInput(productInfo.source_url || '');
      setJsonInput(JSON.stringify(productInfo, null, 2));
    }
  }, [productInfo]);

  // Analyze Product via Express Backend Gemini API v2.1
  const [pipelineV2, setPipelineV2] = useState<any>(null);

  const handleAnalyze = async (dataToAnalyze?: any) => {
    setIsLoading(true);
    setErrorMessage(null);
    setImportStatus('Gemini v2.1 팩트체크 및 숏폼 기획 파이프라인 가동 중...');

    try {
      if (activeTab === 'url' && !urlInput.trim() && !dataToAnalyze) {
        setErrorMessage('정확한 URL 데이터를 가져오지 못했습니다. 크롬 확장 프로그램 수집기 또는 JSON 직접 입력을 이용해 주세요.');
        setIsLoading(false);
        return;
      }

      // Call both analyze and pipeline-v2
      const [res1, res2] = await Promise.all([
        apiFetch('/api/analyze-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: dataToAnalyze?.product_name || productInfo.product_name,
            productUrl: urlInput,
            productJson: dataToAnalyze || productInfo
          })
        }).then((r) => r.json()),
        apiFetch('/api/gemini-pipeline-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: dataToAnalyze?.product_name || productInfo.product_name,
            productUrl: urlInput,
            productJson: dataToAnalyze || productInfo
          })
        }).then((r) => r.json())
      ]);

      if (res1?.status === 'error') {
        setErrorMessage(res1.message || '정확한 URL 데이터를 가져오지 못했습니다. 크롬 확장 프로그램 수집기 또는 JSON 직접 입력을 이용해 주세요.');
        setImportStatus(null);
        return;
      }

      if (res1?.data) {
        const analyzedFacts = res1.data;
        onUpdateProductInfo({
          ...productInfo,
          ...dataToAnalyze,
          category_name: analyzedFacts.category_name || productInfo.category_name,
          verified_facts: analyzedFacts.verified_facts || productInfo.verified_facts,
          category_facts: analyzedFacts.category_facts || productInfo.category_facts,
          use_cases: analyzedFacts.use_cases || productInfo.use_cases,
          visual_features: analyzedFacts.visual_features || productInfo.visual_features,
          prohibited_claims: analyzedFacts.prohibited_claims || productInfo.prohibited_claims,
          search_terms: analyzedFacts.search_terms || productInfo.search_terms
        });
      }

      if (res2?.data) {
        setPipelineV2(res2.data);
      }
      setImportStatus('v2.1 Gemini 팩트체크 & 숏폼 파이프라인 분석 완료!');
    } catch (err) {
      console.error(err);
      setErrorMessage('정확한 URL 데이터를 가져오지 못했습니다. 크롬 확장 프로그램 수집기 또는 JSON 직접 입력을 이용해 주세요.');
      setImportStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset: ProductFacts) => {
    onUpdateProductInfo(preset);
    setJsonInput(JSON.stringify(preset, null, 2));
    setUrlInput(preset.source_url || '');
    setErrorMessage(null);
    setImportStatus(`'${preset.product_name.slice(0, 20)}...' 프리셋 로드 완료`);
  };

  // STEP 1: 📦 데이터 입력 전용 UI
  if (viewMode === 'input') {
    return (
      <div className="p-4 md:p-6 bg-[#0f0e17] text-slate-200 min-h-full space-y-5 overflow-x-hidden w-full max-w-full">
        {/* Step Header */}
        <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-4 md:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">1단계: 📦 상품 데이터 수집 & JSON 입력</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              쿠팡/11번가 URL 수집, JSON 직접 입력, 또는 파이프라인 테스트용 추천 프리셋을 선택하세요.
            </p>
          </div>

          <button
            onClick={onNextStep}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-md shadow-purple-900/40 flex items-center justify-center space-x-1.5 transition shrink-0"
          >
            <span>2단계 팩트 분석 결과 보기</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Input Control Panel (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span>상품 데이터 수집 방식 선택</span>
                </h3>
                <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded font-mono">
                  v2.1 Coupang Collector
                </span>
              </div>

              {/* Sub Tab Switcher */}
              <div className="flex bg-[#110f1e] p-1 rounded-lg border border-[#272342] mb-4">
                <button
                  onClick={() => { setActiveTab('url'); setErrorMessage(null); }}
                  className={`flex-1 text-xs py-2 font-medium rounded-md flex items-center justify-center space-x-1.5 transition ${
                    activeTab === 'url' ? 'bg-[#2b254d] text-purple-300 shadow font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>URL 가져오기</span>
                </button>
                <button
                  onClick={() => { setActiveTab('json'); setErrorMessage(null); }}
                  className={`flex-1 text-xs py-2 font-medium rounded-md flex items-center justify-center space-x-1.5 transition ${
                    activeTab === 'json' ? 'bg-[#2b254d] text-purple-300 shadow font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>상품 JSON</span>
                </button>
                <button
                  onClick={() => { setActiveTab('screenshot'); setErrorMessage(null); }}
                  className={`flex-1 text-xs py-2 font-medium rounded-md flex items-center justify-center space-x-1.5 transition ${
                    activeTab === 'screenshot' ? 'bg-[#2b254d] text-purple-300 shadow font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>스크린샷 업로드</span>
                </button>
                <button
                  onClick={() => { setActiveTab('presets'); setErrorMessage(null); }}
                  className={`flex-1 text-xs py-2 font-medium rounded-md flex items-center justify-center space-x-1.5 transition ${
                    activeTab === 'presets' ? 'bg-[#2b254d] text-purple-300 shadow font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>추천 프리셋</span>
                </button>
              </div>

              {/* URL Input Tab */}
              {activeTab === 'url' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300 block">
                      쇼핑몰 상품 페이지 URL (쿠팡, 11번가, 네이버 등)
                    </label>
                    <span className="text-[10px] text-purple-400 font-semibold">
                      * 분석하고 싶은 실제 상품 URL 입력
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="예: https://www.coupang.com/vp/products/7335293202"
                        className="w-full bg-[#110f1e] border border-[#2d284e] rounded-lg pl-3 pr-9 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 min-w-0"
                      />
                      {urlInput.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setUrlInput('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors p-1"
                          title="초기화"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleAnalyze()}
                      disabled={isLoading}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2.5 rounded-lg font-bold transition flex items-center justify-center space-x-1 disabled:opacity-50 shrink-0 shadow-md shadow-purple-900/30"
                    >
                      {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>URL 수집 실행</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                    * 사용자가 직접 판매/홍보하려는 실제 쿠팡 파트너스 또는 쇼핑몰 URL을 입력창에 넣고 <strong className="text-purple-300 font-normal">URL 수집 실행</strong> 버튼을 눌러주시면 됩니다.
                  </p>
                </div>
              )}

              {/* JSON Input Tab */}
              {activeTab === 'json' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-slate-300">
                      상품 정보 JSON 스키마
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Direct Injection</span>
                  </div>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    rows={9}
                    className="w-full bg-[#110e1c] border border-[#272342] rounded-lg p-3 text-[11px] font-mono text-purple-200 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                  />
                  <button
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(jsonInput);
                        handleAnalyze(parsed);
                      } catch (e) {
                        setErrorMessage('유효하지 않은 JSON 형식을 확인해 주세요.');
                      }
                    }}
                    disabled={isLoading}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs py-2.5 rounded-lg font-semibold transition flex items-center justify-center space-x-2 shadow-md shadow-purple-900/30"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>JSON 데이터 적용 및 분석</span>
                  </button>
                </div>
              )}

              {/* Screenshot Upload Tab — Gemini Vision reads product page / review page captures */}
              {activeTab === 'screenshot' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-slate-300">
                      상품 페이지 / 후기 페이지 스크린샷
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Gemini Vision Auto-Fill</span>
                  </div>

                  <label className="w-full cursor-pointer bg-[#110f1e] hover:bg-[#181433] border border-dashed border-[#3b3363] rounded-lg py-6 flex flex-col items-center justify-center space-y-1.5 transition">
                    <Upload className="w-5 h-5 text-purple-400" />
                    <span className="text-xs text-purple-200 font-medium">스크린샷 이미지 선택 (여러 장 가능)</span>
                    <span className="text-[10px] text-slate-500">상품명/가격이 보이는 화면 + 후기 화면을 함께 올리면 더 정확합니다</span>
                    <input type="file" accept="image/*" multiple onChange={handleScreenshotSelect} className="hidden" />
                  </label>

                  {screenshotFiles.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {screenshotFiles.map((f) => (
                        <div key={f.id} className="relative group rounded-lg overflow-hidden border border-[#2d2948] aspect-square bg-black">
                          <img src={f.base64} alt={f.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveScreenshot(f.id)}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-rose-900/80 text-white p-1 rounded-md transition"
                            title="제거"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleAnalyzeScreenshots}
                    disabled={isAnalyzingScreenshot || screenshotFiles.length === 0}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs py-2.5 rounded-lg font-semibold transition flex items-center justify-center space-x-2 shadow-md shadow-purple-900/30 disabled:opacity-50"
                  >
                    {isAnalyzingScreenshot ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    <span>{isAnalyzingScreenshot ? 'AI가 스크린샷 읽는 중...' : 'AI로 스크린샷 분석 & 자동 입력'}</span>
                  </button>

                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                    * 쿠팡 파트너스 URL은 위 <strong className="text-purple-300 font-normal">URL 가져오기</strong> 탭에 그대로 입력해 두시면
                    스크린샷 분석 결과와 함께 저장됩니다 (링크 발급 자체는 쿠팡 파트너스 사이트에서 직접 진행하셔야 합니다).
                  </p>
                </div>
              )}

              {/* Presets Tab */}
              {activeTab === 'presets' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    최근 수집 및 적용된 상품
                  </label>

                  {/* Active Product from Tab 1 */}
                  {productInfo.product_name ? (
                    <div
                      onClick={() => handleSelectPreset(productInfo)}
                      className="bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/50 p-3 rounded-lg cursor-pointer transition flex items-center justify-between group shadow-sm"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                            🔥 현재 선택된 연동 상품
                          </span>
                        </div>
                        <p className="text-xs font-bold text-purple-200 group-hover:text-white transition truncate">
                          {productInfo.product_name}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-300">
                          <span>{productInfo.category_name || '쇼핑 아이디어'}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{productInfo.price || '실시간 검증'}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />
                    </div>
                  ) : (
                    <div className="p-6 bg-[#110f1e] border border-[#272342] rounded-lg text-center space-y-2">
                      <p className="text-xs text-slate-400">저장된 상품 프리셋이 없습니다.</p>
                      <p className="text-[11px] text-slate-500">상단의 [URL 가져오기] 탭에서 쇼핑몰 링크를 입력해 주세요.</p>
                    </div>
                  )}

                  {MOCK_PROJECTS.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => handleSelectPreset(proj.productInfo)}
                      className="bg-[#110f1f] hover:bg-[#201c38] border border-[#272342] hover:border-purple-500 p-3 rounded-lg cursor-pointer transition flex items-center justify-between group"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-200 group-hover:text-purple-300 transition truncate">
                          {proj.productInfo.product_name}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                          <span>{proj.productInfo.category_name}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{proj.productInfo.price || '가성비 검증'}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              {errorMessage && (
                <div className="mt-3 bg-[#2b181b] border border-rose-800/60 p-3 rounded-lg text-xs text-rose-200 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-tight">{errorMessage}</span>
                </div>
              )}

              {importStatus && (
                <div className="mt-3 bg-[#131122] border border-[#2c264a] px-3 py-2 rounded-lg text-xs text-purple-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Loaded Product Info Summary (5 Cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-5 shadow-lg space-y-4">
              <div className="border-b border-[#2d2948] pb-3">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  현재 로드된 상품 정보
                </span>
                <h3 className="text-sm font-bold text-white mt-1 leading-snug">
                  {productInfo.product_name}
                </h3>
                <p className="text-xs text-emerald-400 font-semibold mt-1">
                  {productInfo.price || '가격 정보 보유'} ({productInfo.category_name})
                </p>
              </div>

              {/* Multilingual Search Terms Box */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <span>소스를 찾기 위한 검색 키워드</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">한국어 키워드</span>
                    <div className="flex flex-wrap gap-1.5">
                      {productInfo.search_terms?.ko?.map((term, i) => (
                        <span key={i} className="bg-[#241f3f] border border-[#3b3363] text-purple-200 text-[11px] px-2 py-0.5 rounded-full">
                          #{term}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">중국어 (공장/원천 소스)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {productInfo.search_terms?.zh?.map((term, i) => (
                        <span key={i} className="bg-[#1c2238] border border-[#2d3a5e] text-indigo-200 text-[11px] px-2 py-0.5 rounded-full">
                          #{term}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onNextStep}
                  className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs py-3 rounded-xl font-bold shadow-lg shadow-purple-950/60 flex items-center justify-center space-x-2 transition"
                >
                  <span>🔍 2단계: 팩트 분석 결과 검증하기</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: 🔍 팩트 분석 전용 UI
  return (
    <div className="p-4 md:p-6 bg-[#0f0e17] text-slate-200 min-h-full space-y-5 overflow-x-hidden w-full max-w-full">
      {/* Step Header */}
      <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-4 md:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">2단계: 🔍 팩트 분석 및 과장광고 안심 필터</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            수집된 상품 데이터를 정밀 검증하여 허위/과장 광고 요소를 제거하고 팩트 중심 숏폼 스펙을 구성했습니다.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onPrevStep && (
            <button
              onClick={onPrevStep}
              className="bg-[#211c3a] hover:bg-[#2b254a] text-slate-300 border border-[#3b3260] text-xs px-3 py-2 rounded-xl font-medium transition shrink-0"
            >
              ← 1단계 수정
            </button>
          )}
          <button
            onClick={onNextStep}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-md shadow-purple-900/40 flex items-center space-x-1.5 transition shrink-0"
          >
            <span>3단계 대본 생성 이동</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-[#181628] border border-[#2d2948] rounded-xl p-5 shadow-lg space-y-5">
        <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
          <div>
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
              {productInfo.category_name || '주방용품/세제'}
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              {productInfo.product_name}
            </h3>
          </div>
          <span className="text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
            ✓ 팩트 검증 완료
          </span>
        </div>

        {/* Verified Claims (Green Cards) */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>검증된 제품 스펙 및 사실 (VERIFIED CLAIMS)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {(productInfo.verified_facts || []).map((claim) => (
              <div
                key={claim.claim_id}
                className="bg-[#121920] border border-emerald-900/40 p-3 rounded-lg space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-200">{claim.claim}</span>
                  <span className="bg-emerald-950 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-mono border border-emerald-800/40">
                    {claim.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  <span className="text-purple-400 font-medium">안심 추천 문구:</span> "{claim.safe_wording}"
                </p>
                <span className="text-[10px] text-slate-500 block">출처: {claim.source}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prohibited Claims / Risk Filters */}
        <div className="space-y-2 pt-1">
          <h3 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>과장광고 안심 필터 (자동 차단 금지 표현)</span>
          </h3>

          <div className="bg-[#211b1b] border border-amber-900/40 p-3.5 rounded-lg space-y-1.5">
            <p className="text-xs text-amber-200 font-medium">
              대본 및 나레이션에서 자동 차단되는 위험 위험 표현:
            </p>
            <ul className="list-disc list-inside text-[11px] text-amber-300/80 space-y-1">
              {(productInfo.prohibited_claims || []).map((claim, idx) => (
                <li key={idx}>{claim}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Use Cases & Visual Scenarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="bg-[#121020] border border-[#272342] p-3.5 rounded-lg space-y-1.5">
            <span className="text-xs font-bold text-purple-300 block">추천 사용 상황 (Use Cases)</span>
            <ul className="text-[11px] text-slate-300 space-y-1">
              {(productInfo.use_cases || []).map((uc, i) => (
                <li key={i} className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                  <span>{uc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#121020] border border-[#272342] p-3.5 rounded-lg space-y-1.5">
            <span className="text-xs font-bold text-indigo-300 block">시각적 포인트 (Visual Features)</span>
            <ul className="text-[11px] text-slate-300 space-y-1">
              {(productInfo.visual_features || []).map((vf, i) => (
                <li key={i} className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                  <span>{vf}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Gemini v2.1 Structured Pipeline Output Card */}
        {pipelineV2 && (
          <div className="bg-[#121022] border border-purple-800/40 p-4 rounded-xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-2">
              <span className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Gemini 지시문 v2.1 Structured JSON 결과</span>
              </span>
              <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded font-mono">
                Schema v2.1 Verified
              </span>
            </div>

            {/* Fact Check */}
            {pipelineV2.fact_check && (
              <div className="space-y-1.5 bg-[#0e0d1a] p-3 rounded-lg border border-[#262045]">
                <span className="text-xs font-bold text-emerald-400 block">
                  킬러 팩트 (Killer Fact): {pipelineV2.fact_check.killer_fact}
                </span>
                <div className="text-[11px] text-slate-300 space-y-1 pt-1">
                  <p className="font-semibold text-purple-300">검증 완료 스펙:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    {pipelineV2.fact_check.verified_specs?.map((spec: string, idx: number) => (
                      <li key={idx}>{spec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onNextStep}
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-950/60 flex items-center space-x-2 transition"
          >
            <span>📝 3단계: 대본 스타일 & 생성 단계로 이동</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

