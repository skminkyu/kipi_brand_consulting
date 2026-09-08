import { NavLink, Route, Routes } from "react-router-dom";
import SearchPage from "./pages/SearchPage.jsx";
import InquiryFormPage from "./pages/InquiryFormPage.jsx";
import InquiryListPage from "./pages/InquiryListPage.jsx";
import InquiryDetailPage from "./pages/InquiryDetailPage.jsx";
import ComplianceDashboardPage from "./pages/ComplianceDashboardPage.jsx";

export default function App() {
  return (
    <>
      <header className="app-header">
        <span className="app-title">KIPI 브랜드 컴플라이언스</span>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            KIPRIS 검색
          </NavLink>
          <NavLink to="/inquiries/new" className={({ isActive }) => (isActive ? "active" : "")}>
            컴플라이언스 문의하기
          </NavLink>
          <NavLink to="/inquiries" className={({ isActive }) => (isActive ? "active" : "")}>
            문의 내역
          </NavLink>
          <NavLink to="/compliance" className={({ isActive }) => (isActive ? "active" : "")}>
            컴플라이언스 담당자 화면
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/inquiries/new" element={<InquiryFormPage />} />
          <Route path="/inquiries" element={<InquiryListPage />} />
          <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
          <Route path="/compliance" element={<ComplianceDashboardPage />} />
          <Route path="/compliance/:id" element={<ComplianceDashboardPage />} />
        </Routes>
      </main>
    </>
  );
}
