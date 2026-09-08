const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // SMTP 미설정 - 메일 발송을 건너뛴다 (개발 환경 등)
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // SMTP 서버에 연결이 안 되는 경우(설정 오류 등) 답변 저장 요청이 무한 대기하지 않도록 제한
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
  return transporter;
}

/** 컴플라이언스 담당자가 답변을 등록하면 문의자에게 안내 메일을 발송한다. */
async function sendInquiryAnsweredMail(inquiry) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP 미설정으로 메일 발송을 건너뜁니다. (문의 #${inquiry.id} -> ${inquiry.responded_email})`);
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const webUrl = process.env.PUBLIC_WEB_URL || "http://localhost:5173";
  const detailUrl = `${webUrl.replace(/\/$/, "")}/inquiries/${inquiry.id}`;
  const fromName = process.env.SMTP_FROM_NAME || "KIPI 컴플라이언스팀";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const subjectLabel = { PATENT: "특허", UTILITY: "실용신안", TRADEMARK: "상표" }[inquiry.ip_type] || "지식재산권";

  await t.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: inquiry.responded_email,
    subject: `[KIPI 컴플라이언스] 문의하신 건(${subjectLabel} 문의 #${inquiry.id})에 대한 답변이 등록되었습니다`,
    text:
      `안녕하세요, KIPI 컴플라이언스팀입니다.\n\n` +
      `문의하신 아래 건에 대한 담당자 답변이 등록되었습니다.\n\n` +
      `- 문의번호: #${inquiry.id}\n` +
      `- 구분: ${subjectLabel}\n` +
      `- 관련 번호: ${inquiry.ip_number || "-"}\n` +
      `- 문의 제목: ${inquiry.subject}\n\n` +
      `[담당자 답변]\n${inquiry.response_comment}\n\n` +
      `자세한 내용은 아래 링크에서 확인하실 수 있습니다.\n${detailUrl}\n\n` +
      `감사합니다.`,
    html:
      `<p>안녕하세요, KIPI 컴플라이언스팀입니다.</p>` +
      `<p>문의하신 아래 건에 대한 담당자 답변이 등록되었습니다.</p>` +
      `<ul>` +
      `<li>문의번호: #${inquiry.id}</li>` +
      `<li>구분: ${subjectLabel}</li>` +
      `<li>관련 번호: ${inquiry.ip_number || "-"}</li>` +
      `<li>문의 제목: ${escapeHtml(inquiry.subject)}</li>` +
      `</ul>` +
      `<p><strong>[담당자 답변]</strong><br/>${escapeHtml(inquiry.response_comment).replace(/\n/g, "<br/>")}</p>` +
      `<p><a href="${detailUrl}">${detailUrl}</a> 에서 자세한 내용을 확인하실 수 있습니다.</p>` +
      `<p>감사합니다.</p>`,
  });

  return { sent: true };
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

module.exports = { sendInquiryAnsweredMail };
