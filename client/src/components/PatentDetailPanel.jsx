import { useEffect, useState } from "react";
import { kiprisApi } from "../api.js";

export default function PatentDetailPanel({ applicationNumber }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    kiprisApi
      .getPatentDetail(applicationNumber)
      .then((data) => !cancelled && setDetail(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applicationNumber]);

  if (loading) return <p className="text-muted">특허(실용신안) 상세 정보를 불러오는 중...</p>;
  if (error) return <p className="alert alert-error">{error}</p>;
  if (!detail) return null;

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{detail.title || "(명칭 정보 없음)"}</h3>

      <div className="detail-grid">
        <Field label="출원번호" value={detail.applicationNumber} />
        <Field label="출원일자" value={detail.applicationDate} />
        <Field label="공개번호" value={detail.openNumber} />
        <Field label="공개일자" value={detail.openDate} />
        <Field label="등록번호" value={detail.registerNumber} />
        <Field label="등록일자" value={detail.registerDate} />
        <Field label="법적상태" value={detail.registerStatus} />
        <Field label="IPC 분류" value={detail.ipcCodes?.join(", ")} />
      </div>

      <NameList label="출원인" items={detail.applicants} />
      <NameList label="발명자" items={detail.inventors} />
      <NameList label="대리인" items={detail.agents} />

      <div className="section-title">요약 (초록)</div>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
        {detail.abstract || "KIPRIS에 등록된 초록 정보가 없습니다."}
      </p>

      {detail.claims?.length > 0 && (
        <>
          <div className="section-title">대표 청구항</div>
          <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            {detail.claims.slice(0, 3).map((c, i) => (
              <li key={i} style={{ whiteSpace: "pre-wrap" }}>
                {c}
              </li>
            ))}
          </ol>
        </>
      )}

      {detail.kiprisViewUrl && (
        <p style={{ marginTop: 16 }}>
          <a href={detail.kiprisViewUrl} target="_blank" rel="noreferrer">
            KIPRIS에서 전문(원문) 보기 ↗
          </a>
        </p>
      )}

      <details>
        <summary>원본 응답 데이터 (개발/검증용)</summary>
        <pre className="raw-json">{JSON.stringify(detail.raw, null, 2)}</pre>
      </details>
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

function NameList({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <p className="meta-line">
      <strong>{label}: </strong>
      {items.join(", ")}
    </p>
  );
}
