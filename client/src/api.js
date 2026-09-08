const API_BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error || `요청이 실패했습니다. (HTTP ${res.status})`;
    const err = new Error(message);
    err.detail = body?.detail;
    throw err;
  }
  return body;
}

export const IP_TYPE_LABEL = {
  PATENT: "특허",
  UTILITY: "실용신안",
  TRADEMARK: "상표",
};

export const kiprisApi = {
  search: (type, { number, keyword }) => {
    const params = new URLSearchParams({ type });
    if (number) params.set("number", number);
    if (keyword) params.set("keyword", keyword);
    return request(`/kipris/search?${params.toString()}`);
  },
  getPatentDetail: (applicationNumber) =>
    request(`/kipris/patent/${encodeURIComponent(applicationNumber)}`),
  getTrademarkDetail: (applicationNumber) =>
    request(`/kipris/trademark/${encodeURIComponent(applicationNumber)}`),
};

export const inquiryApi = {
  list: (status) => {
    const qs = status ? `?status=${status}` : "";
    return request(`/inquiries${qs}`);
  },
  get: (id) => request(`/inquiries/${id}`),
  create: (formData) =>
    request("/inquiries", {
      method: "POST",
      body: formData, // FormData - Content-Type 은 브라우저가 자동 설정
    }),
  respond: (id, payload) =>
    request(`/inquiries/${id}/response`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  attachmentUrl: (inquiryId, attachmentId) => `${API_BASE}/inquiries/${inquiryId}/attachments/${attachmentId}`,
  subscribePush: (id, subscription) =>
    request(`/inquiries/${id}/push-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    }),
};

export const pushApi = {
  getVapidPublicKey: () => request("/push/vapid-public-key"),
};
