// Wraps fetch() for every Gemini-backed API call, automatically attaching the user's own
// Gemini API key (if they've set one in Settings) so their usage bills against their own
// key instead of the shared admin key. Falls back silently to the server's admin key when
// the user hasn't configured one — see getUserGeminiKey() in server.ts.
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const geminiKey = localStorage.getItem('lucy_api_gemini_key') || '';
  const youtubeKey = localStorage.getItem('lucy_api_youtube_key') || '';
  const falKey = localStorage.getItem('lucy_api_fal_key') || '';
  const claudeKey = localStorage.getItem('lucy_api_claude_key') || '';
  const headers = new Headers(options.headers || {});
  if (geminiKey) headers.set('x-gemini-key', geminiKey);
  if (youtubeKey) headers.set('x-youtube-key', youtubeKey);
  if (falKey) headers.set('x-fal-key', falKey);
  if (claudeKey) headers.set('x-claude-key', claudeKey);
  return fetch(url, { ...options, headers });
}
