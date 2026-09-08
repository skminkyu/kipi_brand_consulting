import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { IP_TYPE_LABEL, inquiryApi } from "../api.js";
import { isPushSupported, subscribeToPush } from "../push.js";

export default function InquiryDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [inquiry, setInquiry] = useState(null);
  const [error, setError] = useState("");
  const [pushState, setPushState] = useState("idle"); // idle | subscribing | subscribed | error
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    inquiryApi
      .get(id)
      .then(setInquiry)
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleSubscribe() {
    setPushState("subscribing");
    setPushError("");
    try {
      await subscribeToPush(id);
      setPushState("subscribed");
    } catch (err) {
      setPushState("error");
      setPushError(err.message);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!inquiry) return <p className="text-muted">불러오는 중...</p>;

  return (
    <div>
      <h1 className="page-title">문의 상세 #{inquiry.id}</h1>

      {location.state?.justCreated && (
        <div className="alert alert-success">
          문의가 정상적으로 등록되었습니다. 답변이 등록되면 입력하신 이메일로 안내드립니다.
        </div>
      )}

      {inquiry.status === "OPEN" && isPushSupported() && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            브라우저 알림으로도 받기 (선택)
          </div>
          <p className="page-desc" style={{ marginBottom: 12 }}>
            회사 메일 보안 정책 등으로 이메일이 도착하지 않을 수 있습니다. 이 버튼을 눌러 알림을
            허용해두시면, 답변이 등록될 때 이 브라우저로도 알려드립니다 (이 기기·브라우저를 계속
            사용해야 하며, 이메일 발송과 별개로 추가 안내됩니다).
          </p>
          {pushState === "subscribed" ? (
            <div className="alert alert-success" style={{ margin: 0 }}>
              알림이 설정되었습니다. 이 브라우저에서 답변 등록 알림을 받을 수 있습니다.
            </div>
          ) : (
            <>
              <button type="button" className="btn" onClick={handleSubscribe} disabled={pushState === "subscribing"}>
                {pushState === "subscribing" ? "설정 중..." : "브라우저 알림 받기"}
              </button>
              {pushState === "error" && (
                <div className="alert alert-error" style={{ marginTop: 10 }}>
                  {pushError}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="detail-grid">
          <Field label="구분" value={IP_TYPE_LABEL[inquiry.ip_type]} />
          <Field label="상태" value={inquiry.status === "ANSWERED" ? "답변완료" : "대기중"} />
          <Field label="문의자" value={inquiry.requester_name} />
          <Field label="문의자 이메일" value={inquiry.requester_email} />
          <Field label="등록일" value={inquiry.created_at} />
        </div>

        <div className="section-title">제목</div>
        <p>{inquiry.subject}</p>

        <div className="section-title">문의 내용</div>
        <p style={{ whiteSpace: "pre-wrap" }}>{inquiry.comment}</p>

        {inquiry.ip_numbers?.length > 0 && (
          <>
            <div className="section-title">관련 번호 ({inquiry.ip_numbers.length}건)</div>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {inquiry.ip_numbers.map((entry) => (
                <li key={entry.id} className="meta-line">
                  {entry.ip_number}
                  {entry.ip_snapshot && (
                    <> — {entry.ip_snapshot.title || entry.ip_snapshot.titleKor || "(명칭 없음)"}</>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {inquiry.attachments?.length > 0 && (
          <>
            <div className="section-title">첨부파일</div>
            <ul className="attachment-list">
              {inquiry.attachments.map((att) => (
                <li key={att.id}>
                  <a href={inquiryApi.attachmentUrl(inquiry.id, att.id)}>{att.original_name}</a>{" "}
                  <span className="text-muted">({formatSize(att.size_bytes)})</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {inquiry.status === "ANSWERED" && (
        <div className="card" style={{ marginTop: 16, background: "#f6fef9" }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            컴플라이언스 담당자 답변
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{inquiry.response_comment}</p>
          <p className="meta-line">
            담당자: {inquiry.responder_name || "-"} / 답변일시: {inquiry.responded_at}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="field-value">{value || "-"}</div>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return "0KB";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb / 1024).toFixed(1)}MB`;
}
