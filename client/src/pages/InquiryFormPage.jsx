import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { inquiryApi } from "../api.js";
import IpNumberFields from "../components/IpNumberFields.jsx";

export default function InquiryFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [ipType, setIpType] = useState(searchParams.get("ipType") || "PATENT");
  const [ipNumbers, setIpNumbers] = useState([searchParams.get("ipNumber") || ""]);
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    if (!requesterEmail.trim()) {
      setSubmitError("문의자 이메일 주소를 입력해 주세요.");
      return;
    }
    if (!subject.trim() || !comment.trim()) {
      setSubmitError("제목과 문의 내용을 입력해 주세요.");
      return;
    }

    const cleanedNumbers = [...new Set(ipNumbers.map((n) => n.trim()).filter(Boolean))];

    const formData = new FormData();
    formData.append("ipType", ipType);
    formData.append("ipNumbers", JSON.stringify(cleanedNumbers));
    formData.append("requesterName", requesterName.trim());
    formData.append("requesterEmail", requesterEmail.trim());
    formData.append("subject", subject.trim());
    formData.append("comment", comment.trim());
    for (const file of files) {
      formData.append("attachments", file);
    }

    setSubmitting(true);
    try {
      const created = await inquiryApi.create(formData);
      navigate(`/inquiries/${created.id}`, { state: { justCreated: true } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">컴플라이언스 문의하기</h1>
      <p className="page-desc">
        특허·실용신안·상표와 관련하여 컴플라이언스팀에 검토를 요청합니다. 문의 내용과 첨부파일은 담당자가
        확인할 수 있도록 저장되며, 답변이 등록되면 아래 입력하신 이메일로 안내 메일이 발송됩니다.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 180 }}>
            <label htmlFor="ipType">구분</label>
            <select id="ipType" value={ipType} onChange={(e) => setIpType(e.target.value)}>
              <option value="PATENT">특허</option>
              <option value="UTILITY">실용신안</option>
              <option value="TRADEMARK">상표</option>
            </select>
          </div>
        </div>

        <IpNumberFields ipType={ipType} numbers={ipNumbers} onChange={setIpNumbers} />

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="requesterName">문의자 이름 (선택)</label>
            <input id="requesterName" type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="requesterEmail">
              문의자 이메일 주소{" "}
              <span className="hint">
                (필수, 답변 알림 발송 — 회사 메일(@sk.com 등)은 보안 정책상 알림이 차단될 수 있어
                개인 이메일 주소를 권장합니다)
              </span>
            </label>
            <input
              id="requesterEmail"
              type="email"
              required
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="subject">제목</label>
            <input id="subject" type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="comment">문의 내용</label>
            <textarea id="comment" required value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="attachments">첨부파일 (선택, 최대 5개)</label>
            <input
              id="attachments"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>
        </div>

        {submitError && <div className="alert alert-error">{submitError}</div>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "제출 중..." : "문의 등록"}
        </button>
      </form>
    </div>
  );
}
