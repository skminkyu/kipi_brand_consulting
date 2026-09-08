const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

// Railway 등에 배포 시 Volume을 마운트한 경로를 DATA_DIR로 지정하면
// 재배포/재시작 이후에도 문의 데이터가 보존된다.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "..", "data"));
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "kipi.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_type TEXT NOT NULL,              -- PATENT | UTILITY | TRADEMARK
    ip_number TEXT,                     -- 출원/등록/공고 번호 등
    ip_title TEXT,                      -- KIPRIS에서 조회된 발명/상표 명칭 (스냅샷)
    ip_snapshot TEXT,                   -- KIPRIS 조회 결과 JSON 스냅샷 (문의 시점)
    requester_name TEXT,
    requester_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    comment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | ANSWERED
    response_comment TEXT,
    responder_name TEXT,
    responded_email TEXT,               -- 담당자가 저장 시 확인/기재한 문의자 이메일
    responded_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 문의자가 브라우저 알림(Web Push)을 허용하면 저장되는 구독 정보.
  -- 이메일이 회사 보안정책 등으로 막히는 경우를 대비한 대체/보조 알림 채널.
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
