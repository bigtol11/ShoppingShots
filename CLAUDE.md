# CLAUDE.md — ShoppingShots (쇼핑쇼츠 자동화)

This file exists so that any Claude Code session — on any PC — can pick up this
project with full context even if the chat history itself doesn't carry over.
Read this first before making changes.

## ⚠️ Versioning convention — always bump on every deploy

`package.json`'s `"version"` field is the single source of truth for the version
badge shown in the UI (Header + Sidebar, via `__APP_VERSION__` injected by
`vite.config.ts`) and in the server startup log. **Before every Cloud Run
deploy, bump the patch number** (1.0.1 → 1.0.2 → 1.0.3 → ...) and commit that
change as part of the same batch. This is an explicit standing instruction
from the user (2026-08-01) — they use the visible version number to confirm
which deployed build they're looking at, matching the pattern already used in
their other project (ShortDramaProject shows "Shorts Engine v1.5.2" in its
header). Do not skip this even for tiny changes.

## ⚠️ Project isolation — read this first

The user runs **two separate, unrelated projects** side by side:
- **ShortDramaProject** ("Shorts Engine", AI drama-shorts generator) at `E:\ShortDramaProject`.
- **ShoppingShots** (this project, Coupang Partners shopping-shorts automation) at `E:\ShoppingShots`.

They share a similar stack (React+Vite+Express+Gemini, both originally AI-Studio
scaffolds) which makes mixups easy. **The user has repeatedly and explicitly
warned never to let work on one touch the other.** Their GCP/Firebase projects
are also completely separate (`gen-lang-client-0622256162` = ShortDramaProject,
`shoppingshots-prod` = this project) — see the gcloud section below for how
that isolation is enforced on this machine. Never read, edit, or run commands
against `E:\ShortDramaProject` while working on this project unless the user
explicitly asks for it in this project's conversation.

## What this project is

An AI-driven pipeline that turns a Coupang Partners product link into a
finished 9:16 shopping-shorts video (YouTube Shorts/TikTok/Reels style):
product fact-check → hook script → AI storyboard/media → TTS narration →
FFmpeg render → downloadable MP4. Originally an AI Studio scaffold; as of
2026-08-01 it has been fully rebuilt (see session log below) since roughly
half of the original scaffold was UI theater with no real backend behind it.

Stack: React 19 + Vite + Express (`server.ts`, single file, ~2400 lines) +
Google Gemini (`@google/genai`) + fal.ai (AI video gen) + FFmpeg (server-side
video assembly) + Firebase Admin (Firestore + Cloud Storage, optional/dual-mode).

## ⚠️ Deploy batching — don't deploy without being told

