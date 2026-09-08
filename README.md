# KIPI 브랜드 컴플라이언스 시스템

KIPRIS(특허청 특허정보검색서비스)에 등록된 특허·실용신안·상표 정보를 검색하고, 해당 지식재산권에 대해
컴플라이언스팀에 문의/답변을 주고받을 수 있는 사내 웹 시스템입니다.

## 주요 기능

### 1. KIPRIS 특허·상표·실용신안 검색 (QA 담당자용)
- 출원번호/등록번호/공개(공고)번호로 특허·실용신안·상표를 검색 (KIPRIS Plus OpenAPI 연동)
- 특허/실용신안: 번호(명칭)를 클릭하면 서지상세정보 조회 결과로 요약(초록), 대표 청구항, IPC 분류,
  출원인/발명자 등 전반적인 내용을 확인하고, KIPRIS 원문(전문) 링크로 이동 가능
- 상표: 상표 명칭을 클릭하면 상표 이미지와 지정상품 분류(류 구분/지정상품 목록)를 확인 가능

### 2. 컴플라이언스 문의 (누구나 이용 가능)
- 특허/실용신안/상표 번호를 연결하여(KIPRIS 조회 스냅샷 저장) 문의 등록, 파일 첨부, 코멘트 작성 지원
- 문의자는 개인 이메일 주소를 필수로 입력
- 등록된 모든 문의 내역은 별도 목록 화면에서 누구나 열람 가능
- 컴플라이언스 담당자 전용 화면(`/compliance`, 공유 비밀번호로 접근 제한)에서 문의를 확인하고,
  답변 코멘트 + 문의자 이메일을 입력 후 저장하면
  - 답변 내용이 저장되고
  - 문의자 이메일로 답변 등록 안내 메일이 자동 발송됩니다.

### 컴플라이언스 담당자는 어떻게 접속하나요?

배포된 주소 뒤에 `/compliance`를 붙여서 접속하면 됩니다 (예: `https://<도메인>/compliance`).
접속 시 브라우저가 아이디/비밀번호를 물어보는데, `server/.env`(또는 배포 환경변수)의
`COMPLIANCE_USERNAME` / `COMPLIANCE_PASSWORD` 값을 입력하면 됩니다. 담당자들에게는 이 URL과
비밀번호만 공유하면 되고, 별도 회원가입/개인 계정 발급 절차는 없습니다.

## 기술 스택

- **서버**: Node.js(Express), `node:sqlite`(내장 SQLite, 별도 DB 설치 불필요), Multer(파일 업로드),
  Nodemailer(메일 발송), fast-xml-parser(KIPRIS XML 응답 파싱)
- **클라이언트**: React + Vite, React Router

## 폴더 구조

```
server/            Express API 서버
  src/
    kipris/        KIPRIS Plus OpenAPI 연동 모듈 (특허·실용신안 / 상표)
    routes/        REST API 라우트
    db.js          SQLite 스키마/연결
    mailer.js       답변 등록 안내 메일 발송
    upload.js       첨부파일 업로드 설정
  data/            SQLite DB 파일 저장 위치 (git 미포함)
  uploads/         첨부파일 저장 위치 (git 미포함)
client/            React(Vite) 프론트엔드
```

## 로컬 실행 방법

### 1) 서버 설정

```bash
cd server
cp .env.example .env
# .env 파일을 열어 아래 값을 채워주세요.
#  - KIPRIS_API_KEY : KIPRIS Plus에서 발급받은 인증키
#  - SMTP_*         : 답변 등록 메일 발송용 SMTP 계정 정보 (미설정 시 메일 발송은 건너뛰고 로그만 남김)
npm install
npm run dev   # http://localhost:4000
```

### 2) 클라이언트 실행 (개발 모드)

```bash
cd client
npm install
npm run dev   # http://localhost:5173  (자동으로 /api 요청을 4000 포트로 프록시)
```

### 3) 운영(단일 서버) 배포

클라이언트를 빌드하면 서버가 빌드 결과물을 함께 서빙합니다 (별도 프론트 호스팅/리버스 프록시 불필요).

```bash
cd client && npm run build
cd ../server && npm start   # http://localhost:4000 하나로 API + 화면 모두 제공
```

## Railway 배포 방법

저장소 루트에 Railway(Nixpacks)가 자동으로 인식하는 `package.json`(build/start 스크립트)과
`railway.json`(헬스체크 등 배포 설정)을 포함해 두었습니다. 아래 순서대로 진행하면 됩니다.

