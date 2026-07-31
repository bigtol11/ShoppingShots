# CLAUDE.md — ShoppingShots (쇼핑쇼츠 자동화)

This file exists so that any Claude Code session — on any PC — can pick up this
project with full context even if the chat history itself doesn't carry over.
Read this first before making changes.

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

## Live deployment

**https://shoppingshots-823154324409.us-west1.run.app**

- GCP project: `shoppingshots-prod`, region `us-west1`.
- Cloud Run service name: `shoppingshots`.
- Deploy with: `gcloud run deploy shoppingshots --source . --region us-west1 --configuration=shoppingshots ...` — see `DEPLOY.md` for the full command and required env vars/secrets.
- **gcloud configuration**: this machine has a `shoppingshots` gcloud configuration (account `bigtol11@gmail.com`, project `shoppingshots-prod`) kept deliberately separate from the `default` configuration (which points at ShortDramaProject's `gen-lang-client-0622256162`). **Always pass `--configuration=shoppingshots` on every gcloud command for this project.** gcloud's binary may not be on PATH for already-open shells after install — invoke via `C:\Users\ADMIN\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd` or prepend it to `$env:Path` per session.
- Invite code for signup on the live site: `shopping2026`.
- Firebase project `shoppingshots-prod`: Firestore + Cloud Storage enabled, service account key at `E:\ShoppingShots\service-account.json` (gitignored, never committed, never baked into the Docker image — see DEPLOY.md for why and how it's mounted via Secret Manager instead).

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
Invite-only accounts (bcrypt password hash + JWT session cookie, `LoginView.tsx`
gates the whole app). No public signup without `SIGNUP_INVITE_CODE` matching.
Every `/api/*` route except `/api/auth/*` requires a valid session
(`requireUser` middleware, global `app.use('/api', ...)` gate in `server.ts`).

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

User ended the session here ("지금은 여기까지 하겠습니다").

## Next session — pick up here

**Not yet done: a real end-to-end walkthrough of the deployed site as an
actual user.** Everything has been verified piece-by-piece via curl (auth,
storage, individual endpoints), but nobody has gone through the full product
UI flow start to finish: sign up on https://shoppingshots-823154324409.us-west1.run.app
with invite code `shopping2026` → import a real Coupang product → generate a
script → generate a storyboard → generate TTS narration → render → confirm a
real playable MP4 comes out the other end. **This is the first thing to do
next session** (or to prompt the user to do, if this session resumes with the
user rather than picking up autonomous work) — it's the one part of the
rebuild that hasn't been exercised as a real user would.

Secondary/lower-priority follow-ups, not blocking:
- Local `npm run dev` still can't render (no ffmpeg on this dev machine) —
  fine since the deployed site works, but worth fixing locally too if the
  user wants to iterate on the render pipeline without redeploying every time.
- `DEPLOY.md`'s "Cloud Run" section mentions Application Default Credentials
  as the more production-correct alternative to mounting `service-account.json`
  via Secret Manager — not implemented, deferred as noted in that file.
- No email verification / password reset / OAuth on the auth system —
  explicitly fine for now per the user ("나중에 상용화 시 다시 해도 되지 않나요?"),
  revisit before opening this up beyond invite-only friends-and-family use.