Build, fix, and commit freely at any time. But **do not run `gcloud run deploy`
until the user explicitly says to** — they batch up several fixes and deploy
them together, and don't want a `gcloud run deploy` (which takes several
minutes) firing after every small change while they're mid-conversation about
something else. Keep committing to git as you go (that's fine and expected),
just hold the actual Cloud Run deploy until asked. When they do say to deploy,
remember to bump the version first (see above).

## Live deployment

**https://shoppingshots-823154324409.us-west1.run.app**

- GCP project: `shoppingshots-prod`, region `us-west1`.
- Cloud Run service name: `shoppingshots`.
- Deploy with: `gcloud run deploy shoppingshots --source . --region us-west1 --configuration=shoppingshots ...` — see `DEPLOY.md` for the full command and required env vars/secrets.
- **gcloud configuration**: this machine has a `shoppingshots` gcloud configuration (account `bigtol11@gmail.com`, project `shoppingshots-prod`) kept deliberately separate from the `default` configuration (which points at ShortDramaProject's `gen-lang-client-0622256162`). **Always pass `--configuration=shoppingshots` on every gcloud command for this project.** gcloud's binary may not be on PATH for already-open shells after install — invoke via `C:\Users\ADMIN\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd` or prepend it to `$env:Path` per session.
- **Sign-in is Google-only** (Firebase Authentication, not the old email/password+invite-code system — that was fully removed). Access is gated by `ALLOWED_EMAILS` (comma-separated, server env var) — currently just `bigtol11@gmail.com`. Admin-only endpoints (fal.ai key mgmt, stats) are gated separately by `ADMIN_EMAILS`, checked against the same login session (no separate admin password).
- Firebase project `shoppingshots-prod`: Firestore + Cloud Storage enabled, service account key at `E:\ShoppingShots\service-account.json` (gitignored, never committed, never baked into the Docker image — see DEPLOY.md for why and how it's mounted via Secret Manager instead).
- Client-side Firebase web config (`src/firebaseConfig.ts`) is fetched via the Firebase Management API and committed — this is NOT secret, safe to have in the repo.

### Not yet deployed (committed to git, sitting in v1.0.3+, waiting for the user to say "deploy")
- Per-user Gemini API key (BYOK) — Settings has a Gemini key field now; falls back to the server's shared key if unset.
- fal.ai key — user provided a real key in chat (`e695724a-c909-4b7e-8f2e-5f8239d7dfb3:c3a8c1df7f07d2af0f1ef19b9b2495a7`) but it was never added to a deploy's `--set-env-vars FAL_KEY=...`. **The admin-panel "저장" button for fal.ai key only sets it in server memory (`serverFalKey`), which does NOT survive an instance restart/redeploy on Cloud Run** — better to just pass `FAL_KEY=` directly as a deploy-time env var like `GEMINI_API_KEY`, not rely on the admin panel for persistence.
- **Fixed a real bug in the fal.ai video pipeline that would have silently produced wrong results even with a valid key**: `/api/generate/video`'s 3-step I2V pipeline (rembg → flux compositing → video gen) all call `queue.fal.run`, which is fal.ai's *async* queue API — it returns a `{request_id, status_url, response_url}` ticket immediately, not the finished asset. The original code read the ticket response as if it were the final result (`data.video?.url` etc.), which is always `undefined` on a ticket object, so it always silently fell through to the sample-video fallback while still reporting `status: 'success'`. Added `pollFalQueueResult()` (polls `status_url` every 3s until `COMPLETED`, then fetches `response_url`) and rewired all 3 call sites. **Untested against the real API** (no live FAL_KEY deployed yet) — verify with a real key before trusting it end-to-end. Also bumped `DEPLOY.md`'s deploy command to `--timeout=540` since polling can now legitimately hold the HTTP request open for minutes.
- `ADMIN_EMAILS=bigtol11@gmail.com` needs to be added to the deploy command too (admin auth was reworked from a broken `ADMIN_SECRET` flow to reusing the login session).
- User said (2026-08-01) they want to revisit/reorganize the whole API-key setup again later before deploying — treat this as an open design conversation, not a settled plan, next time it comes up.

## Architecture

### 6-step pipeline (`src/App.tsx`, `STEP_SEQUENCE`)
1. **trend** (`TrendBenchmarkingView`) — optional trend/keyword discovery, real Gemini call.
2. **product** (`ProductImportView`) — Coupang URL/JSON import + fact-check, real Gemini calls (`/api/analyze-product`, `/api/gemini-pipeline-v2`).
3. **script** (`ScriptGeneratorView`) — 8 style options, real `/api/generate-scripts` call.
4. **storyboard** (`StoryboardTimelineView`) — AI scene breakdown (`/api/generate-storyboard`, triggered via an in-view button when scenes are empty), per-scene media upload/AI video gen, Ken Burns motion picker.
5. **audio** (`AudioStudioView`) — Gemini/Typecast/ElevenLabs TTS, combined narration audio stored on `audioConfig.narrationAudioBase64` for the render step to consume.
6. **render** (`VideoPreviewPlayer`) — real FFmpeg render + poll, thumbnail A/B, platform metadata, download. On success calls `App.tsx`'s `handleSaveCompletedProject` which persists to the server-side projects store.

Plus `settings` (API keys, admin fal.ai key panel) and `projects` (완성본 갤러리, `ProjectsView`) as top-level nav items outside the step sequence.

### Auth
Google Sign-In only (Firebase Authentication client SDK popup → ID token →
`/api/auth/google` verifies via `admin.auth().verifyIdToken()` → app issues its
own JWT session cookie). Gated by `ALLOWED_EMAILS`. The main page is visible
without forcing login; a top-right button in `Header.tsx` triggers sign-in.
`LoginView.tsx` was deleted — the old bcrypt+invite-code system it belonged to
is fully gone. Every `/api/*` route except `/api/auth/*` requires a valid
session (`requireUser` middleware, global `app.use('/api', ...)` gate in
`server.ts`). Admin-only endpoints are gated separately by `ADMIN_EMAILS`
checked against the same session (no separate admin password).

### Storage: dual-mode (local files ↔ Firestore/Cloud Storage)
Controlled entirely by whether `service-account.json` (or `FIREBASE_SERVICE_ACCOUNT_PATH`)
resolves to a real file at boot:
- **Configured** → user accounts + completed-project galleries live in Firestore
  (`users` collection, `users/{uid}/projects` subcollection); uploads and
  rendered MP4s live in Cloud Storage, served over public `storage.googleapis.com` URLs.
- **Not configured** (e.g. a fresh clone with no credentials) → falls back to
  local JSON files (`server_data/users.json`, `server_data/projects/{uid}.json`)
  and local disk (`public/uploads/`, `public/exports/`) — this is what runs
  during plain local `npm run dev` on a machine without `service-account.json`.

This fallback exists so local dev never breaks waiting on cloud credentials —
same philosophy as the rest of this codebase (never let an enhancement make
things *less* reliable than before it existed).

### Render pipeline (`server.ts`, `/api/render-video`)
Resolves each scene's `media_url` to a local file (`ensureLocalFile` — handles
`data:` URLs, `/uploads`/`/exports` paths, and SSRF-guarded remote http(s)
URLs), loops still images for their scene duration via `-loop 1 -t {duration}`,
concats everything, mixes in the narration track (raw 16-bit PCM @24kHz from
Gemini TTS, or provided as `audioConfig.narrationAudioBase64`) plus optional
BGM. Job status is tracked in an in-memory `renderJobs` Map — **this is
per-instance state**, which is why Cloud Run is deployed with
`--max-instances=1` (a status poll landing on a different instance than the
one running the render would 404 otherwise). Real failures now report
`status: 'error'` with the actual FFmpeg error — the original scaffold always
silently claimed `completed` and served a bundled sample video on any failure.

## Known gotchas / non-obvious things

- **Local dev has no ffmpeg** on this machine and Chocolatey install failed
  (no admin elevation in this environment) — rendering only actually works on
  the **deployed Cloud Run instance** (ffmpeg is baked into the Docker image).
  If the user wants local rendering too, they need to install ffmpeg
  themselves from an elevated PowerShell (`choco install ffmpeg -y`).
- **Cloud Run secret file mounts shadow their entire target directory.**
  Mounting `--set-secrets=/app/service-account.json=...` broke the first
  deploy attempt (`Cannot find module '/app/dist/server.cjs'`) because Cloud
  Run's secret volume mount replaces the *whole directory's* view at runtime,
  not just injects one file — `dist/`, `node_modules/`, everything else under
  `/app` became invisible. Fixed by mounting at `/secrets/service-account.json`
  (outside `/app` entirely) plus `FIREBASE_SERVICE_ACCOUNT_PATH` env var
  pointing there. **Never mount a Cloud Run secret at a path inside a
  directory that already has other files the app needs.**
- **Firebase default Storage bucket naming changed.** Projects created after
  ~Oct 2024 default to `<project_id>.firebasestorage.app`, not the older
  `<project_id>.appspot.com`. `server.ts` now defaults to the new convention;
  override via `FIREBASE_STORAGE_BUCKET` if a project uses the old one.
- **PORT must read `process.env.PORT`**, not be hardcoded — Cloud Run injects
  8080 and health-checks that exact port.
- Production build only serves `dist/` via `express.static` — files written
  to `public/uploads`/`public/exports` at *runtime* need their own explicit
  static routes (already added) since Vite's dev-time live serving of
  `public/` doesn't carry over to a production build.
- `npm run build` (`vite build && esbuild server.ts ... --outfile=dist/server.cjs`)
  has been verified to actually succeed both locally and inside Cloud Build.

## Session log

### 2026-08-01 — Full audit, rebuild, auth, Firestore/Storage migration, and first live deploy

Single continuous session (topic drifted in from a different project's
conversation initially — see the isolation warning above, this was the
trigger for that rule existing).

**Audit**: two parallel sub-agents audited `server.ts` and all frontend
components. Findings: render pipeline never actually used the user's real
scenes (field-name mismatch → always served a bundled sample video); render
failures were silently reported as "completed"; admin endpoints had zero
auth; SSRF/arbitrary-local-file-read risk in the ffmpeg helper; fake API-key
"validation" (just checked string length ≥ 8); misleading "Seedance
2.0/Veo3" AI-engine labels that didn't match the models actually called;
`PolicyAuditView` crashed on click (undefined access on an always-empty
array); several components were pure UI theater with hardcoded content and no
real API calls; 4 more-complete components existed in the repo but were never
wired into `App.tsx`, while thinner/faker duplicates were.

**Rebuild** (user's direction: "너무 복잡하고 제대로 작동도 안 되니 알아서 다 고치고
개선해서 만들어달라"): simplified 9 steps → 6, deleted 7 dead/fake
components, swapped in the more-complete ones that already existed
(StoryboardTimelineView, ScriptGeneratorView, VideoPreviewPlayer). Fixed the
render pipeline for real (field names, image looping, error reporting, safety
cap instead of a hardcoded 30s truncation). Added SSRF guard, admin
fail-closed gate (`ADMIN_SECRET`), real Typecast/ElevenLabs key validation,
honest AI-engine labels. Verified with `npx tsc --noEmit` (clean) and live
dev-server smoke tests throughout — including discovering mid-session that
`node_modules` had never actually been installed in this checkout.

**Deployment direction**: user revealed mid-session they already run
ShortDramaProject on Cloud Run (`us-west1`) via a URL they'd bookmarked —
decided to deploy this project the same way. Wrote `Dockerfile` (ffmpeg baked
in via apt-get) + `DEPLOY.md`, verified `npm run build` and a full production
`node dist/server.cjs` smoke test locally before ever touching Cloud Run.

**Auth**: user wants a login gate now (invite-only, "나 + 지인 몇 명"), explicitly
said commercialization-grade auth can be swapped in later. Built bcrypt +
JWT-cookie sessions, `LoginView.tsx`, invite-code-gated registration. Flagged
and fixed an important nuance the user hadn't considered: the completed-project
gallery was localStorage-only (wouldn't sync across devices for the same
account) — moved it server-side.

**Firestore/Cloud Storage migration**: user asked for this explicitly, aware
it requires a **separate new Firebase project** from ShortDramaProject's.
Built fully dual-mode (Firestore/Storage when `service-account.json` present,
local JSON/disk fallback otherwise) so local dev never breaks. gcloud/firebase
CLI weren't authenticated in this sandboxed environment, so the user had to
manually: create the `shoppingshots-prod` Firebase project, enable
Firestore+Storage, generate+place the service account key. Verified with real
round-trip writes against the live Firebase project (then cleaned up the test
data). Found and fixed the bucket-naming-convention bug this surfaced (see
gotchas above).

**GitHub**: user pasted GitHub's boilerplate "new repo" instructions
(`git init` etc.) — adapted to actually stage/commit the whole project
(respecting `.gitignore`) rather than literally following the snippet's
"add only README.md". Repo local git identity set (repo-local, not global)
since none existed on this machine. Pushed to `github.com/bigtol11/ShoppingShots`, `main` branch.

**First live Cloud Run deploy**: user again pointed out (correctly) that
ShortDramaProject didn't require manual gcloud CLI wrangling — that was
because ShortDramaProject was deployed via AI Studio's built-in one-click
Cloud Run deploy. Checked: this project has no GitHub-repo connection inside
AI Studio, so AI Studio's deploy button would only redeploy the *stale
pre-rebuild* scaffold, not today's work — confirmed with the user and
proceeded with gcloud CLI instead. gcloud wasn't installed and required the
user's own elevated PowerShell session (same admin-rights limitation hit
earlier with ffmpeg). Walked the user through `gcloud init` screenshot by
screenshot. **Critical moment**: `gcloud init`'s existing "default"
configuration showed `project: gen-lang-client-0622256162` — recognized this
as ShortDramaProject's project ID and had the user create a brand new named
configuration (`shoppingshots`) instead of re-initializing the default one,
preserving full isolation between the two projects' cloud tooling (see the
gcloud section above).

First deploy attempt failed (`Cannot find module '/app/dist/server.cjs'`)
despite Cloud Build succeeding — root-caused via `gcloud builds log` (confirmed
the build genuinely produced `dist/server.cjs`) and Cloud Run revision logs,
to the secret-mount-shadows-directory gotcha documented above. Fixed and
redeployed successfully. Verified the live URL end-to-end with real HTTP
requests (register, login, project save/list, file upload) directly against
`https://shoppingshots-823154324409.us-west1.run.app`, then cleaned up all
test accounts/files from the live Firestore/Storage project.

### 2026-08-01 (continued same day) — Google Sign-In, mobile UX, real Typecast, search-grounded trends, Gemini BYOK

User resumed and immediately flagged the invite-code email/password login as
wrong UX ("메인 페이지가 바로 로그인 창으로 나오면 안 됩니다") — wanted the
main page visible with a top-right login button, and login done via each
person's own Google account. **Fully replaced the custom bcrypt+JWT+invite-code
system with Firebase Authentication Google Sign-In** (see `src/firebaseConfig.ts`,
`src/utils/firebaseAuth.ts`, `/api/auth/google` in server.ts verifying the ID
token via `admin.auth().verifyIdToken()`), gated by `ALLOWED_EMAILS`. Fetched
the Firebase web app config via direct Management API calls (`gcloud auth
print-access-token` + REST) instead of making the user click through Firebase
Console — had to add `X-Goog-User-Project` header to work around a "no quota
project" 403. User caught a real deploy bug from a pasted ShortDramaProject
screenshot showing a version badge — added the same pattern here
(`__APP_VERSION__` from package.json, see the versioning section above).

**Mobile-first nav redesign**: replaced the cramped bottom tab bar with a
hamburger + slide-out drawer (`Sidebar.tsx` now serves both the desktop static
rail and the mobile drawer from shared content), fixed several fixed-pixel-width
elements that risked overflow on narrow phones.

**Rebranded** "Lucy AI Studio" → "ShoppingShots" everywhere (title, PWA
manifest, AI system-prompt identity string, server logs) — user wanted the
name to match the already-unified GitHub/Cloud Run/Firebase naming.

**Real Typecast integration** (user reported "키 인증 실패 HTTP 404"): the
inherited AI-Studio code called a hallucinated endpoint (`/v1/actors`) that
doesn't exist. Root-caused by testing directly against the real API with the
user's actual key via curl — found the true endpoints (`GET /v1/voices` or
`/v2/voices`, `POST /v1/text-to-speech`, header `X-API-KEY`, no Bearer prefix)
and confirmed all the way through to real synthesized WAV audio. Fixed
`/api/settings/validate-key`, `/api/tts/typecast/actors`, `/api/tts/preview`,
and `/api/generate-tts`, and fixed the render pipeline's narration decoding
(`AudioConfig.narrationAudioFormat`) since Typecast returns a real WAV
container while Gemini returns headerless raw PCM — they need different
ffmpeg input handling and were previously conflated.

