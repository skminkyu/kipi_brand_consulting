const { callKipris, toArray } = require("./client");
const { pick } = require("./fieldPick");
const legalStatusService = require("./legalStatusService");
const trademarkAdminHistoryService = require("./trademarkAdminHistoryService");

const SERVICE = "trademarkInfoSearchService";

// 상태 플래그(8개)·상표 형태 플래그(13개)에 더해, 상표 "종류" 플래그(trademark/serviceMark 등
// 9개)도 명세상 항목별검색 전체(등록번호/공고번호/상표명/출원인명/등록권자명 검색 포함)에 필수값으로
// 표시되어 있다. applicationNumberSearchInfo는 이게 없어도 동작했지만, 실사용 확인 결과 나머지
// 오퍼레이션(등록번호 등)은 이 9개가 없으면 전부 INVALID_REQUEST_PARAMETER_ERROR로 거절되어
// 전부 포함(true)하도록 되돌렸다.
const REQUIRED_FLAGS = {
  application: "true",
  registration: "true",
  refused: "true",
  expiration: "true",
  withdrawal: "true",
  publication: "true",
  cancel: "true",
  abandonment: "true",
  character: "true",
  figure: "true",
  compositionCharacter: "true",
  figureComposition: "true",
  sound: "true",
  fragrance: "true",
  color: "true",
  dimension: "true",
  colorMixed: "true",
  hologram: "true",
  motion: "true",
  visual: "true",
  invisible: "true",
  trademark: "true",
  serviceMark: "true",
  trademarkServiceMark: "true",
  businessEmblem: "true",
  collectiveMark: "true",
  geoOrgMark: "true",
  internationalMark: "true",
  certMark: "true",
  geoCertMark: "true",
};

