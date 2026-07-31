import { SceneItem, ProjectData } from '../types';

export function generateSrtSubtitles(scenes: SceneItem[]): string {
  let srtContent = '';
  let index = 1;

  scenes.forEach((scene) => {
    if (!scene.subtitle) return;

    const startMs = scene.start_time * 1000;
    const endMs = scene.end_time * 1000;

    const formatSrtTime = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const milliseconds = Math.floor(ms % 1000);

      const pad = (n: number, z = 2) => String(n).padStart(z, '0');
      const padMs = (n: number) => String(n).padStart(3, '0');

      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${padMs(milliseconds)}`;
    };

    srtContent += `${index}\n`;
    srtContent += `${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n`;
    srtContent += `${scene.subtitle}\n\n`;
    index++;
  });

  return srtContent.trim();
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadProjectManifest(project: ProjectData) {
  const jsonString = JSON.stringify(project, null, 2);
  downloadFile(jsonString, `${project.name || 'shopping_shorts'}_project.json`, 'application/json');
}
