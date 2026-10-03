"use client";

import { useEffect, useState, type FormEvent } from "react";

type Meta = {
  filters: {
    years: Array<{
      MANIENHOC: number;
      TENNIENHOC: string;
    }>;
    grades: Array<{
      MAKHOI: number;
      TENKHOI: string;
      classes: Array<{
        MALOPHOC: number;
        TENLOPHOC: string;
      }>;
    }>;
    selected: {
      nienhoc: string;
    };
  };
};

type AttendanceRecord = {
  sourceId: string;
  externalStudentCode: string;
  fullName: string;
  attendanceDate: string;
  attendanceTypeLabel: string;
  status: "present" | "excused" | "absent";
  className: string;
  markedBy: string;
  note: string;
};

type Result = {
  records: AttendanceRecord[];
  summary: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
  };
};

function todayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const statusLabels = {
  present: "Có mặt",
  excused: "Vắng có phép",
  absent: "Vắng",
};

export default function CcamsAttendance() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [year, setYear] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [attendanceType, setAttendanceType] = useState("1");
  const [search, setSearch] = useState("");

  const [result, setResult] = useState<Result | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Ghi nhớ bộ lọc đã tra để phân trang đúng kết quả.
  const [appliedQuery, setAppliedQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadMeta() {
      setMetaLoading(true);
      setError("");
      setMeta(null);
      setResult(null);
      setAppliedQuery("");

      try {
        const query = year
          ? `?${new URLSearchParams({ nienhoc: year })}`
          : "";

        const response = await fetch(`/api/ccams/meta${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const body = await response.json();

        if (!response.ok || !body.success) {
          throw new Error(body.message || "Không tải được bộ lọc.");
        }

        const data = body.data as Meta;

        if (
          !Array.isArray(data.filters?.years) ||
          !Array.isArray(data.filters?.grades)
        ) {
          throw new Error("Danh sách bộ lọc CCAMS không hợp lệ.");
        }

        if (controller.signal.aborted) return;

        setMeta(data);

        if (!year) {
          const initialYear = String(
            data.filters.selected?.nienhoc ||
              data.filters.years[0]?.MANIENHOC ||
              "",
          );

          setYear(initialYear);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;

        setError(
          cause instanceof Error ? cause.message : "Không tải được bộ lọc.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setMetaLoading(false);
        }
      }
    }

    void loadMeta();

    return () => controller.abort();
  }, [year]);

  async function loadAttendance(query: string, page = 1) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const params = new URLSearchParams(query);
      params.set("page", String(page));

      const response = await fetch(
        `/api/ccams/attendance?${params}`,
        { cache: "no-store" },
      );

      const body = await response.json();

      if (!response.ok || !body.success) {
        throw new Error(body.message || "Không tải được điểm danh.");
      }

      if (!Array.isArray(body.records) || !body.summary) {
        throw new Error("Dữ liệu điểm danh không hợp lệ.");
      }

      setResult({
        records: body.records,
        summary: body.summary,
      });

      setAppliedQuery(query);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không tải được điểm danh.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!year || !fromDate || !toDate) {
      setError("Hãy chọn niên học và khoảng ngày.");
      return;
    }

    if (toDate < fromDate) {
      setError("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      return;
    }

    const params = new URLSearchParams({
      date: fromDate,
      to: toDate,
      loai: attendanceType,
      nienhoc: year,
      khoi_lop: classFilter,
      search: search.trim(),
    });

    void loadAttendance(params.toString());
  }

  return (
    <section className="module-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">CHUYÊN CẦN</span>
          <h1>Tra cứu điểm danh</h1>
          <p>Xem dữ liệu điểm danh từ CCAMS theo bộ lọc.</p>
        </div>
      </div>

      <article className="panel">
        <form className="ccams-filters" onSubmit={handleSubmit}>
          <fieldset disabled={loading || metaLoading}>
            <div className="ccams-filter-grid">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  required
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </label>

              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  required
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </label>

              <label>
                <span>Loại điểm danh</span>
                <select
                  value={attendanceType}
                  onChange={(event) => setAttendanceType(event.target.value)}
                >
                  <option value="all">Tất cả loại hiện diện</option>
                  <option value="1">Hiện diện Thánh lễ</option>
                  <option value="2">Hiện diện Giáo lý</option>
                  <option value="3">Hiện diện Chầu Thánh Thể</option>
                  <option value="4">Hiện diện Xưng tội</option>
                  <option value="5">Hiện diện Thi đua/Khác</option>
                  <option value="v_all">Tất cả loại vắng</option>
                  <option value="v_1">Vắng Thánh lễ</option>
                  <option value="v_2">Vắng Giáo lý</option>
                  <option value="v_3">Vắng Chầu Thánh Thể</option>
                  <option value="v_4">Vắng Xưng tội</option>
                  <option value="v_5">Vắng Thi đua/Khác</option>
                </select>
              </label>

              <label>
                <span>Niên học</span>
                <select
                  required
                  value={year}
                  onChange={(event) => {
                    setClassFilter("all");
                    setYear(event.target.value);
                  }}
                >
                  <option value="" disabled>Chọn niên học</option>
                  {meta?.filters.years.map((item) => (
                    <option
                      key={item.MANIENHOC}
                      value={String(item.MANIENHOC)}
                    >
                      {item.TENNIENHOC}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Khối / Lớp</span>
                <select
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                >
                  <option value="all">Tất cả khối / lớp</option>

                  {meta?.filters.grades.map((grade) => (
                    <optgroup
                      key={grade.MAKHOI}
                      label={grade.TENKHOI.trim()}
                    >
                      <option value={`k_${grade.MAKHOI}`}>
                        Toàn khối {grade.TENKHOI.trim()}
                      </option>

                      {grade.classes.map((item) => (
                        <option
                          key={item.MALOPHOC}
                          value={`l_${item.MALOPHOC}`}
                        >
                          {item.TENLOPHOC}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label>
                <span>Từ khóa</span>
                <input
                  value={search}
                  maxLength={120}
                  placeholder="Nhập tên hoặc mã học viên"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>

            <div className="ccams-filter-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const today = todayIso();
                  setFromDate(today);
                  setToDate(today);
                }}
              >
                Hôm nay
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={!meta || !year}
              >
                {loading ? "Đang tải..." : "Tra cứu / Tải lại"}
              </button>
            </div>
          </fieldset>
        </form>
      </article>

      {metaLoading && (
        <div className="empty-search">Đang tải danh sách bộ lọc...</div>
      )}

      {error && <p role="alert" className="ccams-error">{error}</p>}

      {loading && (
        <div className="empty-search">Đang lấy dữ liệu điểm danh...</div>
      )}

      {!loading && result && (
        <article className="panel ccams-results">
          <div className="panel-heading">
            <h2>Kết quả tra cứu</h2>
            <span>Tổng cộng {result.summary.total} lượt</span>
          </div>

          {result.records.length === 0 ? (
            <div className="empty-search">
              Không có dữ liệu khớp bộ lọc.
              Hãy thử đổi ngày, loại điểm danh hoặc khối/lớp.
            </div>
          ) : (
            <div className="student-table-wrap">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>NGÀY</th>
                    <th>HỌC VIÊN</th>
                    <th>LỚP</th>
                    <th>HOẠT ĐỘNG</th>
                    <th>TRẠNG THÁI</th>
                    <th>NGƯỜI ĐIỂM DANH</th>
                    <th>GHI CHÚ</th>
                  </tr>
                </thead>

                <tbody>
                  {result.records.map((record) => (
                    <tr key={record.sourceId}>
                      <td>{formatDate(record.attendanceDate)}</td>
                      <td>
                        <div className="student-detail">
                          <strong>{record.fullName}</strong>
                          <span>{record.externalStudentCode}</span>
                        </div>
                      </td>
                      <td>{record.className}</td>
                      <td>{record.attendanceTypeLabel}</td>
                      <td>{statusLabels[record.status]}</td>
                      <td>{record.markedBy || "—"}</td>
                      <td>{record.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pagination-row">
            <span>
              Trang {result.summary.page} / {result.summary.lastPage}
            </span>

            <div>
              <button
                type="button"
                disabled={result.summary.page <= 1}
                onClick={() =>
                  void loadAttendance(
                    appliedQuery,
                    result.summary.page - 1,
                  )
                }
              >
                Trước
              </button>

              <button
                type="button"
                disabled={
                  result.summary.page >= result.summary.lastPage
                }
                onClick={() =>
                  void loadAttendance(
                    appliedQuery,
                    result.summary.page + 1,
                  )
                }
              >
                Sau
              </button>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}