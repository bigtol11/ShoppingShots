import { CompletedProject } from '../types';

// Completed projects live server-side per logged-in account, so the "내 프로젝트" gallery
// is the same across every device/browser signed into that account.

export async function loadCompletedProjects(): Promise<CompletedProject[]> {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    return Array.isArray(data?.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

export async function saveCompletedProject(project: CompletedProject): Promise<CompletedProject[]> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project)
  });
  const data = await res.json();
  return Array.isArray(data?.projects) ? data.projects : [];
}

export async function deleteCompletedProject(id: string): Promise<CompletedProject[]> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return Array.isArray(data?.projects) ? data.projects : [];
}
