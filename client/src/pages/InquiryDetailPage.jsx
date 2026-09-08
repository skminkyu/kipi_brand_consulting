import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { IP_TYPE_LABEL, inquiryApi } from "../api.js";

export default function InquiryDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [inquiry, setInquiry] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    inquiryApi
      .get(id)
      .then(setInquiry)
      .catch((err) => setError(err.message));
  }, [id]);

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

      <div className="card">
        <div className="detail-grid">
          <Field label="구분" value={IP_TYPE_LABEL[inquiry.ip_type]} />
          <Field label="관련 IP 번호" value={inquiry.ip_number} />
          <Field label="상태" value={inquiry.status === "ANSWERED" ? "답변완료" : "대기중"} />
          <Field label="문의자" value={inquiry.requester_name} />
          <Field label="문의자 이메일" value={inquiry.requester_email} />
          <Field label="등록일" value={inquiry.created_at} />
        </div>

        <div className="section-title">제목</div>
        <p>{inquiry.subject}</p>

        <div className="section-title">문의 내용</div>
        <p style={{ whiteSpace: "pre-wrap" }}>{inquiry.comment}</p>

        {inquiry.ip_snapshot && (
          <>
            <div className="section-title">문의 시점 KIPRIS 조회 정보</div>
            <p className="meta-line">
              {inquiry.ip_snapshot.title || inquiry.ip_snapshot.titleKor || "(명칭 없음)"} / 출원번호{" "}
              {inquiry.ip_snapshot.applicationNumber}
            </p>
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
