const { callKipris, toArray } = require("./client");
const { pick } = require("./fieldPick");

const SERVICE = "RelatedDocsonfileTMService";

/**
 * 상표 행정처리 이력(통합이력정보) 조회 - KIPRIS Plus에 별도로 추가 구매한 상품.
 * 요청 주소/오퍼레이션명은 실제 구매한 KIPRIS Plus 상품 상세 페이지의 "요청 URL"/"입력값(샘플)"로
 * 확인했다: http://plus.kipris.or.kr/openapi/rest/RelatedDocsonfileTMService/relatedDocsonfileInfo
 * (accessKey 인증, /openapi/rest 게이트웨이).
 * 다만 응답 필드명은 공식 명세로 확인하지 못해, 자주 쓰이는 후보 키를 넉넉히 매핑해두고
 * raw 원본도 함께 내려준다 - 화면의 "원본 응답 데이터"에서 실제 필드명을 확인해 필요 시
 * 아래 pick() 후보 목록을 보정하면 된다.
 */
async function getHistory(applicationNumber) {
  const body = await callKipris(
    `${SERVICE}/relatedDocsonfileInfo`,
    { applicationNumber },
    { base: "rest", keyParam: "accessKey" }
  );
  const items = toArray(body.items?.item ?? body.item);
  return items.map((item) => ({
    applicationNumber: pick(item, ["applicationNumber", "ApplicationNumber"]),
    appReferenceNumber: pick(item, ["appReferenceNumber", "AppReferenceNumber"]),
    documentNumber: pick(item, ["documentNumber", "docNumber", "receiptNumber", "documentNo"]),
    documentDate: pick(item, ["documentDate", "receiptDate", "docDate", "processDate"]),
    documentTitle: pick(item, ["documentName", "documentTitle", "docName", "processName", "title"]),
    documentTitleEng: pick(item, [
      "documentNameEng",
      "documentTitleEng",
      "docNameEng",
      "processNameEng",
      "titleEng",
    ]),
    step: pick(item, ["step", "gubun", "procedureType", "category"]),
    status: pick(item, ["status", "docStatus", "processResult", "resultCode"]),
    statusEng: pick(item, ["statusEng", "docStatusEng", "processResultEng"]),
    trialNumber: pick(item, ["trialNumber", "adjudicationNumber", "trialNum"]),
    registrationNumber: pick(item, ["registrationNumber", "registerNumber"]),
    regReferenceNumber: pick(item, ["regReferenceNumber"]),
    raw: item,
  }));
}

module.exports = { getHistory };
