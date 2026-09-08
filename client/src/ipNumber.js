// 출원/등록/공개번호 앞 2자리로 특허청 권리 구분을 추정한다.
// 10: 특허, 20: 실용신안, 30: 디자인, 40/41: 상표
const PREFIX_TYPE_MAP = {
  10: "PATENT",
  20: "UTILITY",
  40: "TRADEMARK",
  41: "TRADEMARK",
};

const PREFIX_LABEL_FOR_UNSUPPORTED = {
  30: "디자인",
};

/** 번호에서 하이픈/공백을 제거하고 앞 2자리로 구분을 추정. 확실하지 않으면 null. */
export function detectIpTypeFromNumber(rawNumber) {
  const digits = String(rawNumber || "").replace(/[^0-9]/g, "");
  if (digits.length < 2) return null;
  const prefix = Number(digits.slice(0, 2));
  return PREFIX_TYPE_MAP[prefix] || null;
}

export function detectUnsupportedTypeLabel(rawNumber) {
  const digits = String(rawNumber || "").replace(/[^0-9]/g, "");
  if (digits.length < 2) return null;
  const prefix = Number(digits.slice(0, 2));
  return PREFIX_LABEL_FOR_UNSUPPORTED[prefix] || null;
}
