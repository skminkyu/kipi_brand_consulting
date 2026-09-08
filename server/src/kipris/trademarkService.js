const { callKipris, toArray } = require("./client");
const { pick } = require("./fieldPick");
const legalStatusService = require("./legalStatusService");

const SERVICE = "trademarkInfoSearchService";

// applicationNumberSearchInfo 명세상 "필수값"으로 명시된 것은 상태 플래그(8개)와
// 상표 형태 플래그(13개)뿐이다. 상표 종류 플래그(trademark/serviceMark 등 9개)는 각 유형의
// 내부 코드(-40, -41 등)만 안내되어 있고 필수 표시가 없어, 불필요한 파라미터로 오히려
// 거절당할 가능성을 줄이기 위해 보내지 않는다(필요 시 REQUIRED_FLAGS에 다시 추가).
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

// "번호" 한 칸에 출원/등록/공고번호 중 무엇을 넣어도 찾을 수 있도록,
// 사용자가 입력한 값을 3개 항목별검색 오퍼레이션에 각각 넣어 병렬로 조회한 뒤 합친다.
const NUMBER_SEARCH_OPERATIONS = [
  { operation: "applicationNumberSearchInfo", field: "applicationNumber" },
  { operation: "registerNumberSearchInfo", field: "registerNumber" },
  { operation: "publicationNumberSearchInfo", field: "publicationNumber" },
];

async function callNumberSearchOperation({ operation, field }, number, docsStart, docsCount) {
  try {
    const body = await callKipris(`${SERVICE}/${operation}`, {
      [field]: number,
      docsStart,
      docsCount,
      descSort: "false",
      sortSpec: "AD",
      ...REQUIRED_FLAGS,
    });
    return { results: toArray(body.items?.TradeMarkInfo).map(normalizeSearchItem) };
  } catch (err) {
    console.warn(`[trademarkService] ${operation} 조회 실패 (number=${number}):`, err.message);
    return { error: err };
  }
}

const LIMITED_INFO_NOTICE =
  "KIPRIS Plus에 국내 상표 정보검색서비스가 구매되어 있지 않아 상표명·이미지·지정상품 분류는 확인할 수 " +
  "없습니다. 대신 이용 중인 법적 상태 이력 서비스로 조회한 출원 진행 상태만 표시합니다.";

/** applicationNumberSearchInfo 등이 전부 실패했을 때, 별도로 이용 중일 수 있는
 * 법적 상태 이력 서비스로 최소한 "이 번호가 존재하는지 + 진행 상태"만이라도 확인한다. */
async function buildLimitedResultFromLegalStatus(number) {
  const history = await legalStatusService.getHistory(number);
  if (history.length === 0) return null;
  return {
    applicationNumber: history[0].applicationNumber || number,
    titleKor: "(상표명 정보 없음 - 법적 상태 이력만 조회 가능)",
    applicationStatus: history[history.length - 1]?.legalStatusName,
    applicants: [],
    agents: [],
    classificationCodes: [],
    designatedGoods: [],
    similarGroupCodes: [],
    limited: true,
    limitedReason: LIMITED_INFO_NOTICE,
    legalStatusHistory: history,
    kiprisViewUrl: `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(number)}`,
  };
}

/** 출원번호/등록번호/공고번호 중 어느 것이든 입력하면 상표를 검색한다. */
async function searchByNumber(number, { docsStart = 1, docsCount = 10 } = {}) {
  const outcomes = await Promise.all(
    NUMBER_SEARCH_OPERATIONS.map((op) => callNumberSearchOperation(op, number, docsStart, docsCount))
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

  const merged = outcomes.flatMap((o) => o.results || []);
  const seen = new Set();
  return merged.filter((item) => {
    if (!item.applicationNumber || seen.has(item.applicationNumber)) return false;
    seen.add(item.applicationNumber);
    return true;
  });
}

/** 상표 명칭(단어)으로 검색한다. (KIPRIS상 폐기예정 오퍼레이션 - 대체 API 미확인) */
async function searchByName(word, { numOfRows = 10, pageNo = 1 } = {}) {
  const body = await callKipris(`${SERVICE}/getWordSearch`, {
    articleName: word,
    numOfRows,
    pageNo,
  });
  const items = toArray(body.items?.item);
  return items.map(normalizeSearchItem);
}

/** 출원번호로 상표 상세(이미지, 지정상품 분류 등)를 조회한다. */
async function getDetail(applicationNumber) {
  try {
    const body = await callKipris(`${SERVICE}/getBibliographyDetailInfoSearch`, { applicationNumber });
    const items = toArray(body.item ?? body.items?.item);
    if (items.length === 0) return null;
    return normalizeDetailItem(items[0]);
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

module.exports = { searchByNumber, searchByName, getDetail };
