import { useMemo, useState } from "react";
import { IP_TYPE_LABEL, kiprisApi } from "../api.js";
import { detectIpTypeFromNumber, detectUnsupportedTypeLabel } from "../ipNumber.js";

/**
 * 특허/실용신안/상표 번호를 여러 개 입력·조회할 수 있는 입력 목록.
 * 문의 1건에 여러 출원번호를 연결해야 하는 경우(예: 형제 상표 여러 건)를 위한 컴포넌트.
 */
export default function IpNumberFields({ ipType, numbers, onChange }) {
  function updateAt(index, value) {
    const next = [...numbers];
    next[index] = value;
    onChange(next);
  }

  function addRow() {
    onChange([...numbers, ""]);
  }

  function removeRow(index) {
    onChange(numbers.filter((_, i) => i !== index));
  }

  return (
    <div className="form-group">
      <label>
        관련 번호 <span className="hint">(출원/등록/공고번호, 여러 건이면 "번호 추가"로 늘려주세요, 선택)</span>
      </label>
      {numbers.map((number, index) => (
        <IpNumberRow
          key={index}
          ipType={ipType}
          number={number}
          onChangeNumber={(v) => updateAt(index, v)}
          onRemove={numbers.length > 1 ? () => removeRow(index) : null}
        />
      ))}
      <div>
        <button type="button" className="btn" onClick={addRow}>
          + 번호 추가
        </button>
      </div>
    </div>
  );
}

function IpNumberRow({ ipType, number, onChangeNumber, onRemove }) {
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewErrorDetail, setPreviewErrorDetail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const detectedType = useMemo(() => detectIpTypeFromNumber(number), [number]);
  const unsupportedLabel = useMemo(() => detectUnsupportedTypeLabel(number), [number]);
  const typeMismatch = detectedType && detectedType !== ipType;

  async function handlePreview() {
    if (!number.trim()) {
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
          ? await kiprisApi.getTrademarkDetail(number.trim())
          : await kiprisApi.getPatentDetail(number.trim());
      setPreview(data);
    } catch (err) {
      setPreviewError(err.message);
      setPreviewErrorDetail(err.detail || null);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px dashed var(--color-border)" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="text" value={number} onChange={(e) => onChangeNumber(e.target.value)} style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={handlePreview} disabled={previewLoading}>
          {previewLoading ? "조회 중..." : "KIPRIS 조회"}
        </button>
        {onRemove && (
          <button type="button" className="btn" onClick={onRemove}>
            삭제
          </button>
        )}
      </div>

      {typeMismatch && (
        <div className="alert alert-error" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>
            이 번호는 앞자리로 볼 때 <strong>{IP_TYPE_LABEL[detectedType]}</strong> 형식으로 보입니다. 구분이
            다르면 조회에 실패할 수 있어요.
          </span>
        </div>
      )}
      {!typeMismatch && unsupportedLabel && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          이 번호는 {unsupportedLabel} 번호 형식으로 보입니다. 특허·실용신안·상표만 지원합니다.
        </div>
      )}

      {previewError && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {previewError}
          {previewErrorDetail && (
            <details style={{ marginTop: 8 }}>
              <summary>KIPRIS 원본 오류 상세</summary>
              <pre className="raw-json">{JSON.stringify(previewErrorDetail, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      {preview && (
        <div className="card" style={{ background: "#fafbfc", marginTop: 8 }}>
          <p className="meta-line" style={{ margin: 0 }}>
            <strong>KIPRIS 조회 결과: </strong>
            {preview.title || preview.titleKor || "(명칭 정보 없음)"} / 출원번호 {preview.applicationNumber}
          </p>
        </div>
      )}
    </div>
  );
}
