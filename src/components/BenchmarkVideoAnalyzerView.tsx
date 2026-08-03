import React, { useState } from 'react';
import { SceneItem } from '../types';
import { apiFetch } from '../utils/apiClient';
import { Video, Image as ImageIcon, Sparkles, RefreshCw, X, Wand2, Film, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BenchmarkCut {
  scene_id: string;
  start_sec?: number;
  end_sec?: number;
  suggested_duration_sec?: number;
  purpose: string;
  camera_movement: string;
  composition_notes: string;
  pacing_notes: string;
  fal_reference_prompt: string;
  fal_video_prompt: string;
}

interface BenchmarkVideoAnalyzerViewProps {
  onApply: (scenes: SceneItem[]) => void;
  onClose: () => void;
  productName?: string;
}

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const BenchmarkVideoAnalyzerView: React.FC<BenchmarkVideoAnalyzerViewProps> = ({ onApply, onClose, productName }) => {
  const [videoFile, setVideoFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [productContext, setProductContext] = useState(productName || '');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cuts, setCuts] = useState<BenchmarkCut[] | null>(null);

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalysisError(null);
    const base64 = await readFileAsBase64(file);
    setVideoFile({ base64, mimeType: file.type || 'video/mp4', name: file.name });
  };

  const handleProductImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalysisError(null);
    setIsUploadingImage(true);
    try {
      const base64 = await readFileAsBase64(file);
      setProductImagePreview(base64);
      const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, fileName: file.name, mimeType: file.type })
      });
      const data = await res.json();
      if (data?.status === 'success' && data?.url) {
        setProductImageUrl(data.url);
      } else {
        setAnalysisError('제품 이미지 업로드에 실패했습니다.');
      }
    } catch (err) {
      setAnalysisError('제품 이미지 업로드 요청이 실패했습니다.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      setAnalysisError('먼저 벤치마킹 영상(MP4)을 업로드해 주세요.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await apiFetch('/api/analyze-benchmark-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: { base64: videoFile.base64, mimeType: videoFile.mimeType },
          productContext
        })
      });
      const data = await res.json();
      if (data?.status === 'error') {
        setAnalysisError(data.message || '영상 분석에 실패했습니다.');
        return;
      }
      if (Array.isArray(data?.data)) {
        setCuts(data.data);
      }
    } catch (err) {
      console.error(err);
      setAnalysisError('영상 분석 요청이 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateCut = (index: number, field: keyof BenchmarkCut, value: string) => {
    if (!cuts) return;
    const updated = [...cuts];
    updated[index] = { ...updated[index], [field]: value };
    setCuts(updated);
  };

  const handleApply = () => {
    if (!cuts || cuts.length === 0) return;
    let currentTime = 0;
    const scenes: SceneItem[] = cuts.map((cut, idx) => {
      const duration = cut.suggested_duration_sec || (cut.end_sec && cut.start_sec ? cut.end_sec - cut.start_sec : 4);
      const start = currentTime;
      const end = currentTime + duration;
      currentTime = end;
      return {
        scene_id: `B${String(idx + 1).padStart(2, '0')}`,
        order: idx + 1,
        start_time: start,
        end_time: end,
        duration,
        purpose: (cut.purpose as SceneItem['purpose']) || 'use_case',
        narration: '나레이션을 입력하거나 3단계에서 선택한 대본을 참고해 채워주세요.',
        subtitle: cut.composition_notes?.slice(0, 24) || '자막 문구 입력',
        required_visual: cut.composition_notes || cut.camera_movement || '',
        preferred_source_grade: 'A',
        source_type: 'AI',
        transition: 'HARD_CUT',
        ai_prompt: cut.fal_video_prompt,
        fal_reference_prompt: cut.fal_reference_prompt,
        product_reference_image_url: productImageUrl || undefined
        // media_url intentionally left unset — this scene still needs the reference-image
        // compositing + video-gen steps, which StoryboardTimelineView's bulk generator only
        // runs on scenes without media_url.
      };
    });
    onApply(scenes);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#14121f] border border-purple-800/50 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#181628] border-b border-[#2d2948] p-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2.5">
            <div className="bg-purple-900/60 border border-purple-700/50 p-2 rounded-lg">
              <Film className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">🎯 벤치마킹 영상으로 AI 재창조</h3>
              <p className="text-[11px] text-slate-400">원본 영상의 구도/카메라워킹/템포만 분석해서 내 제품으로 100% 새로 생성합니다</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#241f3d] rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!cuts && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="cursor-pointer bg-[#110f1e] hover:bg-[#181433] border border-dashed border-[#3b3363] rounded-xl p-4 flex flex-col items-center justify-center space-y-1.5 transition min-h-[110px]">
                  <Video className="w-5 h-5 text-purple-400" />
                  <span className="text-xs text-purple-200 font-medium text-center">
                    {videoFile ? videoFile.name : '벤치마킹 영상(MP4) 업로드'}
                  </span>
                  <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
                </label>

                <label className="cursor-pointer bg-[#110f1e] hover:bg-[#181433] border border-dashed border-[#3b3363] rounded-xl p-4 flex flex-col items-center justify-center space-y-1.5 transition min-h-[110px] relative overflow-hidden">
                  {productImagePreview ? (
                    <img src={productImagePreview} alt="product" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                  ) : null}
                  <ImageIcon className="w-5 h-5 text-purple-400 relative z-10" />
                  <span className="text-xs text-purple-200 font-medium text-center relative z-10">
                    {isUploadingImage ? '업로드 중...' : productImageUrl ? '제품 이미지 업로드됨' : '내 제품 이미지 업로드'}
                  </span>
                  <input type="file" accept="image/*" onChange={handleProductImageSelect} className="hidden" />
                </label>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">제품 설명 (AI가 분석 결과를 이 상품에 맞춰 조정합니다)</label>
                <textarea
                  value={productContext}
                  onChange={(e) => setProductContext(e.target.value)}
                  rows={2}
                  placeholder="예: 차량용 접이식 무선 선풍기, 화이트/그레이 색상, USB-C 충전"
                  className="w-full bg-[#110e1c] border border-[#272342] rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {analysisError && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-200 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{analysisError}</span>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !videoFile}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[44px]"
              >
                {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>{isAnalyzing ? 'AI가 영상을 역기획하는 중... (최대 1~2분)' : 'AI로 벤치마킹 영상 역기획'}</span>
              </button>
            </>
          )}

          {cuts && (
            <>
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-[11px] text-emerald-200 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{cuts.length}개 컷으로 분석 완료. 필요하면 아래에서 구도/템포 설명을 수정한 뒤 적용하세요.</span>
              </div>

              <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                {cuts.map((cut, idx) => (
                  <div key={cut.scene_id || idx} className="bg-[#121020] border border-[#272342] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300 font-mono">{cut.scene_id}</span>
                      <span className="text-[10px] bg-[#28214b] text-indigo-200 px-2 py-0.5 rounded border border-purple-800/40">
                        {cut.purpose} · {cut.suggested_duration_sec || (cut.end_sec! - cut.start_sec!)}초
                      </span>
                    </div>
                    <textarea
                      value={cut.composition_notes}
                      onChange={(e) => handleUpdateCut(idx, 'composition_notes', e.target.value)}
                      rows={2}
                      className="w-full bg-[#0f0d1c] border border-[#272147] rounded-lg p-2 text-[11px] text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                      placeholder="구도 설명"
                    />
                    <div className="text-[10px] text-slate-500">카메라: {cut.camera_movement} · 템포: {cut.pacing_notes}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCuts(null)}
                  className="flex-1 bg-[#231f3c] hover:bg-[#2e294f] text-slate-200 text-xs py-2.5 rounded-xl font-medium border border-[#3b3464] transition"
                >
                  다시 분석
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>이 구성으로 스토리보드 적용</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
