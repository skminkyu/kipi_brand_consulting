require("dotenv").config();

const dns = require("dns");
// Railway 등 일부 컨테이너 플랫폼은 아웃바운드 IPv6 경로가 없는데, Node의 기본 DNS 해석
// 순서(verbatim)는 IPv6(AAAA) 주소를 먼저 시도해 "connect ENETUNREACH ...(IPv6 주소)"로
// 실패하는 경우가 있다(SMTP 등 외부 연결에서 자주 발생). IPv4를 우선하도록 강제한다.
dns.setDefaultResultOrder("ipv4first");

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");

const kiprisRoutes = require("./routes/kiprisRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const { complianceBasicAuth } = require("./complianceAuth");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hasKiprisKey: Boolean(process.env.KIPRIS_API_KEY),
    hasCompliancePassword: Boolean(process.env.COMPLIANCE_PASSWORD),
    hasSmtpConfig: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

app.use("/api/kipris", kiprisRoutes);
app.use("/api/inquiries", inquiryRoutes);

// 배포 시 client/dist 빌드 결과물이 존재하면 같은 서버에서 정적으로 함께 서빙한다.
// (별도 프론트엔드 호스팅/리버스 프록시 없이 한 프로세스로 운영 가능)
const CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(CLIENT_DIST)) {
  // 컴플라이언스 담당자 화면은 공유 비밀번호(HTTP Basic Auth)로 접근을 제한한다.
  app.get(["/compliance", "/compliance/*splat"], complianceBasicAuth, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
  app.use(express.static(CLIENT_DIST));
  app.get("/*splat", (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err?.name === "MulterError") {
    return res.status(400).json({ error: `파일 업로드 오류: ${err.message}` });
  }
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`KIPI 컴플라이언스 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
