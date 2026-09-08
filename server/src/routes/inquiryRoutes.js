const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { upload } = require("../upload");
const { sendInquiryAnsweredMail } = require("../mailer");
const patentService = require("../kipris/patentService");
const trademarkService = require("../kipris/trademarkService");

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

/**
 * POST /api/inquiries
 * 컴플라이언스 문의 등록. multipart/form-data (파일 첨부 지원).
 * 필드: ipType, ipNumber(선택), requesterName(선택), requesterEmail, subject, comment
 */
router.post("/", upload.array("attachments", 5), async (req, res) => {
  const { ipType, ipNumber, requesterName, requesterEmail, subject, comment } = req.body;

  if (!ipType || !IP_TYPES.includes(ipType)) {
    return res.status(400).json({ error: "ipType 은 PATENT, UTILITY, TRADEMARK 중 하나여야 합니다." });
  }
  if (!requesterEmail || !EMAIL_RE.test(requesterEmail)) {
    return res.status(400).json({ error: "올바른 문의자 이메일 주소를 입력해 주세요." });
  }
  if (!subject || !comment) {
    return res.status(400).json({ error: "제목과 문의 내용을 입력해 주세요." });
  }

  // 번호가 입력된 경우 KIPRIS API 조회 결과를 스냅샷으로 함께 저장한다.
  let snapshot = null;
  if (ipNumber) {
    try {
      snapshot =
        ipType === "TRADEMARK"
          ? await trademarkService.getDetail(ipNumber)
          : await patentService.getDetail(ipNumber);
    } catch (err) {
      console.warn(`[inquiry] KIPRIS 스냅샷 조회 실패 (ipType=${ipType}, ipNumber=${ipNumber}):`, err.message);
    }
  }

  const insert = db.prepare(`
    INSERT INTO inquiries (ip_type, ip_number, ip_title, ip_snapshot, requester_name, requester_email, subject, comment)
    VALUES (@ip_type, @ip_number, @ip_title, @ip_snapshot, @requester_name, @requester_email, @subject, @comment)
  `);
  const result = insert.run({
    ip_type: ipType,
    ip_number: ipNumber || null,
    ip_title: snapshot?.title || snapshot?.titleKor || null,
    ip_snapshot: snapshot ? JSON.stringify(snapshot) : null,
    requester_name: requesterName || null,
    requester_email: requesterEmail,
    subject,
    comment,
  });

  const inquiryId = result.lastInsertRowid;

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
  res.status(201).json({ ...inquiryRowToJson(row), attachments: getAttachmentsForInquiry(inquiryId) });
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

/** GET /api/inquiries/:id - 문의 상세 (첨부파일 목록 포함) */
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "문의 내역을 찾을 수 없습니다." });
  res.json({ ...inquiryRowToJson(row), attachments: getAttachmentsForInquiry(row.id) });
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
 * PATCH /api/inquiries/:id/response
 * 컴플라이언스 담당자가 답변 코멘트와 문의자 이메일을 확인/기재 후 저장.
 * 저장과 동시에 문의자에게 답변 등록 안내 메일을 자동 발송한다.
 * 필드: responderName(선택), respondedEmail, responseComment
 */
router.patch("/:id/response", async (req, res) => {
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
  }

  res.json({
    ...inquiryRowToJson(updated),
    attachments: getAttachmentsForInquiry(updated.id),
    mail: mailResult,
  });
});

module.exports = router;
