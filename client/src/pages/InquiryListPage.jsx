import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IP_TYPE_LABEL, inquiryApi } from "../api.js";

export default function InquiryListPage() {
  const [inquiries, setInquiries] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    inquiryApi
      .list()
      .then(setInquiries)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">컴플라이언스 문의 내역</h1>
      <p className="page-desc">
        등록된 모든 문의 내역입니다. 누구나 열람할 수 있으며, 답변이 등록된 문의는 담당자 코멘트를 함께
        확인할 수 있습니다.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {inquiries && inquiries.length === 0 && <div className="empty-state">등록된 문의가 없습니다.</div>}

      {inquiries && inquiries.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>구분</th>
                <th>제목</th>
                <th>관련 IP 번호</th>
                <th>문의자</th>
                <th>등록일</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inq) => (
                <tr key={inq.id} className="clickable" onClick={() => navigate(`/inquiries/${inq.id}`)}>
                  <td>#{inq.id}</td>
                  <td>
                    <span className="badge badge-type">{IP_TYPE_LABEL[inq.ip_type]}</span>
                  </td>
                  <td>{inq.subject}</td>
                  <td>{inq.ip_number || "-"}</td>
                  <td>{inq.requester_email}</td>
                  <td>{inq.created_at}</td>
                  <td>
                    {inq.status === "ANSWERED" ? (
                      <span className="badge badge-answered">답변완료</span>
                    ) : (
                      <span className="badge badge-open">대기중</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
