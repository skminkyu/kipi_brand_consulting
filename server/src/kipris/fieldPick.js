/** 여러 후보 키 이름 중 값이 있는 첫 번째 필드를 반환한다.
 * KIPRIS 각 서비스의 응답 필드명이 문서/버전에 따라 다소 차이가 있을 수 있어
 * 후보 키를 넉넉히 나열해 안전하게 매핑한다.
 */
function pick(obj, keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}

module.exports = { pick };
