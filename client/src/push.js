import { inquiryApi, pushApi } from "./api.js";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * 이 브라우저에서 알림 권한을 요청하고, 허용되면 푸시 구독 정보를 서버에 등록한다.
 * 문의 상세 페이지에서 "브라우저 알림 받기" 버튼을 눌렀을 때 호출한다.
 */
export async function subscribeToPush(inquiryId) {
  if (!isPushSupported()) {
    throw new Error("이 브라우저는 알림 기능을 지원하지 않습니다.");
  }

  const { publicKey } = await pushApi.getVapidPublicKey();
  if (!publicKey) {
    throw new Error("서버에 브라우저 알림 기능이 설정되어 있지 않습니다.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
  }

  await inquiryApi.subscribePush(inquiryId, subscription.toJSON());
  return true;
}
