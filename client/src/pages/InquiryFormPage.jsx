import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IP_TYPE_LABEL, inquiryApi, kiprisApi } from "../api.js";
import { detectIpTypeFromNumber, detectUnsupportedTypeLabel } from "../ipNumber.js";

export default function InquiryFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [ipType, setIpType] = useState(searchParams.get("ipType") || "PATENT");
  const [ipNumber, setIpNumber] = useState(searchParams.get("ipNumber") || "");

  const detectedType = useMemo(() => detectIpTypeFromNumber(ipNumber), [ipNumber]);
  const unsupportedLabel = useMemo(() => detectUnsupportedTypeLabel(ipNumber), [ipNumber]);
  const typeMismatch = detectedType && detectedType !== ipType;
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState([]);

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewErrorDetail, setPreviewErrorDetail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handlePreview() {
    if (!ipNumber.trim()) {
      setPreviewError("먼저 번호를 입력해 주세요.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewErrorDetail(null);
    setPreview(null);
    try {
      const data =
        ipType === "TRADEMARK"
          ? await kiprisApi.getTrademarkDetail(ipNumber.trim())
          : await kiprisApi.getPatentDetail(ipNumber.trim());
      setPreview(data);
    } catch (err) {
      setPreviewError(err.message);
      setPreviewErrorDetail(err.detail || null);
    } finally {
      setPreviewLoading(false);
    }
  }

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

    const formData = new FormData();
    formData.append("ipType", ipType);
    formData.append("ipNumber", ipNumber.trim());
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
          <div className="form-group">
            <label htmlFor="ipNumber">
              관련 번호 <span className="hint">(출원/등록/공고번호, 선택)</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="ipNumber" type="text" value={ipNumber} onChange={(e) => setIpNumber(e.target.value)} />
              <button type="button" className="btn" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? "조회 중..." : "KIPRIS 조회"}
              </button>
            </div>
          </div>
        </div>

        {typeMismatch && (
          <div className="alert alert-error" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              입력하신 번호는 앞자리로 볼 때 <strong>{IP_TYPE_LABEL[detectedType]}</strong> 출원번호 형식으로
              보입니다. 구분이 다르면 조회에 실패할 수 있어요.
            </span>
            <button type="button" className="btn" onClick={() => setIpType(detectedType)}>
              구분을 {IP_TYPE_LABEL[detectedType]}(으)로 변경
            </button>
          </div>
        )}
        {!typeMismatch && unsupportedLabel && (
          <div className="alert alert-error">
            입력하신 번호는 {unsupportedLabel} 출원번호 형식으로 보입니다. 이 시스템은 특허·실용신안·상표만
            지원합니다.
          </div>
        )}

        {previewError && (
          <div className="alert alert-error">
            {previewError}
            {previewErrorDetail && (
              <details style={{ marginTop: 8 }}>
                <summary>KIPRIS 원본 오류 상세 (개발팀 문의 시 함께 전달해 주세요)</summary>
                <pre className="raw-json">{JSON.stringify(previewErrorDetail, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
        {preview && (
          <div className="card" style={{ background: "#fafbfc", marginBottom: 14 }}>
            <p className="meta-line">
              <strong>KIPRIS 조회 결과: </strong>
              {preview.title || preview.titleKor || "(명칭 정보 없음)"} / 출원번호 {preview.applicationNumber}
            </p>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="requesterName">문의자 이름 (선택)</label>
            <input id="requesterName" type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="requesterEmail">
              문의자 이메일 주소 <span className="hint">(필수, 답변 알림 발송)</span>
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
