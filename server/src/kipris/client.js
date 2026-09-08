const { XMLParser } = require("fast-xml-parser");

// KIPRIS Plus는 서비스마다 서로 다른 게이트웨이/경로를 쓴다.
//  - KIPO_BASE_URL (/kipo-api/kipi/...): 서지상세조회, 상표 항목별검색 등 (ServiceKey)
//  - REST_BASE_URL (/openapi/rest/...): 특허·실용신안 출원번호 검색 등 구버전 게이트웨이 (accessKey)
// 정확한 파라미터명이 서비스마다 달라 accessKey/ServiceKey를 항상 함께 보낸다.
const KIPO_BASE_URL = (process.env.KIPRIS_BASE_URL || "https://plus.kipris.or.kr/kipo-api/kipi").replace(/\/$/, "");
const REST_BASE_URL = (process.env.KIPRIS_REST_BASE_URL || "https://plus.kipris.or.kr/openapi/rest").replace(
  /\/$/,
  ""
);
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
async function callKipris(servicePath, params = {}, { base = "kipo" } = {}) {
  if (!ACCESS_KEY) {
    throw new KiprisError("KIPRIS_API_KEY 가 설정되지 않았습니다. server/.env 파일을 확인하세요.", "NO_API_KEY");
  }

  const baseUrl = base === "rest" ? REST_BASE_URL : KIPO_BASE_URL;

  // 서비스별로 accessKey/ServiceKey 중 무엇을 쓰는지 달라 두 파라미터명을 함께 보낸다
  // (인식하지 못하는 파라미터는 대부분 무시된다).
  const query = new URLSearchParams({
    ...params,
    accessKey: ACCESS_KEY,
    ServiceKey: ACCESS_KEY,
  });
  const url = `${baseUrl}/${servicePath}?${query.toString()}`;

  let res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (err) {
    throw new KiprisError(`KIPRIS API 호출에 실패했습니다: ${err.message}`, "NETWORK_ERROR");
  }

  const text = await res.text();

  if (!res.ok) {
    throw new KiprisError(`KIPRIS API 가 오류를 반환했습니다 (HTTP ${res.status}).`, "HTTP_ERROR", text.slice(0, 500));
  }

  let parsed;
  try {
    parsed = parser.parse(text);
  } catch (err) {
    throw new KiprisError("KIPRIS 응답(XML)을 해석할 수 없습니다.", "PARSE_ERROR", text.slice(0, 500));
  }

  const response = parsed.response;
  if (!response) {
    // response>header 형식이 아니면(OpenAPI_ServiceResponse 등 공공데이터포털 공통 오류 포맷일 수 있음)
    // 원본 XML을 그대로 노출해 원인 파악이 가능하도록 한다.
    console.error(`[kipris] 예상과 다른 응답 형식 (servicePath=${servicePath}):`, text.slice(0, 1000));
    throw new KiprisError("KIPRIS 응답 형식이 예상과 다릅니다.", "UNEXPECTED_FORMAT", text.slice(0, 500));
  }

  const header = response.header || {};
  const successYN = String(header.successYN || "").toUpperCase();
  const resultCode = String(header.resultCode ?? "");

  if (successYN === "N" || (resultCode && resultCode !== "00")) {
    console.error(`[kipris] API 오류 응답 (servicePath=${servicePath}, resultCode=${resultCode}):`, header);
    const rawMsg = header.resultMsg || "KIPRIS API 조회에 실패했습니다.";
    const messageWithCode = resultCode ? `[${resultCode}] ${rawMsg}` : rawMsg;
    throw new KiprisError(friendlyKiprisMessage(messageWithCode, rawMsg), "API_ERROR", header);
  }

  return response.body || {};
}

// KIPRIS가 영문 코드성 메시지를 그대로 내려주는 경우가 많아, 담당자가 바로 이해할 수 있도록
// 자주 나오는 코드에 한글 설명을 덧붙인다. 매핑에 없는 메시지는 원문 그대로 노출한다.
const FRIENDLY_MESSAGE_SUFFIX = {
  INVALID_REQUEST_PARAMETER_ERROR:
    " (요청 파라미터가 잘못되었습니다 — 번호 형식/구분을 다시 확인해 주세요. 계속되면 개발팀에 문의해 주세요.)",
  NO_MANDATORY_REQUEST_PARAMETERS_ERROR: " (필수 입력값이 누락되었습니다. 번호를 입력했는지 확인해 주세요.)",
  SERVICE_KEY_IS_NOT_REGISTERED_ERROR: " (KIPRIS 인증키가 등록되지 않았거나 잘못되었습니다.)",
  ACCESS_KEY_NOT_REGISTERED: " (KIPRIS 인증키가 등록되지 않았거나 잘못되었습니다.)",
  DEADLINE_EXPIRED: " (KIPRIS 인증키의 해당 서비스 이용기간이 만료되었습니다. KIPRIS Plus 포털에서 재신청이 필요합니다.)",
  APPLICATION_ERROR: " (해당 번호로 등록된 정보를 찾을 수 없습니다.)",
};

function friendlyKiprisMessage(displayMsg, rawMsg) {
  const suffix = FRIENDLY_MESSAGE_SUFFIX[String(rawMsg).trim()];
  return suffix ? `${displayMsg}${suffix}` : displayMsg;
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
