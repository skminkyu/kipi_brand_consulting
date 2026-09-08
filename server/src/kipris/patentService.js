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

/** 출원번호/등록번호/공개번호 등으로 특허·실용신안을 검색한다. */
async function searchByNumber(number, { docsStart = 1, docsCount = 10 } = {}) {
  const body = await callKipris(
    `${SERVICE}/applicationNumberSearchInfo`,
    { applicationNumber: number, docsStart, docsCount, ...COMMON_SEARCH_PARAMS },
    { base: "rest" }
  );
  const items = toArray(body.items?.PatentUtilityInfo);
  return items.map(normalizeSearchItem);
}

/** 자유검색(발명의 명칭, 키워드 등)으로 특허·실용신안을 검색한다. */
async function searchByKeyword(word, { docsStart = 1, docsCount = 10 } = {}) {
  const body = await callKipris(
    `${SERVICE}/freeSearchInfo`,
    { word, docsStart, docsCount, ...COMMON_SEARCH_PARAMS },
    { base: "rest" }
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
