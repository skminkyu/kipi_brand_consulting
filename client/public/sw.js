// 답변 등록 브라우저 알림(Web Push)을 표시하기 위한 최소한의 서비스 워커.
// 별도 빌드 과정 없이 정적 파일로 그대로 서빙된다 (client/dist/sw.js).

self.addEventListener("push", (event) => {
  let data = { title: "답변이 등록되었습니다", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // JSON 파싱 실패 시 기본값 사용
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.svg",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
