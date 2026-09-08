/**
 * 컴플라이언스 담당자 화면(및 답변 저장 API)을 위한 최소한의 접근 제어.
 * 담당자들이 공유하는 아이디/비밀번호 1개로 HTTP Basic Auth를 적용한다.
 * COMPLIANCE_PASSWORD 가 설정되지 않은 경우(로컬 개발 등)에는 보호를 건너뛰고 경고만 남긴다.
 */
function complianceBasicAuth(req, res, next) {
  const expectedUser = process.env.COMPLIANCE_USERNAME || "compliance";
  const expectedPass = process.env.COMPLIANCE_PASSWORD;

  if (!expectedPass) {
    console.warn(
      "[complianceAuth] COMPLIANCE_PASSWORD 가 설정되지 않아 컴플라이언스 화면이 보호되지 않습니다. " +
        "운영 환경에서는 반드시 설정해 주세요."
    );
    return next();
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    if (user === expectedUser && pass === expectedPass) {
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="KIPI Compliance", charset="UTF-8"');
  return res.status(401).json({ error: "컴플라이언스 담당자 인증이 필요합니다." });
}

module.exports = { complianceBasicAuth };
