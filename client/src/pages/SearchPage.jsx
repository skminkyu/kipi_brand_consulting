import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IP_TYPE_LABEL, kiprisApi } from "../api.js";
import { detectIpTypeFromNumber, detectUnsupportedTypeLabel } from "../ipNumber.js";
import PatentDetailPanel from "../components/PatentDetailPanel.jsx";
import TrademarkDetailPanel from "../components/TrademarkDetailPanel.jsx";

export default function SearchPage() {
  const [type, setType] = useState("PATENT");
  const [number, setNumber] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openApplicationNumber, setOpenApplicationNumber] = useState(null);

  const detectedType = useMemo(() => detectIpTypeFromNumber(number), [number]);
  const unsupportedLabel = useMemo(() => detectUnsupportedTypeLabel(number), [number]);
  const typeMismatch = detectedType && detectedType !== type;

  async function handleSearch(e) {
    e.preventDefault();
    if (!number.trim()) {
      setError("특허/출원/등록/공고 번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setErrorDetail(null);
    setResults(null);
    setOpenApplicationNumber(null);
    try {
      const data = await kiprisApi.search(type, { number: number.trim() });
      setResults(data.results);
    } catch (err) {
      setError(err.message);
      setErrorDetail(err.detail || null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">KIPRIS 특허·상표·실용신안 검색</h1>
      <p className="page-desc">
        출원번호, 등록번호, 공개(공고)번호 등을 입력해 KIPRIS에 등록된 특허·실용신안·상표 정보를 조회합니다.
        특허/실용신안은 번호를 클릭하면 전문 내용과 요약을, 상표는 명칭을 클릭하면 상표 이미지와 지정상품
        분류를 확인할 수 있습니다.
      </p>

      <form className="card" onSubmit={handleSearch}>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 180 }}>
            <label htmlFor="type">구분</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PATENT">특허</option>
              <option value="UTILITY">실용신안</option>
              <option value="TRADEMARK">상표</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="number">
              번호 <span className="hint">(출원번호/등록번호/공개·공고번호)</span>
            </label>
            <input
              id="number"
              type="text"
              placeholder="예: 1020230012345"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
        </div>

        {typeMismatch && (
          <div className="alert alert-error" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              입력하신 번호는 앞자리로 볼 때 <strong>{IP_TYPE_LABEL[detectedType]}</strong> 출원번호 형식으로
              보입니다. 구분이 다르면 조회에 실패할 수 있어요.
            </span>
            <button type="button" className="btn" onClick={() => setType(detectedType)}>
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

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "검색 중..." : "검색"}
        </button>
      </form>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          {error}
          {errorDetail && (
            <details style={{ marginTop: 8 }}>
              <summary>KIPRIS 원본 오류 상세 (개발팀 문의 시 함께 전달해 주세요)</summary>
              <pre className="raw-json">{JSON.stringify(errorDetail, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {results && (
        <div style={{ marginTop: 20 }}>
          <p className="text-muted">총 {results.length}건 조회됨</p>
          {results.length === 0 && <div className="empty-state">조회 결과가 없습니다.</div>}

          {results.map((item) => {
            const appNo = item.applicationNumber;
            const isOpen = openApplicationNumber === appNo;
            const displayName = type === "TRADEMARK" ? item.titleKor || item.titleEng : item.title;

            return (
              <div className="result-item" key={appNo}>
                <h4>
                  <button type="button" onClick={() => setOpenApplicationNumber(isOpen ? null : appNo)}>
                    {displayName || appNo || "(명칭 없음)"}
                  </button>
                  <span className="badge badge-type" style={{ marginLeft: 8 }}>
                    {IP_TYPE_LABEL[type]}
                  </span>
                </h4>
                <p className="meta-line">출원번호: {appNo || "-"}</p>
                <p className="meta-line">출원일자: {item.applicationDate || "-"}</p>

                {isOpen && (
                  <div className="card" style={{ marginTop: 12, background: "#fafbfc" }}>
                    {type === "TRADEMARK" ? (
                      <TrademarkDetailPanel applicationNumber={appNo} />
                    ) : (
                      <PatentDetailPanel applicationNumber={appNo} />
                    )}
                    <p style={{ marginTop: 16 }}>
                      <Link
                        className="btn"
                        to={`/inquiries/new?ipType=${type}&ipNumber=${encodeURIComponent(appNo)}`}
                      >
                        이 건에 대해 컴플라이언스팀에 문의하기
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
