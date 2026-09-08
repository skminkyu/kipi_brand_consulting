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
    // 일부 컨테이너 환경은 아웃바운드 IPv6 경로가 없어 IPv6(AAAA) 주소로 연결 시도 시
    // ENETUNREACH가 발생한다. IPv4를 강제해 이 문제를 피한다.
    family: 4,
  });
  return transporter;
}

function buildMailContent(inquiry) {
  const webUrl = process.env.PUBLIC_WEB_URL || "http://localhost:5173";
  const detailUrl = `${webUrl.replace(/\/$/, "")}/inquiries/${inquiry.id}`;
  const subjectLabel = { PATENT: "특허", UTILITY: "실용신안", TRADEMARK: "상표" }[inquiry.ip_type] || "지식재산권";

  return {
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
  };
}

/**
 * Resend(https://resend.com) HTTPS API로 메일을 보낸다. SMTP 포트가 클라우드 호스팅 환경에서
 * 막히거나 타임아웃되는 경우가 많아, HTTPS(443)로만 통신하는 이 방식이 훨씬 안정적으로 동작한다.
 * RESEND_API_KEY가 설정되어 있으면 SMTP보다 이 방식을 우선 사용한다.
 */
async function sendViaResend(inquiry) {
  const { subject, text, html } = buildMailContent(inquiry);
  const fromName = process.env.SMTP_FROM_NAME || "KIPI 컴플라이언스팀";
  // 도메인을 인증하지 않았다면 RESEND_FROM_EMAIL을 비워두고, resend.dev 기본 발신 주소를 사용한다.
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [inquiry.responded_email],
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Resend API 오류 (HTTP ${res.status}): ${body.slice(0, 300)}`);
    err.code = `RESEND_HTTP_${res.status}`;
    throw err;
  }

  return { sent: true };
}

/**
 * SendGrid(https://sendgrid.com) HTTPS API로 메일을 보낸다. Resend와 달리 도메인 전체를
 * 인증하지 않아도 "Single Sender Verification"(발신 이메일 주소 1개만 인증)으로 임의의
 * 수신자에게 발송할 수 있어, 회사/개인 도메인이 없을 때 대안으로 쓸 수 있다.
 * SENDGRID_API_KEY가 설정되어 있으면 Resend/SMTP보다 이 방식을 우선 사용한다.
 */
async function sendViaSendGrid(inquiry) {
  const { subject, text, html } = buildMailContent(inquiry);
  const fromName = process.env.SMTP_FROM_NAME || "KIPI 컴플라이언스팀";
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error(
      "SENDGRID_FROM_EMAIL이 설정되지 않았습니다. SendGrid에서 Single Sender Verification으로 인증한 " +
        "이메일 주소를 지정해야 합니다."
    );
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: inquiry.responded_email }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`SendGrid API 오류 (HTTP ${res.status}): ${body.slice(0, 300)}`);
    err.code = `SENDGRID_HTTP_${res.status}`;
    throw err;
  }

  return { sent: true };
}

async function sendViaSmtp(inquiry) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP 미설정으로 메일 발송을 건너뜁니다. (문의 #${inquiry.id} -> ${inquiry.responded_email})`);
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const { subject, text, html } = buildMailContent(inquiry);
  const fromName = process.env.SMTP_FROM_NAME || "KIPI 컴플라이언스팀";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await t.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: inquiry.responded_email,
    subject,
    text,
    html,
  });

  return { sent: true };
}

/** 컴플라이언스 담당자가 답변을 등록하면 문의자에게 안내 메일을 발송한다. */
async function sendInquiryAnsweredMail(inquiry) {
  if (process.env.SENDGRID_API_KEY) {
    return sendViaSendGrid(inquiry);
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(inquiry);
  }
  return sendViaSmtp(inquiry);
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
