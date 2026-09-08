const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { upload } = require("../upload");
const { sendInquiryAnsweredMail } = require("../mailer");
const webPush = require("../webPush");
const patentService = require("../kipris/patentService");
const trademarkService = require("../kipris/trademarkService");
const { complianceBasicAuth } = require("../complianceAuth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_TYPES = ["PATENT", "UTILITY", "TRADEMARK"];

function inquiryRowToJson(row) {
  return {
    ...row,
    ip_snapshot: row.ip_snapshot ? JSON.parse(row.ip_snapshot) : null,
  };
}

function getAttachmentsForInquiry(inquiryId) {
  return db
    .prepare(
      "SELECT id, inquiry_id, original_name, mime_type, size_bytes, created_at FROM attachments WHERE inquiry_id = ? ORDER BY id"
    )
    .all(inquiryId);
}

function getIpNumbersForInquiry(inquiryId) {
  return db
    .prepare("SELECT id, inquiry_id, ip_number, ip_title, ip_snapshot, created_at FROM inquiry_ip_numbers WHERE inquiry_id = ? ORDER BY id")
    .all(inquiryId)
    .map((row) => ({ ...row, ip_snapshot: row.ip_snapshot ? JSON.parse(row.ip_snapshot) : null }));
}

/** 폼에서 온 ipNumbers(JSON 배열 문자열) 또는 구버전 ipNumber(단일 문자열)를 정규화한다. */
function parseIpNumbers(body) {
  let numbers = [];
  if (body.ipNumbers) {
    try {
      numbers = JSON.parse(body.ipNumbers);
    } catch {
      numbers = [body.ipNumbers];
    }
  } else if (body.ipNumber) {
    numbers = [body.ipNumber];
  }
  if (!Array.isArray(numbers)) numbers = [numbers];
  return [...new Set(numbers.map((n) => String(n || "").trim()).filter(Boolean))];
}

/**
 * POST /api/inquiries
 * 컴플라이언스 문의 등록. multipart/form-data (파일 첨부 지원).
 * 필드: ipType, ipNumbers(선택, JSON 배열 문자열 - 여러 개의 출원/등록/공고번호 연결 가능),
 *       requesterName(선택), requesterEmail, subject, comment
 */
router.post("/", upload.array("attachments", 5), async (req, res) => {
  const { ipType, requesterName, requesterEmail, subject, comment } = req.body;

  if (!ipType || !IP_TYPES.includes(ipType)) {
    return res.status(400).json({ error: "ipType 은 PATENT, UTILITY, TRADEMARK 중 하나여야 합니다." });
  }
  if (!requesterEmail || !EMAIL_RE.test(requesterEmail)) {
    return res.status(400).json({ error: "올바른 문의자 이메일 주소를 입력해 주세요." });
  }
  if (!subject || !comment) {
    return res.status(400).json({ error: "제목과 문의 내용을 입력해 주세요." });
  }

  const ipNumbers = parseIpNumbers(req.body);

  // 번호가 입력된 경우 KIPRIS API 조회 결과를 번호별로 스냅샷 저장한다.
  const snapshots = await Promise.all(
    ipNumbers.map(async (number) => {
      try {
        const snapshot =
          ipType === "TRADEMARK" ? await trademarkService.getDetail(number) : await patentService.getDetail(number);
        return { number, snapshot };
      } catch (err) {
        console.warn(`[inquiry] KIPRIS 스냅샷 조회 실패 (ipType=${ipType}, ipNumber=${number}):`, err.message);
        return { number, snapshot: null };
      }
    })
  );

  const insert = db.prepare(`
    INSERT INTO inquiries (ip_type, ip_number, ip_title, ip_snapshot, requester_name, requester_email, subject, comment)
    VALUES (@ip_type, @ip_number, @ip_title, @ip_snapshot, @requester_name, @requester_email, @subject, @comment)
  `);
  const result = insert.run({
    ip_type: ipType,
    // 하위 호환(목록 화면 등)을 위해 번호들을 콤마로 합친 요약 문자열만 유지한다.
    ip_number: ipNumbers.length > 0 ? ipNumbers.join(", ") : null,
    ip_title: snapshots[0]?.snapshot?.title || snapshots[0]?.snapshot?.titleKor || null,
    ip_snapshot: null,
    requester_name: requesterName || null,
    requester_email: requesterEmail,
    subject,
    comment,
  });

  const inquiryId = result.lastInsertRowid;

  if (snapshots.length > 0) {
    const insertNumber = db.prepare(`
      INSERT INTO inquiry_ip_numbers (inquiry_id, ip_number, ip_title, ip_snapshot)
      VALUES (@inquiry_id, @ip_number, @ip_title, @ip_snapshot)
    `);
    for (const { number, snapshot } of snapshots) {
      insertNumber.run({
        inquiry_id: inquiryId,
        ip_number: number,
        ip_title: snapshot?.title || snapshot?.titleKor || null,
        ip_snapshot: snapshot ? JSON.stringify(snapshot) : null,
      });
    }
  }

  const files = req.files || [];
  if (files.length > 0) {
    const insertFile = db.prepare(`
      INSERT INTO attachments (inquiry_id, original_name, stored_name, mime_type, size_bytes)
      VALUES (@inquiry_id, @original_name, @stored_name, @mime_type, @size_bytes)
    `);
    for (const f of files) {
      insertFile.run({
        inquiry_id: inquiryId,
        original_name: f.originalname,
        stored_name: f.filename,
        mime_type: f.mimetype,
        size_bytes: f.size,
      });
    }
  }

  const row = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(inquiryId);
  res.status(201).json({
    ...inquiryRowToJson(row),
    attachments: getAttachmentsForInquiry(inquiryId),
    ip_numbers: getIpNumbersForInquiry(inquiryId),
  });
});

/**
 * GET /api/inquiries
 * 문의 내역 전체 목록 - 별도 로그인 없이 누구나 확인 가능 (요건에 따름).
 */
router.get("/", (req, res) => {
  const { status } = req.query;
  let rows;
  if (status && ["OPEN", "ANSWERED"].includes(status)) {
    rows = db.prepare("SELECT * FROM inquiries WHERE status = ? ORDER BY id DESC").all(status);
  } else {
    rows = db.prepare("SELECT * FROM inquiries ORDER BY id DESC").all();
  }
  res.json(rows.map(inquiryRowToJson));
});

/** GET /api/inquiries/:id - 문의 상세 (첨부파일, 연결된 IP 번호 목록 포함) */
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "문의 내역을 찾을 수 없습니다." });
  res.json({
    ...inquiryRowToJson(row),
    attachments: getAttachmentsForInquiry(row.id),
    ip_numbers: getIpNumbersForInquiry(row.id),
  });
});