**Trend recommendations switched to real Google Search grounding**: user
asked directly whether Gemini could do real-time search instead of pure
generation — yes, via the `tools: [{ googleSearch: {} }]` config (not
combinable with `responseMimeType: 'application/json'`, so responses are
parsed out of plain text via a small `extractJson()` helper). Upgraded
`/api/trends/analyze` and added a new `/api/trends/auto-recommend` that
fires on page load with no input needed — both verified live to return
genuinely current, specific results (e.g. real 2026 여름 폭염 product trends
with real citations), and both fail honestly (no fabricated fallback data)
if grounding/parsing fails.

**Declined to build**: user shared a manual workflow + pasted AI advice about
downloading Douyin/TikTok videos, stripping watermarks, and re-editing
(flip/speed/cuts) specifically to evade platform duplicate-content detection,
deliberately favoring foreign creators' content because enforcement is slower.
Refused this specific piece as systematic copyright infringement with
built-in detection evasion (not fair use, regardless of the "2차 가공"
framing) — offered legitimate alternatives (AI-generated clips, the user's
own product media, stock footage, official seller-provided assets) instead.
This was a judgment call, not a settled policy — revisit only if the user
pushes back with a materially different framing.

**Per-user Gemini API key (BYOK)**: user asked to confirm the admin's Gemini/
Typecast keys were the only ones in use, then asked for Gemini to become
per-user like Typecast already was. Threaded a `userKey` param through
`getGeminiClient()` at all ~11 call sites (reads `x-gemini-key` header or
`geminiKey` body field via `getUserGeminiKey(req)`), added a matching
`apiFetch()` client wrapper that auto-attaches the header from
`localStorage`, wired it into every Gemini-backed frontend call, and added a
Gemini key field to Settings. Falls back to the server's shared key when the
user hasn't set their own — never hard-fails a fresh account.

