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
- 컴플라이언스 담당자 전용 화면에서 문의를 확인하고, 답변 코멘트 + 문의자 이메일을 입력 후 저장하면
  - 답변 내용이 저장되고
  - 문의자 이메일로 답변 등록 안내 메일이 자동 발송됩니다.

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

## KIPRIS API 연동 관련 참고사항

- KIPRIS Plus OpenAPI(`https://plus.kipris.or.kr/kipo-api/kipi/...`) 서비스명/필드명은 KIPRIS 포털
  (https://plus.kipris.or.kr) 서비스별 명세서를 기준으로 구현했습니다.
- 이 개발 환경은 보안 정책상 `plus.kipris.or.kr`로의 외부 네트워크 호출이 차단되어 있어, 실제 운영
  환경에서 발급받은 키로 최초 연동 시 KIPRIS 응답 필드명이 명세와 다르게 내려오는 항목이 있다면
  `server/src/kipris/patentService.js`, `server/src/kipris/trademarkService.js`의 `normalizeItem()`
  함수에서 후보 필드명(`pick(obj, [...후보키...])`)만 추가/조정하면 됩니다.
- 상세 조회 화면 하단의 "원본 응답 데이터" 접이식 패널에서 KIPRIS가 실제로 내려준 전체 필드를 그대로
  확인할 수 있어, 필드 매핑을 조정할 때 참고할 수 있습니다.

## 보안/운영 참고사항

- `server/.env` 파일에는 KIPRIS API 키, SMTP 계정 정보 등 민감정보가 포함되므로 절대 git에 커밋하지
  마세요 (`.gitignore`에 등록되어 있습니다).
- 현재 문의 내역 목록/상세 조회 API는 요건에 따라 별도 로그인 없이 접근 가능하도록 구현되어 있습니다.
  운영 환경에서 접근 범위를 제한하고 싶다면 사내 인증(SSO 등) 미들웨어를 추가하는 것을 권장합니다.
