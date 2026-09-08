const webpush = require("web-push");
const db = require("./db");

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

function isEnabled() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/** 문의자가 브라우저 알림을 허용하면 전달되는 구독 정보를 저장한다. */
function saveSubscription(inquiryId, subscription) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("올바르지 않은 구독 정보입니다.");
  }
  db.prepare(
    `INSERT INTO push_subscriptions (inquiry_id, endpoint, p256dh, auth)
     VALUES (@inquiry_id, @endpoint, @p256dh, @auth)
     ON CONFLICT(endpoint) DO UPDATE SET inquiry_id = excluded.inquiry_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run({ inquiry_id: inquiryId, endpoint, p256dh: keys.p256dh, auth: keys.auth });
}

/** 답변이 등록되면, 해당 문의를 구독 중인 모든 브라우저에 알림을 보낸다. */
async function sendPushForInquiry(inquiry) {
  if (!ensureConfigured()) {
    return { attempted: 0, sent: 0 };
  }

  const rows = db.prepare("SELECT * FROM push_subscriptions WHERE inquiry_id = ?").all(inquiry.id);
  if (rows.length === 0) return { attempted: 0, sent: 0 };

  const webUrl = process.env.PUBLIC_WEB_URL || "http://localhost:5173";
  const detailUrl = `${webUrl.replace(/\/$/, "")}/inquiries/${inquiry.id}`;
  const payload = JSON.stringify({
    title: "답변이 등록되었습니다",
    body: `문의 #${inquiry.id} "${inquiry.subject}"에 대한 담당자 답변이 등록되었습니다.`,
    url: detailUrl,
  });

  let sent = 0;
  await Promise.all(
    rows.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload);
        sent += 1;
      } catch (err) {
        // 410 Gone / 404 Not Found - 구독이 만료되었거나 취소된 경우, 더 이상 재시도하지 않도록 삭제한다.
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(row.id);
        } else {
          console.warn(`[webPush] 발송 실패 (inquiry #${inquiry.id}):`, err.message);
        }
      }
    })
  );

  return { attempted: rows.length, sent };
}

module.exports = { isEnabled, getPublicKey, saveSubscription, sendPushForInquiry };
