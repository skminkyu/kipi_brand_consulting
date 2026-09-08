import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IP_TYPE_LABEL, inquiryApi } from "../api.js";

export default function ComplianceDashboardPage() {
  const { id } = useParams();
  return id ? <ComplianceInquiryDetail id={id} /> : <ComplianceInquiryList />;
}

function ComplianceInquiryList() {
  const [inquiries, setInquiries] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function load() {
    inquiryApi.list().then(setInquiries).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const openCount = inquiries?.filter((i) => i.status === "OPEN").length ?? 0;

  return (
    <div>
      <h1 className="page-title">컴플라이언스 담당자 화면</h1>
      <p className="page-desc">
        접수된 특허·상표·실용신안 관련 문의를 확인하고 답변을 등록합니다. 답변을 저장하면 문의자 이메일로
        자동 안내 메일이 발송됩니다.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {inquiries && <p className="text-muted">대기중 {openCount}건 / 전체 {inquiries.length}건</p>}

      {inquiries && inquiries.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>구분</th>
                <th>제목</th>
                <th>문의자 이메일</th>
                <th>등록일</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inq) => (
                <tr key={inq.id} className="clickable" onClick={() => navigate(`/compliance/${inq.id}`)}>
                  <td>#{inq.id}</td>
                  <td>
                    <span className="badge badge-type">{IP_TYPE_LABEL[inq.ip_type]}</span>
                  </td>
                  <td>{inq.subject}</td>
                  <td>{inq.requester_email}</td>
                  <td>{inq.created_at}</td>
                  <td>
                    {inq.status === "ANSWERED" ? (
                      <span className="badge badge-answered">답변완료</span>
                    ) : (
                      <span className="badge badge-open">대기중</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inquiries && inquiries.length === 0 && <div className="empty-state">접수된 문의가 없습니다.</div>}
    </div>
  );
}

function ComplianceInquiryDetail({ id }) {
  const [inquiry, setInquiry] = useState(null);
  const [error, setError] = useState("");
  const [responderName, setResponderName] = useState("");
  const [respondedEmail, setRespondedEmail] = useState("");
  const [responseComment, setResponseComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [mailNotice, setMailNotice] = useState(null);

  function load() {
    inquiryApi.get(id).then((data) => {
      setInquiry(data);
      setRespondedEmail(data.responded_email || data.requester_email || "");
      setResponderName(data.responder_name || "");
      setResponseComment(data.response_comment || "");
    }).catch((err) => setError(err.message));
  }

  useEffect(load, [id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaveError("");
    setMailNotice(null);

    if (!respondedEmail.trim()) {
      setSaveError("문의한 사람의 이메일 주소를 입력해 주세요.");
      return;
    }
    if (!responseComment.trim()) {
      setSaveError("답변(의견) 코멘트를 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const updated = await inquiryApi.respond(id, {
        responderName: responderName.trim(),
        respondedEmail: respondedEmail.trim(),
        responseComment: responseComment.trim(),
      });
      setInquiry(updated);
      setMailNotice(updated.mail || { sent: false });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!inquiry) return <p className="text-muted">불러오는 중...</p>;

  return (
    <div>
      <h1 className="page-title">문의 답변 등록 - #{inquiry.id}</h1>

      <div className="card">
        <div className="detail-grid">
          <Field label="구분" value={IP_TYPE_LABEL[inquiry.ip_type]} />
          <Field label="관련 IP 번호" value={inquiry.ip_number} />
          <Field label="문의자" value={inquiry.requester_name} />
          <Field label="문의자 이메일(원본)" value={inquiry.requester_email} />
          <Field label="등록일" value={inquiry.created_at} />
        </div>
        <div className="section-title">제목</div>
        <p>{inquiry.subject}</p>
        <div className="section-title">문의 내용</div>
        <p style={{ whiteSpace: "pre-wrap" }}>{inquiry.comment}</p>

        {inquiry.attachments?.length > 0 && (
          <>
            <div className="section-title">첨부파일</div>
            <ul className="attachment-list">
              {inquiry.attachments.map((att) => (
                <li key={att.id}>
                  <a href={inquiryApi.attachmentUrl(inquiry.id, att.id)}>{att.original_name}</a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <form className="card" style={{ marginTop: 16 }} onSubmit={handleSave}>
        <div className="section-title" style={{ marginTop: 0 }}>
          담당자 답변 등록
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="responderName">담당자 이름 (선택)</label>
            <input id="responderName" type="text" value={responderName} onChange={(e) => setResponderName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="respondedEmail">
              문의한 사람의 이메일 주소 <span className="hint">(답변 등록 안내 메일 발송)</span>
            </label>
            <input
              id="respondedEmail"
              type="email"
              required
              value={respondedEmail}
              onChange={(e) => setRespondedEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="responseComment">답변(의견) 코멘트</label>
            <textarea
              id="responseComment"
              required
              value={responseComment}
              onChange={(e) => setResponseComment(e.target.value)}
            />
          </div>
        </div>

        {saveError && <div className="alert alert-error">{saveError}</div>}
        {mailNotice?.sent && (
          <div className="alert alert-success">답변이 저장되었고, 문의자에게 안내 메일이 발송되었습니다.</div>
        )}
        {mailNotice && !mailNotice.sent && (
          <div className="alert alert-error">
            답변은 저장되었지만 메일 발송에 실패했습니다.
            {mailNotice.reason === "SMTP_NOT_CONFIGURED" ? (
              <> 서버에 SMTP 계정 정보(SMTP_HOST/USER/PASS)가 설정되어 있지 않습니다.</>
            ) : mailNotice.error ? (
              <>
                {" "}
                원인: <code>{mailNotice.error}</code>
                {(mailNotice.errorCode || mailNotice.errorAddress || mailNotice.errorPort) && (
                  <>
                    {" "}
                    (<code>
                      {[
                        mailNotice.errorCode,
                        mailNotice.errorAddress && `address=${mailNotice.errorAddress}`,
                        mailNotice.errorPort && `port=${mailNotice.errorPort}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </code>)
                  </>
                )}
              </>
            ) : (
              <> 서버의 SMTP 설정을 확인해 주세요.</>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </form>
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
