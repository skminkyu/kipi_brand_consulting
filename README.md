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
- 특허/실용신안/상표 번호를 하나 이상 연결하여(번호별 KIPRIS 조회 스냅샷 저장) 문의 등록, 파일
  첨부, 코멘트 작성 지원 (형제 출원처럼 관련 번호가 여러 건이면 "번호 추가"로 계속 늘릴 수 있음)
- 문의자는 개인 이메일 주소를 필수로 입력
- 등록된 모든 문의 내역은 별도 목록 화면에서 누구나 열람 가능
- 컴플라이언스 담당자 전용 화면(`/compliance`, 공유 비밀번호로 접근 제한)에서 문의를 확인하고,
  답변 코멘트 + 문의자 이메일을 입력 후 저장하면
  - 답변 내용이 저장되고
  - 문의자 이메일로 답변 등록 안내 메일이 자동 발송되고
  - 문의자가 브라우저 알림을 허용해두었다면, 그 브라우저로도 알림이 함께 발송됩니다(이메일이 회사
    보안정책 등으로 도달하지 않는 경우를 대비한 무료 보조 채널 — 아래 "브라우저 알림" 참고).

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

### 브라우저 알림 (Web Push) — 완전 무료 보조 알림 채널

회사 메일 보안 정책(DMARC 등)으로 이메일 알림이 도달하지 않는 경우를 대비해, 브라우저 자체 푸시
알림(Web Push) 기능을 추가로 제공합니다. Gmail/페이스북 등이 브라우저를 꺼둬도 알림을 띄우는 것과
같은 표준 웹 기술이라 **제3자 유료 서비스 없이 완전히 무료**입니다.

**동작 방식**: 문의자가 문의 상세 페이지(`/inquiries/:id`)에서 "브라우저 알림 받기" 버튼을 눌러
알림을 허용하면, 그 브라우저의 구독 정보가 해당 문의에 연결되어 저장됩니다. 담당자가 답변을
등록하면 이메일 발송과 별개로 그 브라우저에도 알림이 전송됩니다.

**설정 방법** (한 번만):
```bash
cd server
node -e "console.log(require('web-push').generateVAPIDKeys())"
```
출력된 `publicKey`/`privateKey`를 각각 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`로 Railway
Variables(또는 `.env`)에 등록하세요. `VAPID_SUBJECT`는 `mailto:아무@주소.com` 형식이면 됩니다
(실제 도달 가능한 주소가 아니어도 무방). 이 두 키가 모두 설정되어야 기능이 켜지며,
`https://<도메인>/api/health`의 `hasWebPushConfig`로 확인할 수 있습니다.

**한계**: 문의자가 알림을 허용한 그 브라우저/기기를 계속 사용해야 알림이 도달합니다 (브라우저
데이터를 지우거나 다른 기기로 바꾸면 재구독 필요). iOS Safari는 지원 시작이 늦어(16.4+, PWA
설치 필요) PC/안드로이드보다 제약이 있습니다. 그래서 이메일 발송을 대체하는 게 아니라, 이메일과
함께 추가로 발송되는 보조 채널로 구현했습니다.
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
| 상표 키워드검색 (`trademarkNameSearchInfo`/`applicantNamesearchInfo`/`regPrivilegeNamesearchInfo`) | `/kipo-api/kipi/` | `ServiceKey` | 상표명(국문/영문)·출원인명·등록권자(상표권자)명 중 아무거나 입력해도 찾을 수 있도록 3개 오퍼레이션을 병렬 호출 후 병합. `applicantNamesearchInfo`/`regPrivilegeNamesearchInfo`의 소문자 `s`는 오탈자가 아니라 KIPRIS 실제 API 경로 표기임 |

화면의 "번호" 입력칸 하나에는 출원번호·등록번호·공개번호·공고번호 중 아무거나 입력할 수 있는데,
KIPRIS는 이 4가지(상표는 3가지)를 서로 다른 오퍼레이션으로 나눠 제공합니다. 그래서
`patentService.searchByNumber()` / `trademarkService.searchByNumber()`는 입력된 번호를 위 오퍼레이션
전체에 병렬로 조회한 뒤 결과를 합쳐서 반환합니다 — 사용자가 어떤 번호를 넣었는지 미리 판별할 필요가
없습니다. 응답의 `resultCode`가 `20`(결과없음)인 항목은 오류가 아니라 정상적인 "매칭 없음"으로 처리하고,
4(3)개 오퍼레이션이 전부 진짜 오류일 때만 화면에 오류로 표시합니다.

검색 화면에는 "번호" 입력칸과 별도로 "키워드" 입력칸이 있어, 번호를 모를 때도 검색할 수 있습니다.
번호를 입력하면 번호 검색이 우선하고, 비어 있으면 키워드로 검색합니다.
- 특허·실용신안: `freeSearchInfo`(자유검색) 하나로 발명·고안의 명칭, 출원인명 등을 폭넓게 검색합니다.
- 상표: 상표명(국문/영문, 예: `Clean wiz`)과 출원인·등록권자(상표권자) 명칭(예: `제이에스스퀘어`)을
  구분 없이 검색할 수 있도록 `trademarkNameSearchInfo`(상표명칭) / `applicantNamesearchInfo`(출원인명) /
  `regPrivilegeNamesearchInfo`(등록권자명) 3개 오퍼레이션을 병렬 호출한 뒤 병합합니다. 출원 이후
  권리가 양도되어 출원인과 현재 상표권자가 다른 경우까지 대비해 두 이름 모두로 검색되게 했습니다.

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
- **상표 행정처리 이력 (`RelatedDocsonfileTMService`, KIPRIS Plus 추가 구매 상품)**: 구매하신
  KIPRIS Plus 상품 상세 페이지에서 확인한 요청 주소(`/openapi/rest/RelatedDocsonfileTMService/
  relatedDocsonfileInfo`, `accessKey` 인증)를 `server/src/kipris/trademarkAdminHistoryService.js`에
  그대로 연동했습니다. 출원서·의견제출통지서 등 서류 단위의 처리 이력(일자·서류명·구분·상태)을
  보여주며, 상표 상세 조회 시 항상 함께 조회합니다 — 서지상세 조회가 성공한 경우(공고/등록 상태)에는
  "행정처리 이력" 섹션으로 추가 표시되고, 실패한 경우(출원 상태)에는 법적 상태 이력과 함께 대체
  정보로 표시됩니다. 이 상품을 구매하지 않았거나 이 서비스만 실패해도 나머지 화면 표시에는 영향이
  없습니다(오류를 삼키고 빈 목록으로 처리).
  - ⚠️ 이 서비스의 정확한 응답 필드명은 공식 문서로 확인하지 못해(요청 URL만 KIPRIS Plus 상품
    페이지에서 확인됨), 자주 쓰이는 후보 필드명 여러 개를 매핑해 두었습니다. 실제 배포 환경에서
    "행정처리 이력" 표가 비어 보이거나 값이 어긋나 있다면, 상세 조회 화면의 "원본 응답 데이터"에서
    실제 필드명을 확인해 `trademarkAdminHistoryService.js`의 `pick()` 후보 목록을 조정해 주세요.

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
