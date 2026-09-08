const { callKipris, toArray } = require("./client");
const { pick } = require("./fieldPick");

const SERVICE = "patUtiModInfoSearchSevice";

// 특허/실용신안 모든 법적상태(공개/취하/소멸/포기/무효/거절/등록)를 포함해 검색하기 위한 공통 파라미터.
// KIPRIS 문서상 lastvalue를 빈 값으로 두면 "전체"를 의미한다.
const COMMON_SEARCH_PARAMS = {
  patent: "true",
  utility: "true",
  lastvalue: "",
  descSort: "false",
  sortSpec: "AD",
};

/** 서지상세정보(getBibliographyDetailInfoSearch) 응답 - camelCase, 중첩 배열 구조 */
function normalizeDetailItem(item) {
  const biblio = item.biblioSummaryInfoArray?.biblioSummaryInfo || item;
  const abstractInfo = toArray(item.abstractInfoArray?.abstractInfo)[0];
  const ipcList = toArray(item.ipcInfoArray?.ipcInfo);
  const applicantList = toArray(item.applicantInfoArray?.applicantInfo);
  const inventorList = toArray(item.inventorInfoArray?.inventorInfo);
  const agentList = toArray(item.agentInfoArray?.agentInfo);
  const claimList = toArray(item.claimInfoArray?.claimInfo);
  const legalStatusList = toArray(item.legalStatusInfoArray?.legalStatusInfo);
  const imageList = toArray(item.imagePathInfoArray?.imagePathInfo);

  const applicationNumber = pick(biblio, ["applicationNumber", "applicationNumberValue"]);

  return {
    applicationNumber,
    applicationDate: pick(biblio, ["applicationDate"]),
    openNumber: pick(biblio, ["openNumber", "publicationNumber"]),
    openDate: pick(biblio, ["openDate", "publicationDate"]),
    registerNumber: pick(biblio, ["registerNumber", "registrationNumber"]),
    registerDate: pick(biblio, ["registerDate", "registrationDate"]),
    title: pick(biblio, ["inventionTitle", "articleName", "title"]),
    registerStatus: pick(biblio, ["registerStatus", "legalStatusDescription", "finalDisposal"]),
    ipcCodes: ipcList.map((i) => pick(i, ["ipcNumber", "ipcCode"])).filter(Boolean),
    applicants: applicantList.map((a) => pick(a, ["name"])).filter(Boolean),
    inventors: inventorList.map((a) => pick(a, ["name"])).filter(Boolean),
    agents: agentList.map((a) => pick(a, ["name"])).filter(Boolean),
    abstract: pick(abstractInfo, ["astrtCont", "abstractTextKor", "abstract"]),
    claims: claimList.map((c) => pick(c, ["claim", "claimContent"])).filter(Boolean),
    legalStatusHistory: legalStatusList.map((l) => ({
      status: pick(l, ["commonCodeName", "status"]),
      date: pick(l, ["receiptDate", "date"]),
    })),
    representativeImageUrl: pick(imageList[0], ["path", "imagePath"]),
    kiprisViewUrl: applicationNumber
      ? `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(applicationNumber)}`
      : undefined,
    raw: item,
  };
}

/** 출원번호검색/자유검색(applicationNumberSearchInfo, freeSearchInfo) 응답 - PascalCase, 평탄한 구조 */
function normalizeSearchItem(item) {
  const applicationNumber = pick(item, ["ApplicationNumber"]);
  return {
    applicationNumber,
    applicationDate: pick(item, ["ApplicationDate"]),
    openNumber: pick(item, ["OpeningNumber"]),
    openDate: pick(item, ["OpeningDate"]),
    publicNumber: pick(item, ["PublicNumber"]),
    publicDate: pick(item, ["PublicDate"]),
    registerNumber: pick(item, ["RegistrationNumber"]),
    registerDate: pick(item, ["RegistrationDate"]),
    title: pick(item, ["InventionName"]),
    registerStatus: pick(item, ["RegistrationStatus"]),
    ipcCodes: String(pick(item, ["InternationalpatentclassificationNumber"]) || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    applicants: String(pick(item, ["Applicant"]) || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    abstract: pick(item, ["Abstract"]),
    representativeImageUrl: pick(item, ["DrawingPath", "ThumbnailPath"]),
    kiprisViewUrl: applicationNumber
      ? `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(applicationNumber)}`
      : undefined,
    raw: item,
  };
}

// "번호" 한 칸에 출원/등록/공개/공고번호 중 무엇을 넣어도 찾을 수 있도록,
// 사용자가 입력한 값을 4개 항목별검색 오퍼레이션에 각각 넣어 병렬로 조회한 뒤 합친다.
const NUMBER_SEARCH_OPERATIONS = [
  { operation: "applicationNumberSearchInfo", field: "applicationNumber" },
  { operation: "registrationNumberSearchInfo", field: "registerNumber" },
  { operation: "openNumberSearchInfo", field: "openNumber" },
  { operation: "publicationNumberSearchInfo", field: "publicationNumber" },
];

async function callNumberSearchOperation({ operation, field }, number, docsStart, docsCount) {
  try {
    const body = await callKipris(
      `${SERVICE}/${operation}`,
      { [field]: number, docsStart, docsCount, ...COMMON_SEARCH_PARAMS },
      { base: "rest", keyParam: "accessKey" }
    );
    return { results: toArray(body.items?.PatentUtilityInfo).map(normalizeSearchItem) };
  } catch (err) {
    console.warn(`[patentService] ${operation} 조회 실패 (number=${number}):`, err.message);
    return { error: err };
  }
}

/** 출원번호/등록번호/공개번호/공고번호 중 어느 것이든 입력하면 특허·실용신안을 검색한다. */
async function searchByNumber(number, { docsStart = 1, docsCount = 10 } = {}) {
  const outcomes = await Promise.all(
    NUMBER_SEARCH_OPERATIONS.map((op) => callNumberSearchOperation(op, number, docsStart, docsCount))
  );

  // 4개 오퍼레이션이 전부 오류(결과 없음이 아니라 진짜 오류)라면 조용히 빈 배열을 주는 대신
  // 원인을 그대로 알려준다. 하나라도 성공했다면 그 결과를 사용한다.
  if (outcomes.every((o) => o.error)) {
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

/** 자유검색(발명의 명칭, 키워드 등)으로 특허·실용신안을 검색한다. */
async function searchByKeyword(word, { docsStart = 1, docsCount = 10 } = {}) {
  const body = await callKipris(
    `${SERVICE}/freeSearchInfo`,
    { word, docsStart, docsCount, ...COMMON_SEARCH_PARAMS },
    { base: "rest", keyParam: "accessKey" }
  );
  const items = toArray(body.items?.PatentUtilityInfo);
  return items.map(normalizeSearchItem);
}

/** 출원번호로 서지상세정보(요약/청구항/전문 관련 정보 포함)를 조회한다. */
async function getDetail(applicationNumber) {
  const body = await callKipris(`${SERVICE}/getBibliographyDetailInfoSearch`, { applicationNumber });
  const items = toArray(body.item ?? body.items?.item);
  if (items.length === 0) return null;
  return normalizeDetailItem(items[0]);
}

module.exports = { searchByNumber, searchByKeyword, getDetail };
