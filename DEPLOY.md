# Cloud Run 배포 가이드

`Dockerfile`에 ffmpeg가 이미 포함되어 있고, `npm run build`를 로컬에서 실제로 실행해 정상 빌드되는 것까지 확인했습니다. gcloud CLI로 소스에서 바로 빌드/배포할 수 있습니다.

## 1. 사전 준비

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) 설치 및 `gcloud auth login`
- 배포할 GCP 프로젝트 선택: `gcloud config set project <PROJECT_ID>`

## 2. 배포 명령

```bash
gcloud run deploy shoppingshots \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=1 \
  --set-env-vars GEMINI_API_KEY=<값>,JWT_SECRET=<임의의_긴_랜덤_문자열>,SIGNUP_INVITE_CODE=<지인들에게_알려줄_초대코드>,FAL_KEY=<선택사항>,ADMIN_SECRET=<선택사항>
```

`--source .`를 쓰면 gcloud가 Cloud Build로 `Dockerfile`을 자동으로 빌드해서 올려줍니다. `Dockerfile`을 직접 만들 필요가 없습니다.

## 3. 저장소: Firestore + Cloud Storage (권장) vs 로컬 디스크

서버 코드는 `service-account.json`이 프로젝트 루트에 있으면 **자동으로** 계정/프로젝트 데이터는 Firestore에, 업로드/렌더 결과물은 Cloud Storage에 저장합니다. 파일이 없으면 컨테이너 로컬 디스크(`server_data/`, `public/uploads/`, `public/exports/`)로 자동 전환됩니다.

- **Firestore/Cloud Storage 없이 배포하면** (`service-account.json` 미포함) — 로컬 디스크에 저장되므로 Cloud Run이 인스턴스를 재시작/교체할 때마다 가입 계정/프로젝트/업로드 파일이 전부 사라집니다. `--min-instances=1 --max-instances=1`로 임시 방편은 가능하지만 재배포 시엔 여전히 날아갑니다.
- **Firestore/Cloud Storage를 붙이면** — 이 제약이 사라집니다. 별도의 새 Firebase 프로젝트(예: `shoppingshots-prod`, **ShortDramaProject의 Firebase 프로젝트와는 완전히 별개**)에서 Firestore + Storage를 활성화하고 서비스 계정 키를 발급받아야 합니다.

### 로컬 개발 시 연결하기
1. Firebase 콘솔 → 새 프로젝트 생성 → Firestore Database 활성화 → Storage 활성화
2. 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" → JSON 다운로드
3. 다운로드한 파일을 `E:\ShoppingShots\service-account.json`으로 저장 (`.gitignore`/`.dockerignore`에 이미 등록되어 있어 커밋되지 않습니다)
4. `npm run dev` 실행 시 로그에 `[Firebase Admin] Initialized — Firestore + Cloud Storage ENABLED` 가 뜨면 연결 성공

### Cloud Run 배포 시 연결하기
컨테이너 이미지에는 `service-account.json`을 절대 포함시키지 않습니다 (이미 `.dockerignore`에서 제외됨). 대신 Cloud Run의 서비스 계정 자체에 Firestore/Storage 권한을 부여하고, 별도 인증 파일 없이 [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)로 인증하는 방식을 권장합니다 — 이 부분은 실제 배포 시점에 같이 봐드리겠습니다.

## 4. JWT_SECRET / SIGNUP_INVITE_CODE / ADMIN_SECRET 값 정하기

- `JWT_SECRET`: 아무 랜덤 문자열이나 32자 이상으로. 예: `openssl rand -hex 32` (또는 아무 비밀번호 생성기)
- `SIGNUP_INVITE_CODE`: 지인들에게 공유할 가입 코드. 비워두면 가입 자체가 막힙니다(기존 계정 로그인은 가능).
- `ADMIN_SECRET`: fal.ai 키 관리 등 관리자 전용 기능을 쓸 계획이 없다면 비워둬도 됩니다(그 기능들은 자동으로 비활성화됨).

민감한 값들은 나중에 `--set-env-vars` 대신 [Secret Manager](https://cloud.google.com/run/docs/configuring/secrets)로 옮기는 걸 권장합니다 (지금 단계에선 필수는 아닙니다).

## 5. 배포 후 확인

```bash
gcloud run services describe shoppingshots --region us-west1 --format='value(status.url)'
```

나온 URL로 접속해서 초대코드로 가입 → 로그인 → 파이프라인 진행이 되는지 확인하세요.