/** GET /api/inquiries/:id/attachments/:attachmentId - 첨부파일 다운로드 */
router.get("/:id/attachments/:attachmentId", (req, res) => {
  const att = db
    .prepare("SELECT * FROM attachments WHERE id = ? AND inquiry_id = ?")
    .get(req.params.attachmentId, req.params.id);
  if (!att) return res.status(404).json({ error: "첨부파일을 찾을 수 없습니다." });

  const filePath = path.join(require("../upload").UPLOAD_DIR, att.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "파일이 존재하지 않습니다." });

  res.download(filePath, att.original_name);
});

/**
 * POST /api/inquiries/:id/push-subscription
 * 문의자가 브라우저 알림(Web Push)을 허용하면, 답변 등록 시 알림을 받을 수 있도록
 * 구독 정보를 저장한다. 이메일이 회사 보안정책 등으로 도달하지 않는 경우의 보조 채널.
 */
router.post("/:id/push-subscription", (req, res) => {
  const row = db.prepare("SELECT id FROM inquiries WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "문의 내역을 찾을 수 없습니다." });

  try {
    webPush.saveSubscription(row.id, req.body?.subscription);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/inquiries/:id/response
 * 컴플라이언스 담당자가 답변 코멘트와 문의자 이메일을 확인/기재 후 저장.
 * 저장과 동시에 문의자에게 답변 등록 안내 메일을 자동 발송한다.
 * 필드: responderName(선택), respondedEmail, responseComment
 */
router.patch("/:id/response", complianceBasicAuth, async (req, res) => {
  const { responderName, respondedEmail, responseComment } = req.body;

  const row = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "문의 내역을 찾을 수 없습니다." });

  if (!respondedEmail || !EMAIL_RE.test(respondedEmail)) {
    return res.status(400).json({ error: "올바른 문의자 이메일 주소를 입력해 주세요." });
  }
  if (!responseComment) {
    return res.status(400).json({ error: "답변 코멘트를 입력해 주세요." });
  }

  db.prepare(`
    UPDATE inquiries
    SET status = 'ANSWERED', response_comment = ?, responder_name = ?, responded_email = ?, responded_at = datetime('now')
    WHERE id = ?
  `).run(responseComment, responderName || null, respondedEmail, row.id);

  const updated = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(row.id);

  let mailResult = { sent: false };
  try {
    mailResult = await sendInquiryAnsweredMail(updated);
  } catch (err) {
    console.error("[inquiry] 답변 등록 메일 발송 실패:", err);
    // 원인 진단에 필요한 필드(code/address/port 등)를 최대한 함께 노출한다.
    mailResult = {
      sent: false,
      reason: "SEND_FAILED",
      error: err.message,
      errorCode: err.code,
      errorAddress: err.address,
      errorPort: err.port,
    };
  }

  let pushResult = { attempted: 0, sent: 0 };
  try {
    pushResult = await webPush.sendPushForInquiry(updated);
  } catch (err) {
    console.error("[inquiry] 답변 등록 브라우저 알림 발송 실패:", err);
  }

  res.json({
    ...inquiryRowToJson(updated),
    attachments: getAttachmentsForInquiry(updated.id),
    ip_numbers: getIpNumbersForInquiry(updated.id),
    mail: mailResult,
    push: pushResult,
  });
});

module.exports = router;
