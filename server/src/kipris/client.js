const { XMLParser } = require("fast-xml-parser");

const BASE_URL = (process.env.KIPRIS_BASE_URL || "https://plus.kipris.or.kr/kipo-api/kipi").replace(/\/$/, "");
const ACCESS_KEY = process.env.KIPRIS_API_KEY || "";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  // 출원번호(resultCode "00" 등)는 식별자이지 숫자가 아니므로 자동 숫자 변환을 끈다.
  // (끄지 않으면 "00" -> 0 으로 변환되어 성공 응답을 오류로 오판하는 버그가 생긴다)
  parseTagValue: false,
});

/**
 * KIPRIS Plus OpenAPI 는 서비스별로 REST 경로 아래 파라미터를 붙이는 방식이며,
 * 응답은 XML(response > header/body) 형태로 내려온다.
 * 정확한 서비스 경로/필드명은 https://plus.kipris.or.kr 포털의 서비스별 명세서를 따른다.
 * (서비스명 오탈자 "patUtiModInfoSearchSevice" 는 KIPRIS 측 실제 API 경로 그대로임)
 */
async function callKipris(servicePath, params = {}) {
  if (!ACCESS_KEY) {
    throw new KiprisError("KIPRIS_API_KEY 가 설정되지 않았습니다. server/.env 파일을 확인하세요.", "NO_API_KEY");
  }

  const query = new URLSearchParams({ ...params, accessKey: ACCESS_KEY });
  const url = `${BASE_URL}/${servicePath}?${query.toString()}`;

  let res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (err) {
    throw new KiprisError(`KIPRIS API 호출에 실패했습니다: ${err.message}`, "NETWORK_ERROR");
  }

  const text = await res.text();

  if (!res.ok) {
    throw new KiprisError(`KIPRIS API 가 오류를 반환했습니다 (HTTP ${res.status}).`, "HTTP_ERROR", text);
  }

  let parsed;
  try {
    parsed = parser.parse(text);
  } catch (err) {
    throw new KiprisError("KIPRIS 응답(XML)을 해석할 수 없습니다.", "PARSE_ERROR", text);
  }

  const response = parsed.response;
  if (!response) {
    throw new KiprisError("KIPRIS 응답 형식이 예상과 다릅니다.", "UNEXPECTED_FORMAT", text);
  }

  const header = response.header || {};
  const successYN = String(header.successYN || "").toUpperCase();
  const resultCode = String(header.resultCode ?? "");

  if (successYN === "N" || (resultCode && resultCode !== "00")) {
    throw new KiprisError(
      header.resultMsg || "KIPRIS API 조회에 실패했습니다.",
      "API_ERROR",
      header
    );
  }

  return response.body || {};
}

/** items.item 이 1개면 객체로, 여러 개면 배열로 파싱되는 fast-xml-parser 특성을 배열로 통일 */
function toArray(val) {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

class KiprisError extends Error {
  constructor(message, code, detail) {
    super(message);
    this.name = "KiprisError";
    this.code = code;
    this.detail = detail;
  }
}

module.exports = { callKipris, toArray, KiprisError };
