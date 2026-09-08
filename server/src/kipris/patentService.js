const { callKipris, toArray } = require("./client");
const { pick } = require("./fieldPick");

const SERVICE = "patUtiModInfoSearchSevice";

function normalizeItem(item) {
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

/** 출원번호/등록번호/공개번호 등으로 특허·실용신안을 검색한다. */
async function searchByNumber(number, { numOfRows = 10, pageNo = 1 } = {}) {
  const body = await callKipris(`${SERVICE}/applicationNumberSearchInfo`, {
    applicationNumber: number,
    numOfRows,
    pageNo,
  });
  const items = toArray(body.items?.item);
  return items.map(normalizeItem);
}

/** 자유검색(발명의 명칭, 키워드 등)으로 특허·실용신안을 검색한다. */
async function searchByKeyword(word, { numOfRows = 10, pageNo = 1 } = {}) {
  const body = await callKipris(`${SERVICE}/getWordSearch`, {
    word,
    numOfRows,
    pageNo,
  });
  const items = toArray(body.items?.item);
  return items.map(normalizeItem);
}

/** 출원번호로 서지상세정보(요약/청구항/전문 관련 정보 포함)를 조회한다. */
async function getDetail(applicationNumber) {
  const body = await callKipris(`${SERVICE}/getBibliographyDetailInfoSearch`, {
    applicationNumber,
  });
  const items = toArray(body.item ?? body.items?.item);
  if (items.length === 0) return null;
  return normalizeItem(items[0]);
}

module.exports = { searchByNumber, searchByKeyword, getDetail };
