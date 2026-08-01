# Cloud Run 배포 가이드

이미 한 번 실제로 배포해서 검증된 절차입니다: **https://shoppingshots-823154324409.us-west1.run.app**

## 0. gcloud 설정 — ShortDramaProject와 절대 섞이지 않도록

이 PC의 gcloud에는 `shoppingshots`라는 별도 설정(configuration)이 있습니다
(계정 `bigtol11@gmail.com`, 프로젝트 `shoppingshots-prod`). `default` 설정은
ShortDramaProject의 GCP 프로젝트를 가리키고 있으니 **절대 건드리지 마세요.**

모든 gcloud 명령에 반드시 `--configuration=shoppingshots`를 붙이세요:

```bash
gcloud config configurations list   # shoppingshots가 있는지, default와 분리되어 있는지 확인
```

gcloud 바이너리가 새로 연 셸의 PATH에 없을 수 있습니다 — 그럴 땐:
```powershell
$env:Path += ";C:\Users\ADMIN\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
```

## 1. 필요한 값들

| 값 | 어디서 |
|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `JWT_SECRET` | 아무 랜덤 문자열 32자 이상 (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `ALLOWED_EMAILS` | 로그인 허용할 구글 계정 이메일, 쉼표로 구분 |
| `FAL_KEY` / `ADMIN_SECRET` | 선택사항, 안 쓰면 비워둠 |
| `service-account.json` | Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 |

## 2. 서비스 계정 키를 Secret Manager에 등록 (최초 1회만)

```bash
gcloud secrets create shoppingshots-service-account --data-file="service-account.json" --configuration=shoppingshots

# Cloud Run이 이 비밀을 읽을 수 있도록 권한 부여 (PROJECT_NUMBER는 아래 명령으로 확인)
gcloud projects describe shoppingshots-prod --format="value(projectNumber)" --configuration=shoppingshots
gcloud secrets add-iam-policy-binding shoppingshots-service-account \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --configuration=shoppingshots
```

이미 등록되어 있다면 (재배포 시) 이 단계는 건너뛰어도 됩니다. 키가 바뀌었다면
`gcloud secrets versions add shoppingshots-service-account --data-file="service-account.json"`
로 새 버전만 추가하세요.

⚠️ **`/app/service-account.json`처럼 앱 디렉터리 안쪽 경로에 마운트하지 마세요.**
Cloud Run의 시크릿 파일 마운트는 그 파일이 위치할 디렉터리 전체를 새 볼륨으로
덮어씁니다 — `/app`에 마운트하면 `dist/`, `node_modules/` 등 이미지 안의 다른
파일이 전부 보이지 않게 되어 컨테이너가 시작 실패합니다 (`Cannot find module
'/app/dist/server.cjs'`). 반드시 `/secrets/...`처럼 앱과 무관한 경로에 마운트하고,
`FIREBASE_SERVICE_ACCOUNT_PATH` 환경변수로 그 경로를 알려줘야 합니다.

## 3. 배포 명령

```bash
gcloud run deploy shoppingshots \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --max-instances=1 \
  --set-env-vars "GEMINI_API_KEY=<값>,JWT_SECRET=<값>,ALLOWED_EMAILS=<이메일1,이메일2>,FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/service-account.json" \
  --set-secrets="/secrets/service-account.json=shoppingshots-service-account:latest" \
  --configuration=shoppingshots
```

`--source .`를 쓰면 gcloud가 Cloud Build로 `Dockerfile`을 자동으로 빌드해서
올려줍니다. `--max-instances=1`은 필수입니다 — 렌더링 작업 상태(`renderJobs`)가
인스턴스 메모리에만 있어서, 인스턴스가 2개 이상 뜨면 상태 조회 요청이 다른
인스턴스로 가서 404가 날 수 있습니다. `--min-instances`는 굳이 안 정해도
됩니다 (기본 0 — 트래픽 없을 때 비용 절감, 첫 요청만 콜드스타트로 조금 느림).

## 4. Google 로그인 설정 (API로는 불가능한 유일한 수동 단계)

Firebase 콘솔 → 해당 프로젝트 → **Authentication → Sign-in method → Google →
사용 설정(Enable)**. 이 토글 하나만 콘솔에서 직접 켜야 합니다. 웹앱 등록/설정값은
Firebase Management API로 자동 처리했고 (`src/firebaseConfig.ts`에 이미 반영,
민감정보 아니라 커밋해도 안전), 로그인 자체는 `ALLOWED_EMAILS`에 등록된 이메일만
허용됩니다 (Google 계정만 있으면 아무나 되는 게 아닙니다).

## 5. 배포 후 확인

```bash
gcloud run services describe shoppingshots --region us-west1 --format='value(status.url)' --configuration=shoppingshots
```

나온 URL로 접속해서 우측 상단 "Google로 로그인" → `ALLOWED_EMAILS`에 등록된
계정으로 로그인 → 파이프라인 진행이 되는지 확인하세요.