**Admin auth was actually broken**: user tried to save a real fal.ai key and
hit "관리자 기능이 비활성화되어 있습니다" — the `ADMIN_SECRET` env var had
simply never been set on any deploy. Rather than adding yet another secret to
manage, reworked `requireAdmin` to check the already-authenticated session's
email against `ADMIN_EMAILS` — no separate admin password at all now.

**User then paused all API-key work** ("api키 관련은 다음에 다시 정리해야겠습니다
... 기억해 놓고 계시고") — v1.0.3 (Gemini BYOK + admin auth fix) is committed
to git but **deliberately not deployed**; the live site is still v1.0.2. User
also gave a real fal.ai key in chat (see "Not yet deployed" list above) but
asked to hold off deploying it too. **Do not deploy any of this until told to.**

### 2026-08-01 (continued) — Home buttons, script-generation prompt overhaul (씬스팩토리TV v3.0 reference doc)

**Home button on every tab**: added a clickable logo + explicit "🏠 첫 화면"
nav button in `Header.tsx` (both return to `trend`, confirmed as the actual
first/main screen).

**Script generation prompt overhaul**: user shared a large external
instruction document ("씬스팩토리TV 멀티플랫폼 쇼핑 쇼츠 마스터 지시문 v3.0")
after two earlier upload attempts were unreadable (mojibake) — recovered by
having the user paste the raw text directly in chat. Explicitly scoped what
to adopt vs. skip before touching code: adopted the 5-step psychology
structure (의외성→공감→반전→소유욕→논쟁/저장욕), exact length discipline
(150~200자 for 15~20초, ~5~6글자/초), the product/brand-name-omission rule
(narration must say "이 제품/이거/이게", never the literal name — title/SEO
text is exempt since it needs the name for search), the "show a scene, don't
list a spec" rule, loop-back ending structure, and concrete comment/save-bait
closing-line patterns. Explicitly did NOT adopt: the document's hardcoded
personal channel name/link (too user-specific for a multi-tenant app) and its
chatbot-style step-by-step "wait for 시작 signal" conversational flow (this
app already has a stepped UI, that flow doesn't map onto it). Merged all of
this into the existing research-backed 6-hook-formula system (`/api/generate-scripts`
in `server.ts`) rather than replacing it — the two were complementary, not
conflicting.

Also updated `/api/generate-ai-video-prompt` with the same document's
AI-video motion-restraint rules (mandatory "The scene is exactly as the
reference image — do not change any detail." opening line; banned aggressive
verbs like slam/plunge/explode; only gentle verbs like slowly/gently/naturally
allowed; camera moves described as "drifts toward"/"orbits" rather than
"zoom") — this reduces product distortion in fal.ai-generated clips. And
improved `/api/seo/generate-metadata`'s prompt with the document's real
per-platform rules (YouTube title 14~16자, Reels hashtags capped at 5 per
2026 policy, Naver Clip title ≤24자 and must include product name since it's
search-driven, etc.) — **note this endpoint is still not called from any
frontend component** (confirmed dead/unwired in the original audit); only the
prompt content was improved, wiring it into `VideoPreviewPlayer` to replace
the static local SEO templates there is a separate, not-yet-requested task.

Verified with `npx tsc --noEmit` (clean). Committed to git.

### 2026-08-01 (continued) — v1.0.4 deploy, trend auto-fetch fix, and the manual-workflow gap analysis (v1.0.6)

**v1.0.4 deployed**: user said "지금 배포해 주세요" — deployed with `ADMIN_EMAILS`
and the real `FAL_KEY` added via `--update-env-vars` (merged, didn't touch
existing `GEMINI_API_KEY`/`JWT_SECRET`/etc.). This resolved the "관리자 기능이
비활성화되어 있습니다" error (root cause: `ADMIN_EMAILS` was simply never set
on any prior deploy). fal.ai key is now live but **still functionally
unverified against the real API** — the queue-polling fix from the previous
entry has never been exercised with real traffic.

**v1.0.5**: user reported the trend page's real-time search auto-fired on
every page load/refresh, burning Gemini search-grounding calls unasked.
Removed the `useEffect` that called `fetchAutoRecommend()` on mount; now
shows a "실시간 트렌드 탐색 시작" button and only fires on click. Deployed
same session at user's request.

**v1.0.6 — real manual-workflow comparison**: user walked through their full
10-step manual production process in detail (topic scouting via benchmark
channels → Coupang product confirmation → **downloading Douyin/TikTok source
clips via tikvideo.app, cutting to 2-4s, removing subtitles** → AI hook clip →
Typecast dubbing → CapCut assembly → per-platform upload). Compared it
directly against the code (not just the UI) and found two real gaps:
`/api/analyze-product` never actually fetches the Coupang URL — it silently
requires manual product-name/JSON entry, and the error message references a
Chrome extension collector that doesn't exist in this repo; and the fal.ai
video pipeline only ever generates one hook clip, so every other scene still
needed a manually-sourced clip.

**User explicitly and repeatedly pushed back** ("이부분은 해주셔야 합니다...
안된다고 하지 말고 모두 해주세요, 결정은 제가 하겠습니다", then reframed the
source clips as "판매자가 재사용하라고 올려둔 공식 소스") asking to build the
download-and-reuse feature. **Declined again, firmly, twice** — explained that
a generic URL/keyword-based downloader can't distinguish licensed seller
assets from any other creator's video, and that removing subtitles is
inconsistent with the "official permitted source" framing. This is not a
one-time judgment call to revisit casually — hold this position if asked
again without a materially different framing (e.g. an actual verifiable
manufacturer press-kit link, not a Douyin search result).

Used Plan Mode (plan saved at `C:\Users\ADMIN\.claude\plans\hidden-snacking-pelican.md`)
to scope the legitimate alternative, approved and implemented same session:
- **`/api/analyze-product-screenshot`** (new) — Gemini Vision reads uploaded
  product-page/review screenshots and auto-fills product_name/price/specs/
  reviews, replacing manual typing without needing Coupang scraping (ToS
  risk) or an official API integration. `/api/analyze-product`'s response
  schema was extracted into a shared `PRODUCT_ANALYSIS_SCHEMA` const (now
  includes `product_name`/`price`, which the original schema was missing).
  New 4th tab "📷 스크린샷 업로드" in `ProductImportView.tsx`.
- **Bulk AI scene generation** in `StoryboardTimelineView.tsx`
  (`handleGenerateAllScenes`) — fills every scene still missing media via the
  fal.ai pipeline sequentially, instead of one click per scene. This is the
  actual legitimate replacement for the declined source-clip downloading.
- **Wired `/api/seo/generate-metadata`** (previously dead code, unused by any
  frontend) into `VideoPreviewPlayer`'s platform metadata section,
  user-triggered via button (same reasoning as the v1.0.5 fix — don't
  auto-fire Gemini calls). Added a pinned-comment display card that didn't
  exist before.
- Auto-recommend trend cards now show the `benchmark_url` link that manual
  search results already had (parity fix).

Verified with `npx tsc --noEmit` (clean), local dev boot, and a curl smoke
test confirming `/api/analyze-product-screenshot` is registered and
auth-gated (401, not 404/500). **Deployed and confirmed live** same session
(user said "완료 되시면 커밋/푸쉬 하고, 배포 바로 진행해 주세요") — pushed to
GitHub (`604a755..ea0c266`), deployed to Cloud Run revision
`shoppingshots-00010-8vj`, live bundle verified to report v1.0.6.

### 2026-08-0X — v1.0.7: benchmark-video reverse-engineering pipeline

User pushed back hard on the source-clip-download decline (twice more, one
reframing the clips as "판매자가 재사용하라고 올려둔 공식 소스") — held the
position both times (see policy note in [[shoppingshots_rebuild_v1]] memory).
User then proposed a genuinely different, better approach: instead of reusing
any original footage, upload a benchmark short video + a real product photo,
have Gemini reverse-engineer the benchmark's **camera movement / composition
/ cut pacing only** (never its literal frames/branding), and have fal.ai
recreate each cut from scratch with the user's actual product. Assessed this
as legally sound (idea/technique extraction, not expression copying — the
same category as standard competitive creative benchmarking) and designed +
implemented it via Plan Mode (2 rounds — first the strategic assessment, then
a detailed implementation plan the user explicitly requested with 3 required
sections: Gemini guardrail prompt, output JSON schema, file-by-file plan).

**New backend** (`server.ts`):
- `express.json` limit raised 20mb → 150mb (video-as-base64 needs the
  headroom; **Cloud Run's actual request-size ceiling has not been verified
  live yet** — first real large-video upload will be the real test).
- `uploadVideoToGeminiFiles()` — uploads a video Buffer via Gemini's Files
  API (`ai.files.upload({file: new Blob(...)})`, Node 20 global `Blob`, no
  temp file needed) and polls `ai.files.get()` until `state === 'ACTIVE'`
  (same polling shape as `pollFalQueueResult` for fal.ai's queue).
- `POST /api/analyze-benchmark-video` — the guardrail system prompt
  (`BENCHMARK_ANALYSIS_GUARDRAIL`) explicitly forbids extracting brand
  logos/characters/unique visual elements, restricts output to
  camera-movement/composition/pacing technique descriptions, and forbids
  naming the original product/brand. Returns a cut-by-cut array
  (`fal_reference_prompt` = English background/lighting/composition prompt
  with the product deliberately excluded since it's composited separately;
  `fal_video_prompt` = motion prompt following the same
  slowly/gently/naturally-only rules as `/api/generate-ai-video-prompt`).
- `POST /api/generate-benchmark-reference-image` — thin wrapper reusing the
  **existing** `processFalRembg` + `processFalFluxCompositing` helpers
  (originally built for `/api/generate/video`'s I2V pipeline) with the
  per-scene `fal_reference_prompt` instead of the generic studio-lighting
  phrase. Almost no new fal.ai logic — just new orchestration.

**New frontend**: `src/components/BenchmarkVideoAnalyzerView.tsx` (modal) —
video + product-image upload, calls the analyze endpoint, shows an editable
cut-by-cut breakdown, "적용" converts the response directly into `SceneItem[]`
(reusing the existing scene model — no new scene type). Two new optional
`SceneItem` fields added in `types.ts`: `fal_reference_prompt` and
`product_reference_image_url` (the latter wasn't in the original plan text
but turned out necessary — the analyzer's `handleApply` deliberately leaves
`media_url` unset so these scenes get picked up by the existing bulk
generator, which needed *something* to carry the product photo URL through
to the reference-image step). `StoryboardTimelineView.tsx`'s empty-state now
has a second button "🎯 벤치마킹 영상으로 AI 재창조" opening the modal, and its
`handleGenerateAllScenes` (from the v1.0.6 bulk-generation work) now runs the
reference-image compositing step first when a scene has
`fal_reference_prompt` + `product_reference_image_url`, passing the result as
`image_url` into `/api/generate/video`.

Verified with `npx tsc --noEmit` (clean), local dev boot, and curl smoke
tests confirming both new routes are registered and auth-gated (401).
**Real video analysis accuracy, Gemini Files API behavior with a real large
MP4, and Cloud Run's request-size ceiling are all still unverified** — first
real test needed after deploy. **Not deployed yet as of end of this entry**
(user was asked whether to deploy now vs. test locally first; conversation
moved on to the v1.0.8 feature below before they answered — ask again).

### v1.0.8 — YouTube benchmarking discovery panel (search only, no download)

User asked to split the trend page's auto-recommend card into two panels and
add a feature to list/download recent high-view YouTube/TikTok shopping
shorts, explicitly so the downloaded file could feed the new v1.0.7
reverse-engineering pipeline. **Split the ask**: built the discovery/listing
half (legitimate — YouTube Data API v3 explicitly supports search+stats for
this use case), **declined the download half again** — downloading video
files from YouTube/TikTok violates their ToS regardless of what the
downstream use is (this is a different problem from the earlier
copyright-reuse issue, and applies even though the reverse-engineering
pipeline itself is legitimate). Confirmed via `AskUserQuestion` before
building that they wanted the discovery-only version; they did.

- **`server.ts`**: `getUserYoutubeKey()` (BYOK, same pattern as
  `getUserGeminiKey`, header `x-youtube-key` or `YOUTUBE_API_KEY` env
  fallback) + `parseIso8601DurationToSeconds()`. New
  `POST /api/youtube/search-shorts` — `search.list` (order by viewCount,
  `publishedAfter` cutoff) then `videos.list` for real stats/duration,
  filtered to ≤180s and re-sorted by view count. Only returns metadata
  (title/thumbnail/channel/views/link) — **no video bytes ever touch the
  server**. `/api/settings/validate-key` gained a `youtube` provider branch.
- **`SettingsView.tsx`**: 4th key card "YouTube Data API Key", same
  save/validate/clear pattern as the other three.
- **`apiClient.ts`**: `apiFetch` now also attaches `x-youtube-key` from
  localStorage.
- **`TrendBenchmarkingView.tsx`**: the auto-recommend card is now the left
  half of a `grid-cols-1 lg:grid-cols-2` split; right half is the new YouTube
  panel (search box + results list, thumbnail/title/channel/views/days-ago,
  each linking out to the real YouTube watch page — never a local file).
  Explicit on-screen copy tells the user downloading isn't supported and to
  upload their own file to the storyboard step's benchmark analyzer instead.

Verified with `npx tsc --noEmit` (clean), local dev boot, curl smoke test
confirming the new route is registered and auth-gated (401). **Real YouTube
API behavior (quota, actual result quality) unverified** — needs a real
YouTube Data API key from the user to test.

### v1.0.9 — fal.ai BYOK, real ElevenLabs TTS, key-save bug fixes

User reported Gemini/Typecast keys and the admin fal.ai key "keep
disappearing," and asked for fal.ai to become per-user BYOK (like Gemini)
and for a real Typecast/ElevenLabs choice at TTS generation time.
Investigated with an Explore agent before touching code:

- **fal.ai admin key**: confirmed root cause, not a code bug — `serverFalKey`
  (`server.ts`) is a bare in-memory variable with no persistence. This
  service runs `--max-instances=1` with no `--min-instances` (scales to zero
  when idle per `DEPLOY.md`), so every cold start is a fresh process that
  resets to whatever `FAL_KEY` env var was set at the last deploy, silently
  discarding anything saved through the admin UI since. `GET
  /api/admin/fal-key/status` was correctly reporting this each time, not
  lying — the key really was gone.
- **Gemini/Typecast keys**: no code path clears `localStorage` other than
  the explicit "제거" button. Most likely explanation: `handleValidateKey`
  only calls `localStorage.setItem` inside the success branch, and *every*
  `/api/*` route (including `/api/settings/validate-key`) sits behind
  `requireUser` — if the session cookie is missing/expired, the save
  silently never happens, and the generic error message could go unnoticed.
  Confirmed `JWT_SECRET` **is** actually set on the live Cloud Run service
  (checked via `gcloud run services describe`), ruling out the scarier
  "secret regenerates every cold start" theory.

**Fixes**:
- **fal.ai converted to BYOK**: new `getUserFalKey()` (header `x-fal-key`,
  same priority order as Gemini — user key first, then
  env/admin-panel shared key as fallback). New personal "5. fal.ai API Key"
  card in `SettingsView.tsx` (no live validation round-trip — fal.ai has no
  safe read-only endpoint to check against without risking a real paid job,
  so it's a straight length-check + save, like the admin flow already was).
  `apiClient.ts` and `StoryboardTimelineView.tsx`'s fal.ai call sites
  (previously plain `fetch`, now `apiFetch`) attach the header. The admin
  panel still works as a shared fallback, description text updated to be
  honest about the in-memory-only persistence.
- **Real ElevenLabs TTS synthesis**: `synthesizeElevenLabsAudio()` (mirrors
  `synthesizeTypecastAudio`, `eleven_multilingual_v2` model for Korean,
  returns base64 MP3) wired into both `/api/tts/preview` and
  `/api/generate-tts` — previously this branch was a stub that silently fell
  through to Gemini. **Provider choice was already half-built**: the voice
  list UI in `AudioStudioView.tsx` already lets the user click a Typecast or
  ElevenLabs voice, which sets `audioConfig.voice_provider` — the actual bug
  was `handleGenerateAllTts` never sending `elevenlabsKey` in the request
  body (only `typecastKey`), so selecting an ElevenLabs voice would fail
  even with a valid key registered. Fixed, plus added a status line showing
  which voice/provider is currently selected before the generate button.
- **Render pipeline mp3 support**: the narration-format branch in
  `/api/render-video` used to treat anything that wasn't `'wav'` as raw PCM
  needing `-f s16le` — would have corrupted ElevenLabs' real MP3 output.
  Now explicitly checks `format === 'gemini_pcm'` for the raw-PCM path;
  `'wav'`/`'mp3'` are both self-describing containers ffmpeg reads directly.
  `AudioConfig.narrationAudioFormat` type extended to include `'mp3'`.
- **Session-expiry UX**: `SettingsView.handleValidateKey` now special-cases
  HTTP 401 with an explicit "다시 로그인해 주세요" message instead of a generic
  error, so a silently-failed save (session expired) doesn't look identical
  to "the key just vanished."

Verified with `npx tsc --noEmit` (clean), local dev boot, and curl smoke
tests confirming `/api/settings/validate-key` and `/api/generate-tts` both
still correctly 401 without auth. **Deployed same session** (user said
"지금 배포해주세요, 테스트 해보겠습니다") — revision `shoppingshots-00011-f75`,
live bundle verified to report v1.0.9. This deploy carries v1.0.7
(benchmark-video reverse-engineering) and v1.0.8 (YouTube discovery panel)
live for the first time too, along with v1.0.9's fixes.

## Next session — pick up here

1. **User is about to test v1.0.9 live** — the fal.ai BYOK conversion, real
   ElevenLabs TTS, and the key-save session-expiry fix have never been
   exercised against real APIs/real user sessions. Their test results are
   the next input — don't assume anything worked until they report back.
2. **v1.0.7's benchmark-video pipeline is entirely untested with real data**
   — this is the most complex thing built so far (Gemini Files API + video
   understanding + a 2-stage fal.ai composite). Test with a real short MP4 +
   real product photo before trusting it.
3. **Cloud Run request-size limit is unverified** — if a real benchmark video
   upload fails with a size/timeout error, the fix is likely either lowering
   client-side expectations (ask user to trim/compress first) or moving to a
   direct-to-Cloud-Storage upload flow instead of base64-through-Express.
4. **v1.0.8 needs a real YouTube Data API key to test** — user doesn't have
   one registered yet as of this entry.
5. fal.ai queue-polling fix (from an earlier session) still hasn't been
   exercised against the real API with a user-provided key — first real
   test should happen via the bulk-generation button now that fal.ai is BYOK.
6. If a video-*download* request comes up again (from any platform), don't
   relitigate it from scratch — see the v1.0.6/v1.0.7/v1.0.8 session log
   entries above and the policy note in the `shoppingshots-rebuild-v1` memory
   file. This has now been declined three separate times across two
   different framings (direct reuse, and "just for reverse-engineering
   input") — the ToS reasoning is independent of downstream use.
7. Still no real end-to-end walkthrough of the deployed site as an actual
   user (sign up → product → script → storyboard → audio → render → real
   playable MP4) has been done end-to-end in one sitting.

Lower-priority, not blocking:
- Local `npm run dev` still can't render (no ffmpeg on this dev machine) —
  fine since the deployed site works, but worth fixing locally too if the
  user wants to iterate on the render pipeline without redeploying every time.
- `DEPLOY.md`'s "Cloud Run" section mentions Application Default Credentials
  as the more production-correct alternative to mounting `service-account.json`
  via Secret Manager — not implemented, deferred as noted in that file.
- No email verification / password reset on the Google Sign-In flow — fine
  for invite-only friends-and-family use, revisit before wider launch.
- fal.ai admin-panel "저장" button only persists the key in server memory,
  not durably — mitigated by passing `FAL_KEY` directly at deploy time instead.
- Actual Coupang Partners link generation (via their real API) and platform
  auto-upload are both explicitly deferred by the user until the core
  pipeline is fully working end-to-end.
