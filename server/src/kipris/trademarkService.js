const { callKipris, toArray } = require("./client");
const { pick } = require("./fieldPick");

const SERVICE = "trademarkInfoSearchService";

function normalizeItem(item) {
  const applicationNumber = pick(item, ["applicationNumber"]);
  const goodsList = toArray(item.goodsInfoArray?.goodsInfo ?? item.designatedGoodsInfoArray?.designatedGoodsInfo);

  return {
    applicationNumber,
    applicationDate: pick(item, ["applicationDate"]),
    publicationNumber: pick(item, ["publicationNumber", "openNumber"]),
    publicationDate: pick(item, ["publicationDate", "openDate"]),
    registerNumber: pick(item, ["registrationNumber", "registerNumber"]),
    registerDate: pick(item, ["registrationDate", "registerDate"]),
    titleKor: pick(item, ["title", "titleKor", "indexTradeMarkNameKorean"]),
    titleEng: pick(item, ["titleEng", "indexTradeMarkNameEnglish"]),
    applicationStatus: pick(item, ["applicationStatus", "registerStatus"]),
    applicants: toArray(item.applicantInfoArray?.applicantInfo).map((a) => pick(a, ["name"])).filter(Boolean),
    agents: toArray(item.agentInfoArray?.agentInfo).map((a) => pick(a, ["name"])).filter(Boolean),
    // 지정상품 분류 (예: "09, 42") 및 지정상품 목록
    classificationCodes: String(pick(item, ["classificationCode", "asignProductMainCodeList"]) || "")
      .split(/[,\s]+/)
      .filter(Boolean),
    designatedGoods: goodsList.map((g) => pick(g, ["goodsName", "asignProductName", "name"])).filter(Boolean),
    similarGroupCodes: String(pick(item, ["viennaCode", "similarGroupCode", "asignProductSubCodeList"]) || "")
      .split(/[,\s]+/)
      .filter(Boolean),
    // 상표(도형/문자) 이미지 URL - KIPRIS가 제공하는 대표 이미지 경로
    markImageUrl: pick(item, ["bigDrawing", "drawing", "imagePath"]),
    kiprisViewUrl: applicationNumber
      ? `https://doi.kipris.or.kr/doi/searchApplNo.do?applNo=${encodeURIComponent(applicationNumber)}`
      : undefined,
    raw: item,
  };
}

/** 출원번호/등록번호 등으로 상표를 검색한다. */
async function searchByNumber(number, { numOfRows = 10, pageNo = 1 } = {}) {
  const body = await callKipris(`${SERVICE}/applicationNumberSearchInfo`, {
    applicationNumber: number,
    numOfRows,
    pageNo,
  });
  const items = toArray(body.items?.item);
  return items.map(normalizeItem);
}

/** 상표 명칭(단어)으로 검색한다. */
async function searchByName(word, { numOfRows = 10, pageNo = 1 } = {}) {
  const body = await callKipris(`${SERVICE}/getWordSearch`, {
    word,
    numOfRows,
    pageNo,
  });
  const items = toArray(body.items?.item);
  return items.map(normalizeItem);
}

/** 출원번호로 상표 상세(이미지, 지정상품 분류 등)를 조회한다. */
async function getDetail(applicationNumber) {
  const body = await callKipris(`${SERVICE}/getBibliographyDetailInfoSearch`, {
    applicationNumber,
  });
  const items = toArray(body.item ?? body.items?.item);
  if (items.length === 0) return null;
  return normalizeItem(items[0]);
}

module.exports = { searchByNumber, searchByName, getDetail };
