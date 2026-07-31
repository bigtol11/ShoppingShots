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

## 3. ⚠️ 반드시 알아야 할 제약: 로컬 디스크 기반 저장소

현재 계정/로그인 정보, 완성된 프로젝트 목록, 업로드한 이미지/음성 파일은 **컨테이너 내부 로컬 디스크**(`server_data/`, `public/uploads/`, `public/exports/`)에 저장됩니다. Cloud Run은 기본적으로 컨테이너가 재시작/재배포될 때마다 로컬 디스크를 초기화합니다.

- `--min-instances=1 --max-instances=1`로 배포하면 **평소에는** 인스턴스가 하나만 유지되어 문제없이 동작하지만, **재배포하거나 Cloud Run이 인스턴스를 교체하면** 가입한 계정/저장된 프로젝트/업로드 파일이 전부 사라집니다. 지금처럼 "나 + 지인 몇 명" 규모에서 임시로 쓰기엔 괜찮지만, **진짜 서비스로 열 때는 반드시 아래로 바꿔야 합니다.**
- 정식 전환 시 필요한 것: 계정/프로젝트 데이터 → Firestore나 Cloud SQL, 업로드/렌더 결과물 → Cloud Storage 버킷. (참고: 이미 사용 중이신 ShortDramaProject/Shorts Engine이 Firestore+Firebase Auth를 쓰고 있으니, 그때 가면 같은 패턴을 재사용하시면 됩니다. **단, 이건 별개 프로젝트이니 지금 당장 손댈 필요는 없습니다.**)

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
