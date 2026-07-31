import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Play,
  Download,
  FileText,
  Copy,
  Trash2,
  ShieldCheck,
  Check,
  X,
  Film,
  Calendar,
  HardDrive
} from 'lucide-react';
import { CompletedProject } from '../types';
import { loadCompletedProjects, deleteCompletedProject } from '../utils/projectsStore';

export const ProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<CompletedProject[]>([]);
  const [selectedVideoModal, setSelectedVideoModal] = useState<CompletedProject | null>(null);
  const [copiedMetaId, setCopiedMetaId] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedProjects().then(setProjects);
  }, []);

  const handleDeleteProject = async (id: string) => {
    if (confirm('이 프로젝트 결과물을 삭제하시겠습니까?')) {
      setProjects(await deleteCompletedProject(id));
      if (selectedVideoModal?.id === id) {
        setSelectedVideoModal(null);
      }
    }
  };

  const handleDownloadMp4 = (project: CompletedProject) => {
    const a = document.createElement('a');
    a.href = project.videoUrl;
    a.download = `${project.productName}_쇼츠완성본_1080x1920.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSrt = (project: CompletedProject) => {
    const blob = new Blob([project.srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.productName}_자막.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMetadata = (project: CompletedProject) => {
    const fullText = `[제목]\n${project.metaData.youtubeTitle}\n\n[해시태그]\n${project.metaData.hashtags.join(
      ' '
    )}\n\n[설명 / 쿠팡 파트너스 문구]\n${project.metaData.description}`;
    navigator.clipboard.writeText(fullText);
    setCopiedMetaId(project.id);
    setTimeout(() => setCopiedMetaId(null), 2500);
  };

  return (
    <div className="p-4 md:p-6 bg-[#0f0e17] text-slate-200 min-h-full space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="bg-[#181628] border border-[#2d2948] rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-purple-900/50 border border-purple-500/40 rounded-xl text-purple-300">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">📁 내 프로젝트 (완성본 갤러리)</h1>
              <p className="text-xs text-slate-400">
                렌더링 완료된 1080x1920 60fps 쇼핑 쇼츠 MP4 영상 및 .SRT 자막 보관소입니다.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center space-x-3 text-xs shrink-0">
          <div className="bg-[#121020] border border-[#2b254d] px-3.5 py-2 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block">총 완성본 영상</span>
            <span className="text-sm font-bold text-purple-300">{projects.length}개</span>
          </div>
          <div className="bg-[#121020] border border-[#2b254d] px-3.5 py-2 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block">출고 규격</span>
            <span className="text-sm font-bold text-emerald-400">1080x1920 MP4</span>
          </div>
        </div>
      </div>

      {/* Projects Cards Grid */}
      {projects.length === 0 ? (
        <div className="bg-[#181628] border border-[#2d2948] rounded-2xl p-12 text-center space-y-3">
          <Film className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">저장된 완성본 프로젝트가 없습니다</h3>
          <p className="text-xs text-slate-500">
            좌측 워크플로우 단계에 따라 쇼츠 대본 및 미디어를 생성 후 렌더링을 진행하세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="bg-[#181628] border border-[#2d2948] rounded-2xl overflow-hidden shadow-xl hover:border-purple-500/50 transition flex flex-col group"
            >
              {/* Video Thumbnail & Preview Trigger */}
              <div
                onClick={() => setSelectedVideoModal(proj)}
                className="relative aspect-[9/16] max-h-[320px] bg-black cursor-pointer overflow-hidden group/thumb"
              >
                <img
                  src={proj.thumbnailUrl}
                  alt={proj.title}
                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-300 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition border border-purple-300/40">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>

                {/* Badges on Thumbnail */}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-purple-300 border border-purple-500/40">
                  9:16 vertical
                </div>
                <div className="absolute top-3 right-3 bg-emerald-950/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>안전도 {proj.safetyScore}점</span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] text-purple-200 font-semibold bg-purple-900/60 px-2 py-0.5 rounded border border-purple-700/50 inline-block mb-1">
                    {proj.productName}
                  </span>
                  <h3 className="text-xs font-bold leading-snug line-clamp-2">{proj.title}</h3>
                </div>
              </div>

              {/* Card Body Information */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-[#2d2948] pb-2">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{proj.createdAt}</span>
                    </span>
                    <span className="flex items-center space-x-1 font-mono text-slate-300">
                      <HardDrive className="w-3 h-3 text-slate-500" />
                      <span>{proj.fileSizeMb}MB</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 bg-[#110f1f] p-2.5 rounded-lg border border-[#262142] line-clamp-2">
                    {proj.metaData.youtubeTitle}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-[#2d2948]">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleDownloadMp4(proj)}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold py-2 px-2.5 rounded-xl transition flex items-center justify-center space-x-1 shadow-md shadow-purple-950/50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>MP4 영상</span>
                    </button>

                    <button
                      onClick={() => handleDownloadSrt(proj)}
                      className="bg-[#211c3a] hover:bg-[#2b254c] text-purple-200 border border-[#3c3361] text-[11px] font-bold py-2 px-2.5 rounded-xl transition flex items-center justify-center space-x-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-purple-300" />
                      <span>.SRT 자막</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCopyMetadata(proj)}
                      className="flex-1 bg-[#121020] hover:bg-[#1a172e] text-slate-300 border border-[#2b254d] text-[11px] font-medium py-1.5 px-2 rounded-lg transition flex items-center justify-center space-x-1"
                    >
                      {copiedMetaId === proj.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">복사 완료</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>태그/메타 복사</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteProject(proj.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition shrink-0"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 9:16 Video Player Modal */}
      {selectedVideoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#181628] border border-[#3b3263] rounded-2xl max-w-lg w-full p-5 space-y-4 relative shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#2d2948] pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h3 className="text-sm font-bold text-white truncate max-w-[280px]">
                  {selectedVideoModal.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVideoModal(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-[#251f40] rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Container */}
            <div className="relative aspect-[9/16] max-h-[480px] bg-black rounded-xl overflow-hidden mx-auto shadow-inner border border-[#2b254d]">
              <video
                src={selectedVideoModal.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#2d2948]">
              <button
                onClick={() => handleDownloadMp4(selectedVideoModal)}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>1080x1920 MP4 다운로드</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