1. **GitHub 저장소 준비**: 이 저장소를 Railway 계정과 연결할 GitHub 계정에 push해 둡니다(이미 이
   저장소를 사용 중이라면 그대로 사용하면 됩니다).
2. **Railway 프로젝트 생성**: https://railway.app 로그인 → `New Project` → `Deploy from GitHub repo`
   → 이 저장소 선택 → 배포할 브랜치 선택.
3. **빌드/실행 확인**: Root Directory는 비워두고(저장소 루트 그대로) 사용하면 됩니다. Railway가
   루트의 `package.json`을 감지해 자동으로
   - Build: `npm install --prefix server && npm install --prefix client && npm run build --prefix client`
   - Start: `npm start` (→ `server`의 Express 앱이 빌드된 클라이언트까지 함께 서빙)
   를 실행합니다. 별도 설정 없이 배포가 가능하지만, 화면에 표시된 값과 실제 Settings 값이 다르면
   `railway.json`의 내용을 그대로 Settings의 Build/Start Command에 붙여넣어 주세요.
4. **환경변수 설정** (Project → Service → Variables):
   | 변수명 | 설명 |
   |---|---|
   | `KIPRIS_API_KEY` | KIPRIS Plus에서 발급받은 인증키 (필수) |
   | `RESEND_API_KEY` | (권장) [Resend](https://resend.com) API 키. 있으면 SMTP 대신 이걸로 메일 발송 — Railway 등에서 SMTP 포트가 막히는 문제를 피할 수 있음. 아래 "메일 발송 설정" 참고 |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | `RESEND_API_KEY`가 없을 때 사용되는 SMTP 계정 |
   | `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` | 발신자 표시 이름/주소 (Resend 사용 시에도 발신자 이름에 재사용됨) |
   | `PUBLIC_WEB_URL` | 5단계에서 발급받는 Railway 공개 도메인(예: `https://xxxx.up.railway.app`). 메일 본문 링크에 사용되므로 도메인 확정 후 채워주세요 |
   | `DATA_DIR` | SQLite DB 저장 경로. 6단계에서 만들 Volume의 마운트 경로로 지정 (예: `/data`) |
   | `UPLOAD_DIR` | 첨부파일 저장 경로. 위와 동일한 Volume 하위 경로로 지정 (예: `/data/uploads`) |
   | `COMPLIANCE_USERNAME`, `COMPLIANCE_PASSWORD` | 컴플라이언스 담당자 화면(`/compliance`) 접근용 공유 계정. **반드시 설정하세요** — 비워두면 누구나 답변 등록 화면에 접근할 수 있습니다 |

   `PORT`, `CORS_ORIGIN`은 설정하지 않아도 됩니다 — Railway가 `PORT`를 자동 주입하고, 프론트엔드를
   서버가 같은 오리진으로 서빙하므로 CORS 설정이 별도로 필요 없습니다.
5. **퍼블릭 도메인 발급**: 배포 완료 후 Service → Settings → Networking → `Generate Domain` 클릭.
   발급된 주소를 위 `PUBLIC_WEB_URL`에 입력하고 저장하면 자동으로 재배포됩니다.
6. **데이터 영속성을 위한 Volume 추가** (권장): Railway는 기본적으로 재배포 시 파일시스템이
   초기화되어 SQLite DB와 첨부파일이 사라집니다. Service → Settings → Volumes → `New Volume`으로
   볼륨을 추가하고 Mount Path를 `/data`로 지정한 뒤, 위 4단계의 `DATA_DIR=/data`,
   `UPLOAD_DIR=/data/uploads`를 설정해 주세요.
7. **동작 확인**: `https://<발급받은 도메인>/api/health` 접속 시 `{"ok":true,"hasKiprisKey":true}`가
   보이면 정상입니다. 이후 도메인 루트로 접속해 검색/문의 화면이 뜨는지 확인합니다.

이후 GitHub 저장소의 해당 브랜치에 push할 때마다 Railway가 자동으로 재빌드/재배포합니다.

### 메일 발송 설정 (SMTP 대신 Resend 권장)

Railway 같은 클라우드 호스팅에서는 Gmail 등 SMTP 서버로 나가는 587/465 포트가 막히거나
연결이 타임아웃되는 경우가 흔합니다(실제로 이 프로젝트 배포 중 확인됨). HTTPS(443)로만 통신하는
[Resend](https://resend.com)를 쓰면 이 문제를 피할 수 있어 권장합니다.

1. https://resend.com 에서 무료 가입 (카드 불필요, 월 3,000통/일 100통 무료).
2. 대시보드 → API Keys → 새 키 발급.
3. Railway Variables에 `RESEND_API_KEY`로 등록 — 이것만 설정하면 SMTP 관련 변수는 없어도 됩니다.
4. 발신 주소:
   - 별도 도메인 인증 없이 바로 쓰려면 `RESEND_FROM_EMAIL`을 비워두세요 → 자동으로
     `onboarding@resend.dev` 발신 주소를 사용합니다 (즉시 사용 가능, 발신자 표시가 일반적).
   - 회사가 소유한 도메인이 있다면 Resend 대시보드에서 그 도메인을 인증(DNS 레코드 추가)한 뒤
     `RESEND_FROM_EMAIL=noreply@yourcompany.com`처럼 지정하면 해당 주소로 발송됩니다.
   - **Gmail(`@gmail.com`) 등 본인이 도메인을 소유하지 않은 주소는 어떤 메일 발송 서비스를 써도
     발신 주소로 쓸 수 없습니다** (도메인 소유권 인증이 불가능하기 때문 — Resend만의 제약이
     아니라 이메일 인증 구조 자체의 제약입니다). 받는 사람 메일함은 Gmail/회사메일 무엇이든 상관없습니다.
5. `RESEND_API_KEY`가 설정되어 있으면 자동으로 SMTP보다 우선 사용됩니다(`server/src/mailer.js`).
   `https://<도메인>/api/health`의 `mailProvider` 값으로 현재 어떤 방식이 활성화되어 있는지
   확인할 수 있습니다.

SMTP를 계속 쓰고 싶다면 `RESEND_API_KEY`를 비워두고 기존 `SMTP_*` 변수만 설정하면 됩니다.

## KIPRIS API 연동 관련 참고사항

KIPRIS Plus는 서비스(오퍼레이션)마다 게이트웨이 경로와 필수 파라미터가 다르고, 심지어 인증키
파라미터명(`accessKey` vs `ServiceKey`)도 오퍼레이션마다 다릅니다. 실제 동작이 확인된 공개 구현체
(KIPRIS Plus용 오픈소스 클라이언트/MCP 서버)를 참고해 아래와 같이 맞춰 구현했습니다.

| 오퍼레이션 | 게이트웨이 | 인증키 | 비고 |
|---|---|---|---|
| 특허·실용신안 항목별검색 (`applicationNumberSearchInfo`/`registrationNumberSearchInfo`/`openNumberSearchInfo`/`publicationNumberSearchInfo`) | `/openapi/rest/` | `accessKey` | `patent`/`utility`/`docsStart`/`docsCount` 등 필수 |
| 특허·실용신안 서지상세 (`getBibliographyDetailInfoSearch`) | `/kipo-api/kipi/` | `ServiceKey` | `applicationNumber`만 필요 |
| 상표 항목별검색 (`applicationNumberSearchInfo`/`registerNumberSearchInfo`/`publicationNumberSearchInfo`) | `/kipo-api/kipi/` | `ServiceKey` | 상태(출원/등록/거절 등)·유형(문자상표/도형상표 등) 플래그 약 30개가 전부 필수값 — 코드에서 전체 포함(`true`)으로 채워서 호출 |
| 상표 서지상세 (`getBibliographyDetailInfoSearch`) | `/kipo-api/kipi/` | `ServiceKey` | `applicationNumber`만 필요 |

화면의 "번호" 입력칸 하나에는 출원번호·등록번호·공개번호·공고번호 중 아무거나 입력할 수 있는데,
KIPRIS는 이 4가지(상표는 3가지)를 서로 다른 오퍼레이션으로 나눠 제공합니다. 그래서
`patentService.searchByNumber()` / `trademarkService.searchByNumber()`는 입력된 번호를 위 오퍼레이션
전체에 병렬로 조회한 뒤 결과를 합쳐서 반환합니다 — 사용자가 어떤 번호를 넣었는지 미리 판별할 필요가
없습니다. 응답의 `resultCode`가 `20`(결과없음)인 항목은 오류가 아니라 정상적인 "매칭 없음"으로 처리하고,
4(3)개 오퍼레이션이 전부 진짜 오류일 때만 화면에 오류로 표시합니다.

- 이 개발 환경은 보안 정책상 `plus.kipris.or.kr`로의 외부 네트워크 호출이 차단되어 있어, 위 매핑은
  KIPRIS Plus 공식 명세 및 실제 동작이 검증된 공개 구현체를 기준으로 구현하고 모의(mock) 응답으로
  로직만 검증했습니다. 실제 배포 환경에서 여전히 필드가 비어 보이거나 오류가 난다면, 상세 조회 화면
  하단의 "원본 응답 데이터" 접이식 패널에서 KIPRIS가 실제로 내려준 전체 필드를 확인하고,
  `server/src/kipris/patentService.js` / `trademarkService.js`의 `normalize*Item()` 함수에서
  필드명만 조정하면 됩니다.
- 오류 메시지에는 KIPRIS가 내려준 `resultCode`가 `[코드] 메시지` 형태로 함께 표시됩니다
  (`10`=파라미터 오류, `20`=결과없음(정상 처리), `30`=키 미등록, `31`=서비스 이용기간 만료 등). 서버
  로그(Railway → Deployments → Logs)에는 `[kipris] API 오류 응답` 라인에 원본 응답과 요청 URL(키
  마스킹)이 함께 남습니다.
- **(실사용으로 확인된 진짜 원인) 상표 검색이 `[10] INVALID_REQUEST_PARAMETER_ERROR`로 실패하는
  것은 대부분 "상품 미구매"가 아니라 해당 상표가 아직 "출원"(출원공고 전) 상태이기 때문입니다.**
  인접한 두 출원번호(같은 출원인, 하루 차이)로 직접 확인한 결과, "공고" 상태인 번호는 상표명·
  이미지·지정상품 분류까지 정상 조회됐고, "출원" 상태인 번호만 이 오류가 났습니다. 즉 API/구매
  상품 자체는 정상 작동 중이며, KIPRIS가 출원공고 전 상표의 상세 서지정보를 아직 공개하지 않는
  것으로 보입니다(특허의 출원공개 전 비공개와 유사한 정책으로 추정). 이 경우 출원공고 또는 등록
  이후 다시 조회하면 정상적으로 나옵니다 — 기다리는 것 외에 조치할 방법은 없습니다.
  (다만 계정에 따라 정말 상품 미구매가 원인인 경우도 있을 수 있으니, 공고/등록된 번호로도 계속
  실패한다면 그때는 KIPRIS Plus 마이페이지에서 "상표 정보검색서비스" 구매 여부를 확인해 주세요.)
- **임시 대체 수단**: 위 사유로 상세정보를 못 가져올 때, "법적 상태 이력" 상품
  (`legStatusInfoSearchService`)이 구매되어 있다면 `server/src/kipris/legalStatusService.js`를
  통해 대체 정보원으로 사용합니다. 상표 검색/서지상세가 실패하면 자동으로 이 서비스로 재조회해
  출원번호와 법적 상태 이력(출원/공고/등록/거절 등)만이라도 보여줍니다. 상표명·이미지·지정상품
  분류는 이 서비스에 아예 없는 필드라 여전히 표시되지 않으며, 화면에 사유에 맞는 안내 문구가 함께
  뜹니다.

## 보안/운영 참고사항

- `server/.env` 파일에는 KIPRIS API 키, SMTP 계정 정보 등 민감정보가 포함되므로 절대 git에 커밋하지
  마세요 (`.gitignore`에 등록되어 있습니다).
- 문의 내역 목록/상세 조회(`/inquiries`)는 요건에 따라 별도 로그인 없이 누구나 접근 가능합니다.
- 컴플라이언스 답변 등록 화면(`/compliance`)과 답변 저장 API는 `COMPLIANCE_USERNAME`/
  `COMPLIANCE_PASSWORD` 공유 계정(HTTP Basic Auth)으로 보호됩니다. 더 강한 보안이 필요하다면
  담당자별 개별 로그인/사내 SSO 연동으로 교체하는 것을 권장합니다.
  - ⚠️ **`server/.env` 파일은 배포 시 함께 올라가지 않습니다.** Railway 등에 배포한다면 반드시
    해당 서비스의 Variables(환경변수) 화면에 `COMPLIANCE_USERNAME`/`COMPLIANCE_PASSWORD`를 직접
    등록해야 합니다. `/compliance` 접속 시 로그인 팝업이 뜨지 않는다면 이 값이 비어있다는 뜻입니다.
  - `https://<도메인>/api/health` 응답의 `hasCompliancePassword`, `hasSmtpConfig` 값으로 배포
    환경에 필요한 환경변수가 실제로 설정되었는지 바로 확인할 수 있습니다.
