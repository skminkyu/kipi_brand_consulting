import { useEffect, useState } from "react";
import { kiprisApi } from "../api.js";

export default function TrademarkDetailPanel({ applicationNumber }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    kiprisApi
      .getTrademarkDetail(applicationNumber)
      .then((data) => !cancelled && setDetail(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applicationNumber]);

  if (loading) return <p className="text-muted">상표 상세 정보를 불러오는 중...</p>;
  if (error) return <p className="alert alert-error">{error}</p>;
  if (!detail) return null;

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      {detail.limited && (
        <div className="alert alert-error" style={{ width: "100%" }}>
          {detail.limitedReason || "일부 정보만 확인 가능합니다."}
        </div>
      )}
      <div>
        {detail.markImageUrl ? (
          <img src={detail.markImageUrl} alt="상표 이미지" className="mark-image" />
        ) : (
          <div className="mark-image" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#98a2b3" }}>
            이미지 없음
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 260 }}>
        <h3 style={{ marginTop: 0 }}>{detail.titleKor || detail.titleEng || "(상표명 정보 없음)"}</h3>
        {detail.titleEng && detail.titleKor && <p className="meta-line">{detail.titleEng}</p>}

        <div className="detail-grid">
          <Field label="출원번호" value={detail.applicationNumber} />
          <Field label="출원일자" value={detail.applicationDate} />
          <Field label="등록번호" value={detail.registerNumber} />
          <Field label="등록일자" value={detail.registerDate} />
          <Field label="상태" value={detail.applicationStatus} />
        </div>

        {detail.applicants?.length > 0 && (
          <p className="meta-line">
            <strong>출원인: </strong>
            {detail.applicants.join(", ")}
          </p>
        )}

        <div className="section-title">지정상품 분류</div>
        {detail.classificationCodes?.length > 0 ? (
          <div>
            {detail.classificationCodes.map((code) => (
              <span key={code} className="chip">
                제{code}류
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted">분류 코드 정보가 없습니다.</p>
        )}

        {detail.designatedGoods?.length > 0 && (
          <>
            <div className="section-title">지정상품 목록</div>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {detail.designatedGoods.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </>
        )}

        {detail.legalStatusHistory?.length > 0 && (
          <>
            <div className="section-title">법적 상태 이력</div>
            <table>
              <thead>
                <tr>
                  <th>일자</th>
                  <th>상태</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {detail.legalStatusHistory.map((h, i) => (
                  <tr key={i}>
                    <td>{h.legalStatusDate || "-"}</td>
                    <td>{h.legalStatusName || "-"}</td>
                    <td>{h.legalStatusComment || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {detail.kiprisViewUrl && (
          <p style={{ marginTop: 16 }}>
            <a href={detail.kiprisViewUrl} target="_blank" rel="noreferrer">
              KIPRIS에서 원문 보기 ↗
            </a>
          </p>
        )}

        <details>
          <summary>원본 응답 데이터 (개발/검증용)</summary>
          <pre className="raw-json">{JSON.stringify(detail.raw, null, 2)}</pre>
        </details>
      </div>
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
