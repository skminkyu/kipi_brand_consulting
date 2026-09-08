const express = require("express");
const patentService = require("../kipris/patentService");
const trademarkService = require("../kipris/trademarkService");
const { KiprisError } = require("../kipris/client");

const router = express.Router();

function handleKiprisError(res, err) {
  if (err instanceof KiprisError) {
    return res.status(502).json({ error: err.message, code: err.code });
  }
  console.error(err);
  return res.status(500).json({ error: "서버 오류가 발생했습니다." });
}

/**
 * GET /api/kipris/search?type=PATENT|UTILITY|TRADEMARK&number=...&keyword=...
 * QA 담당자가 번호(출원/등록/공고) 또는 키워드로 특허·실용신안·상표를 검색한다.
 * PATENT/UTILITY 는 동일한 KIPRIS 서비스(특허·실용신안 통합)를 사용한다.
 */
router.get("/search", async (req, res) => {
  const { type, number, keyword } = req.query;
  if (!type || (!number && !keyword)) {
    return res.status(400).json({ error: "type 과 number(또는 keyword) 파라미터가 필요합니다." });
  }

  try {
    let results = [];
    if (type === "PATENT" || type === "UTILITY") {
      results = number
        ? await patentService.searchByNumber(number)
        : await patentService.searchByKeyword(keyword);
    } else if (type === "TRADEMARK") {
      results = number
        ? await trademarkService.searchByNumber(number)
        : await trademarkService.searchByName(keyword);
    } else {
      return res.status(400).json({ error: "type 은 PATENT, UTILITY, TRADEMARK 중 하나여야 합니다." });
    }
    res.json({ type, count: results.length, results });
  } catch (err) {
    handleKiprisError(res, err);
  }
});

/**
 * GET /api/kipris/patent/:applicationNumber
 * 특허/실용신안 서지상세정보 + 요약(초록)/청구항 조회 (전문보기 클릭 시 사용)
 */
router.get("/patent/:applicationNumber", async (req, res) => {
  try {
    const detail = await patentService.getDetail(req.params.applicationNumber);
    if (!detail) return res.status(404).json({ error: "해당 출원번호의 특허/실용신안 정보를 찾을 수 없습니다." });
    res.json(detail);
  } catch (err) {
    handleKiprisError(res, err);
  }
});

/**
 * GET /api/kipris/trademark/:applicationNumber
 * 상표 상세정보(이미지, 지정상품 분류 등) 조회 (상표 명칭 클릭 시 사용)
 */
router.get("/trademark/:applicationNumber", async (req, res) => {
  try {
    const detail = await trademarkService.getDetail(req.params.applicationNumber);
    if (!detail) return res.status(404).json({ error: "해당 출원번호의 상표 정보를 찾을 수 없습니다." });
    res.json(detail);
  } catch (err) {
    handleKiprisError(res, err);
  }
});

module.exports = router;