/** applicationNumberSearchInfo 응답 - PascalCase, 평탄한 구조 (items.TradeMarkInfo) */
function normalizeSearchItem(item) {
  const applicationNumber = pick(item, ["ApplicationNumber"]);
  return {
    applicationNumber,
    applicationDate: pick(item, ["ApplicationDate"]),
    publicationNumber: pick(item, ["PublicNumber"]),
    publicationDate: pick(item, ["PublicDate"]),
    registerNumber: pick(item, ["RegistrationNumber"]),
    registerDate: pick(item, ["RegistrationDate"]),
    titleKor: pick(item, ["Title"]),
    applicationStatus: pick(item, ["ApplicationStatus"]),
    applicants: String(pick(item, ["ApplicantName"]) || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    agents: String(pick(item, ["AgentName"]) || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    classificationCodes: String(pick(item, ["GoodClassificationCode"]) || "")
      .split(/[,\s]+/)
      .filter(Boolean),
    designatedGoods: [],
    similarGroupCodes: String(pick(item, ["ViennaCode"]) || "")
      .split(/[,\s]+/)
      .filter(Boolean),
    markImageUrl: pick(item, ["ImagePath", "ThumbnailPath"]),
    kiprisViewUrl: applicationNumber
      ? `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(applicationNumber)}`
      : undefined,
    raw: item,
  };
}

/** getBibliographyDetailInfoSearch 응답 - camelCase, 중첩 배열 구조 (body.item) */
function normalizeDetailItem(item) {
  const biblio = item.biblioSummaryInfoArray?.biblioSummaryInfo || item;
  const goodsList = toArray(item.asignProductArray?.asignProduct);
  const applicantList = toArray(item.applicantInfoArray?.applicantInfo);
  const agentList = toArray(item.agentInfoArray?.agentInfo);
  const imageList = toArray(item.sampleImageInfoArray?.sampleImageInfo);

  const applicationNumber = pick(biblio, ["applicationNumber"]);

  return {
    applicationNumber,
    applicationDate: pick(biblio, ["applicationDate"]),
    publicationNumber: pick(biblio, ["publicationNumber"]),
    publicationDate: pick(biblio, ["publicationDate"]),
    registerNumber: pick(biblio, ["registerNumber", "registrationNumber"]),
    registerDate: pick(biblio, ["registerDate", "registrationDate"]),
    // KIPRIS 명세상 서지상세정보 응답에는 상표 "명칭" 전용 필드가 별도로 없어(productName은
    // 지정상품 관련 필드 재사용), 검색 API의 Title 필드가 더 정확할 수 있다. 값이 없으면
    // 화면에서 출원번호로 대체 표시한다.
    titleKor: pick(biblio, ["productName", "title"]),
    titleEng: pick(biblio, ["productNameEng", "titleEng"]),
    applicationStatus: pick(biblio, ["registerStatus"]),
    applicants: applicantList.map((a) => pick(a, ["nameKoreanLong", "name"])).filter(Boolean),
    agents: agentList.map((a) => pick(a, ["nameKoreanLong", "name"])).filter(Boolean),
    classificationCodes: [...new Set(goodsList.map((g) => pick(g, ["mainCode"])).filter(Boolean))],
    designatedGoods: goodsList.map((g) => pick(g, ["productName"])).filter(Boolean),
    similarGroupCodes: [...new Set(goodsList.map((g) => pick(g, ["subCode"])).filter(Boolean))],
    markImageUrl: pick(imageList[0], ["path", "smallPath"]),
    kiprisViewUrl: applicationNumber
      ? `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(applicationNumber)}`
      : undefined,
    raw: item,
  };
}

// KIPRIS는 등록번호를 "구분(2)+일련번호(7)+갱신차수(4, 최초등록은 0000)" 13자리 정형 포맷으로
// 요구한다(공보에 표기되는 "40-1529497"은 9자리 표시용 축약형). 9자리로 입력되면 뒤에 0000을
// 붙여 13자리로 맞춘다 - 이미 13자리(갱신 차수 포함)로 입력된 경우는 그대로 둔다.
function formatRegisterNumber(raw) {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  return digits.length === 9 ? `${digits}0000` : digits;
}

// "번호" 한 칸에 출원/등록/공고번호 중 무엇을 넣어도 찾을 수 있도록,
// 사용자가 입력한 값을 3개 항목별검색 오퍼레이션에 각각 넣어 병렬로 조회한 뒤 합친다.
const NUMBER_SEARCH_OPERATIONS = [
  { operation: "applicationNumberSearchInfo", field: "applicationNumber" },
  { operation: "registerNumberSearchInfo", field: "registerNumber", transform: formatRegisterNumber },
  { operation: "publicationNumberSearchInfo", field: "publicationNumber" },
];

/** getWordSearch 응답 - camelCase, 평탄한 구조 (items.item). KIPRIS Plus 상품 상세페이지에서
 * 직접 확인한 공식 요청 URL 샘플(searchString=롯데&searchRecentYear=0)을 기준으로 작성했다 -
 * "폐기예정"으로 표시되어 있지만, 항목별검색(등록번호/상표명/출원인명 등)이 전부 미검증 추측이라
 * 실패했던 것과 달리 이 응답 스키마는 KIPRIS 공식 샘플로 확인된 값이다. */
function normalizeWordSearchItem(item) {
  const applicationNumber = pick(item, ["applicationNumber"]);
  return {
    applicationNumber,
    applicationDate: pick(item, ["applicationDate"]),
    publicationNumber: pick(item, ["publicationNumber"]),
    publicationDate: pick(item, ["publicationDate"]),
    registerNumber: pick(item, ["registrationNumber"]),
    registerDate: pick(item, ["registrationDate"]),
    titleKor: pick(item, ["title"]),
    applicationStatus: pick(item, ["applicationStatus"]),
    applicants: String(pick(item, ["applicantName"]) || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    agents: String(pick(item, ["agentName"]) || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    classificationCodes: String(pick(item, ["classificationCode"]) || "")
      .split(/[,\s]+/)
      .filter(Boolean),
    designatedGoods: [],
    similarGroupCodes: String(pick(item, ["viennaCode"]) || "")
      .split(/[,\s]+/)
      .filter(Boolean),
    markImageUrl: pick(item, ["bigDrawing", "drawing"]),
    kiprisViewUrl: applicationNumber
      ? `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(applicationNumber)}`
      : undefined,
    raw: item,
  };
}

async function callFieldSearchOperation({ operation, field, transform }, rawValue, docsStart, docsCount) {
  const value = transform ? transform(rawValue) : rawValue;
  try {
    const body = await callKipris(`${SERVICE}/${operation}`, {
      [field]: value,
      docsStart,
      docsCount,
      descSort: "false",
      sortSpec: "AD",
      ...REQUIRED_FLAGS,
    });
    return { results: toArray(body.items?.TradeMarkInfo).map(normalizeSearchItem) };
  } catch (err) {
    console.warn(`[trademarkService] ${operation} 조회 실패 (value=${value}):`, err.message);
    return { error: err };
  }
}

function dedupeByApplicationNumber(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.applicationNumber || seen.has(item.applicationNumber)) return false;
    seen.add(item.applicationNumber);
    return true;
  });
}

// 실사용 확인 결과: "출원"(아직 출원공고 전) 상태의 상표는 KIPRIS가 상세 서지정보를 API로
// 내려주지 않고, "공고"·"등록" 상태가 되어야 정상 조회된다(특허의 출원공개 전 비공개와 유사한
// 정책으로 추정). 인접 출원번호로 실제 확인됨 - 하나는 출원 상태(조회 불가), 하나는 공고
// 상태(정상 조회)였음. 구매 상품 문제가 아니라 이 데이터 자체가 아직 공개되지 않은 것이다.
const PRE_PUBLICATION_NOTICE =
  "이 상표는 아직 '출원' 상태로 출원공고 전이라, KIPRIS가 상세 서지정보(상표명·이미지·지정상품 분류)를 " +
  "공개하지 않습니다. 출원공고 또는 등록 이후 다시 조회하면 확인할 수 있습니다. (아래는 법적 상태 이력만 표시)";
const GENERIC_LIMITED_NOTICE =
  "상표명·이미지·지정상품 분류를 조회할 수 없어, 법적 상태 이력만 대신 표시합니다. 출원공고 전 상태이거나 " +
  "KIPRIS Plus에 국내 상표 정보검색서비스가 구매되어 있지 않은 경우일 수 있습니다.";

/** 상표 행정처리 이력(RelatedDocsonfileTMService, KIPRIS Plus 추가 구매 상품)을 best-effort로
 * 조회한다. 실패해도 다른 정보(서지상세/법적 상태 이력)는 계속 보여줘야 하므로 예외를 삼킨다. */
async function fetchAdminHistorySafe(applicationNumber) {
  try {
    return await trademarkAdminHistoryService.getHistory(applicationNumber);
  } catch (err) {
    console.warn(`[trademarkService] 행정처리 이력 조회 실패 (number=${applicationNumber}):`, err.message);
    return [];
  }
}

/** applicationNumberSearchInfo 등이 전부 실패했을 때, 별도로 구매/이용 중일 수 있는
 * 행정처리 이력·법적 상태 이력 서비스로 최소한 "이 번호가 존재하는지 + 진행 상태"만이라도 확인한다. */
async function buildLimitedResultFromLegalStatus(number) {
  const [adminHistory, legalHistory] = await Promise.all([
    fetchAdminHistorySafe(number),
    legalStatusService.getHistory(number).catch((err) => {
      console.warn(`[trademarkService] 법적 상태 이력 조회 실패 (number=${number}):`, err.message);
      return [];
    }),
  ]);
  if (adminHistory.length === 0 && legalHistory.length === 0) return null;

  const latestStatus =
    legalHistory[legalHistory.length - 1]?.legalStatusName ||
    adminHistory[adminHistory.length - 1]?.status ||
    "";
  const isPrePublication = latestStatus.includes("출원") && !/공고|등록/.test(latestStatus);

  return {
    applicationNumber: legalHistory[0]?.applicationNumber || adminHistory[0]?.applicationNumber || number,
    titleKor: "(상표명 정보 없음 - 행정처리/법적 상태 이력만 조회 가능)",
    applicationStatus: latestStatus,
    applicants: [],
    agents: [],
    classificationCodes: [],
    designatedGoods: [],
    similarGroupCodes: [],
    limited: true,
    limitedReason: isPrePublication ? PRE_PUBLICATION_NOTICE : GENERIC_LIMITED_NOTICE,
    legalStatusHistory: legalHistory,
    adminHistory,
    kiprisViewUrl: `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(number)}`,
  };
}

/** 출원번호/등록번호/공고번호 중 어느 것이든 입력하면 상표를 검색한다. */
async function searchByNumber(number, { docsStart = 1, docsCount = 10 } = {}) {
  const outcomes = await Promise.all(
    NUMBER_SEARCH_OPERATIONS.map((op) => callFieldSearchOperation(op, number, docsStart, docsCount))
  );

  if (outcomes.every((o) => o.error)) {
    try {
      const limited = await buildLimitedResultFromLegalStatus(number);
      if (limited) return [limited];
    } catch (err) {
      console.warn(`[trademarkService] 법적 상태 이력 대체 조회도 실패 (number=${number}):`, err.message);
    }
    throw outcomes[0].error;
  }

  return dedupeByApplicationNumber(outcomes.flatMap((o) => o.results || []));
}

/** 상표명(국문/영문) 또는 출원인·등록권자(상표권자) 명칭으로 검색한다. KIPRIS Plus 상품 상세
 * 페이지에서 공식 확인한 getWordSearch(searchString)를 사용한다 - "폐기예정" 표시가 있지만
 * 현재로선 공식 샘플로 검증된 유일한 상표 키워드 검색 오퍼레이션이다. */
async function searchByKeyword(word, { searchRecentYear = 0, numOfRows = 10, pageNo = 1 } = {}) {
  const body = await callKipris(`${SERVICE}/getWordSearch`, {
    searchString: word,
    searchRecentYear,
    numOfRows,
    pageNo,
  });
  return toArray(body.items?.item).map(normalizeWordSearchItem);
}

/** 출원번호로 상표 상세(이미지, 지정상품 분류 등)를 조회한다. */
async function getDetail(applicationNumber) {
  try {
    const body = await callKipris(`${SERVICE}/getBibliographyDetailInfoSearch`, { applicationNumber });
    const items = toArray(body.item ?? body.items?.item);
    if (items.length === 0) return null;
    const detail = normalizeDetailItem(items[0]);
    detail.adminHistory = await fetchAdminHistorySafe(applicationNumber);
    return detail;
  } catch (err) {
    try {
      const limited = await buildLimitedResultFromLegalStatus(applicationNumber);
      if (limited) return limited;
    } catch (fallbackErr) {
      console.warn(`[trademarkService] 법적 상태 이력 대체 조회도 실패 (number=${applicationNumber}):`, fallbackErr.message);
    }
    throw err;
  }
}

module.exports = { searchByNumber, searchByKeyword, getDetail };
