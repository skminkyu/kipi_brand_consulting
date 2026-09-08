const { callKipris, toArray } = require("./client");
const { pick } = require("./fieldPick");

const SERVICE = "legStatusInfoSearchService";

/**
 * 법적 상태 이력(특허·실용/디자인/상표 공통) 조회.
 * 상표 정보검색서비스(trademarkInfoSearchService)를 구매하지 않은 계정에서도 별도 상품으로
 * 이용 가능한 경우가 있어, 상표 서지상세/검색이 실패했을 때 최소한의 대체 정보로 사용한다.
 * 이미지·지정상품 분류·출원인 등은 이 응답에 포함되어 있지 않다(법적 상태 이력만 제공).
 */
async function getHistory(applicationNumber) {
  const body = await callKipris(`${SERVICE}/getLegStatusHistoryInfoSearch`, { applicationNumber });
  const items = toArray(body.items?.item ?? body.item);
  return items.map((item) => ({
    applicationNumber: pick(item, ["applicationNumber"]),
    appReferenceNumber: pick(item, ["appReferenceNumber"]),
    legalStatusCode: pick(item, ["legalStatusCode"]),
    legalStatusName: pick(item, ["legalStatusName"]),
    legalStatusDate: pick(item, ["legalStatusDate"]),
    legalStatusComment: pick(item, ["legalStatusComment"]),
  }));
}

module.exports = { getHistory };
