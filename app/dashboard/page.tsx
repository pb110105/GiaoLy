"use client";
import CcamsAttendance from "@/components/ccams-attendance";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import StudentExcelImport from "@/components/student-excel-import";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  Cross,
  Download,
  FileText,
  Filter,
  LayoutDashboard,
  Mail,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  Save,
  Search,
  Settings,
  TrendingUp,
  UserCheck,
  UserPlus,
  UsersRound,
  X,
  LogOut,
  Armchair,
  type LucideIcon,
} from "lucide-react";

type NavItem = { id: string; label: string; icon: LucideIcon };
type Student = {
  name: string;
  initials: string;
  className: string;
  guardian: string;
  status: "Đang học" | "Cần bổ sung";
  color: string;
};
type DashboardSuccessResponse = {
  success: true;
  teacher: {
    id: string;
    accountId: string;
    fullName: string;
    phone: string;
    email: string;
    role: string;
  };
  summary: {
    classCount: number;
    studentCount: number;
  };
  classes: Array<{
    id: string;
    classCode: string;
    className: string;
    gradeLevel: string;
    schoolYear: string;
    schedule: string;
    room: string;
    status: string;
    assignmentRole: string;
    teacherNames: string[];
  }>;
  students: Array<{
    id: string;
    studentCode: string;
    fullName: string;
    classId: string;
    birthDate: string;
    gender: string;
    guardianName: string;
    guardianPhone: string;
    status: string;
  }>;
};

type DashboardResponse =
  | DashboardSuccessResponse
  | {
      success: false;
      message: string;
    };

function createInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}
const navigation: NavItem[] = [
  { id: "dashboard", label: "Tổng quan (Comming Soon)", icon: LayoutDashboard },
  { id: "students", label: "Học viên (Comming Soon)", icon: UsersRound },
  { id: "classes", label: "Lớp giáo lý", icon: BookOpen },
  { id: "attendance", label: "Điểm danh (Comming Soon)", icon: ClipboardCheck },
  { id: "sacraments", label: "Bí tích (Comming Soon)", icon: Cross },
  { id: "reports", label: "Báo cáo (Comming Soon)", icon: BarChart3 },
];


const featureSets: Record<string, Array<{ title: string; caption: string; icon: LucideIcon }>> = {
  sacraments: [
    { title: "Rửa Tội", caption: "184 hồ sơ", icon: Cross },
    { title: "Rước Lễ Lần Đầu", caption: "56 đang chuẩn bị", icon: BookOpen },
    { title: "Thêm Sức", caption: "62 đang chuẩn bị", icon: UserCheck },
    { title: "Chứng nhận", caption: "12 cần bổ sung", icon: FileText },
  ],
  reports: [
    { title: "Danh sách học viên", caption: "Theo lớp và khối", icon: UsersRound },
    { title: "Báo cáo chuyên cần", caption: "Theo tuần và học kỳ", icon: ClipboardCheck },
    { title: "Tiến độ lớp học", caption: "So sánh 8 lớp", icon: BarChart3 },
    { title: "Hồ sơ Bí tích", caption: "Tổng hợp chứng nhận", icon: FileText },
  ],
  settings: [
    { title: "Thông tin giáo xứ", caption: "Tên và thông tin liên hệ", icon: Cross },
    { title: "Niên khóa", caption: "2026 – 2027", icon: CalendarDays },
    { title: "Người dùng", caption: "Vai trò và phân quyền", icon: UsersRound },
    { title: "Sao lưu dữ liệu", caption: "Xuất dữ liệu định kỳ", icon: Download },
  ],
};

const weeklyAttendance = [78, 84, 81, 90, 86, 92];

function LogoMark() {
  return <span className="logo-mark" aria-hidden="true"><Cross size={20} strokeWidth={2.3} /></span>;
}

function StudentAvatar({ student }: { student: Student }) {
  return <span className={`student-avatar ${student.color}`}>{student.initials}</span>;
}

export default function Home() {
  const [selectedAttendanceClassId, setSelectedAttendanceClassId] =
  useState("");
  const [selectedDiligenceClassId, setSelectedDiligenceClassId] =
  useState("");

  const [attendanceDate, setAttendanceDate] = useState(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "";

    return `${get("year")}-${get("month")}-${get("day")}`;
  });
  const router = useRouter();
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [dashboardData, setDashboardData] =
    useState<DashboardSuccessResponse | null>(null);

  const [isLoadingDashboard, setIsLoadingDashboard] =
  useState(true);
  const [isLoggingOut, setIsLoggingOut] =
  useState(false);
  const [selectedSeatingClassId, setSelectedSeatingClassId,] 
  = useState("");
  
  const [dashboardError, setDashboardError] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [attendance, setAttendance] = useState<
  Record<string, "present" | "absent" | "excused">
  >({});

  useEffect(() => {
  const controller = new AbortController();
  
  async function loadDashboard() {
    try {
      const response = await fetch("/api/dashboard", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      const data = (await response.json()) as DashboardResponse;

      if (!data.success) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        throw new Error(data.message);
      }

      setDashboardData(data);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setDashboardError(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu dashboard.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingDashboard(false);
      }
    }
  }

  void loadDashboard();

  return () => controller.abort();
}, [router]);

const schoolYears = useMemo(() => {
  const years = (dashboardData?.classes ?? [])
    .map((item) => item.schoolYear.trim())
    .filter(Boolean);

  return [...new Set(years)].sort((a, b) =>
    b.localeCompare(a, "vi", { numeric: true }),
  );
}, [dashboardData]);

const schoolYear = schoolYears.includes(selectedSchoolYear)
  ? selectedSchoolYear
  : schoolYears[0] ?? "";

const yearData = useMemo(() => {
  const classes = (dashboardData?.classes ?? []).filter(
    (item) => schoolYear && item.schoolYear.trim() === schoolYear,
  );

  const classIds = new Set(classes.map((item) => item.id));

  const students = (dashboardData?.students ?? []).filter(
    (item) => classIds.has(item.classId),
  );

  return { classes, students };
}, [dashboardData, schoolYear]);

const teacherName =
  dashboardData?.teacher.fullName ?? "Ban Giáo lý";

const students = useMemo<Student[]>(() => {
  const classNames = new Map(
    yearData.classes.map((item) => [item.id, item.className]),
  );
  const colors = ["coral", "blue", "violet", "mint"];

  return yearData.students.map((student, index) => ({
    name: student.fullName,
    initials: createInitials(student.fullName),
    className: classNames.get(student.classId) ?? "Chưa xác định",
    guardian: student.guardianName,
    status: "Đang học",
    color: colors[index % colors.length],
  }));
}, [yearData]);

const classes = useMemo(() => {
  const tones = ["mint", "blue", "coral", "violet", "amber", "navy"];
  const studentCounts = new Map<string, number>();

  for (const student of yearData.students) {
    studentCounts.set(
      student.classId,
      (studentCounts.get(student.classId) ?? 0) + 1,
    );
  }

  return yearData.classes.map((item, index) => ({
    id: item.id,
    name: item.className,
    teacher: item.teacherNames?.length ? item.teacherNames.join(", ") : "Chưa phân công GLV",
    students: studentCounts.get(item.id) ?? 0,
    schedule: item.schedule,
    schoolYear: item.schoolYear,
    tone: tones[index % tones.length],
  }));
}, [yearData, teacherName]);

const studentCount = students.length;
const classCount = classes.length;
const now = new Date();

const currentDateLabel = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(now);

const currentHour = Number(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now),
);

const greeting =
  currentHour < 12
    ? "Chào buổi sáng"
    : currentHour < 18
      ? "Chào buổi chiều"
      : "Chào buổi tối";

const seatingClassId = classes.some(
  (item) => item.id === selectedSeatingClassId,
)
  ? selectedSeatingClassId
  : classes[0]?.id ?? "";

const seatingClass = classes.find(
  (item) => item.id === seatingClassId,
);

const seatingStudents = yearData.students.filter(
  (student) => student.classId === seatingClassId,
);

const filteredStudents = useMemo(() => {
  const query = searchQuery
    .trim()
    .toLocaleLowerCase("vi");

  if (!query) {
    return students;
  }

  return students.filter((student) =>
    `${student.name} ${student.className} ${student.guardian}`
      .toLocaleLowerCase("vi")
      .includes(query),
  );
}, [searchQuery, students]);

async function refreshDashboardAfterImport() {
  const response = await fetch("/api/dashboard", {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as DashboardResponse;

  if (!response.ok) {
    throw new Error("Không thể tải lại danh sách học viên.");
  }

  if (!data.success) {
    throw new Error(data.message);
  }

  setDashboardData(data);
}

const attendanceClassId = classes.some(
  (item) => item.id === selectedAttendanceClassId,
)
  ? selectedAttendanceClassId
  : classes[0]?.id ?? "";

const attendanceClass = classes.find(
  (item) => item.id === attendanceClassId,
);

const attendanceStudents = yearData.students.filter(
  (student) => student.classId === attendanceClassId,
);

// Mỗi học viên có trạng thái riêng theo lớp và ngày.
function attendanceKey(studentId: string) {
  return `${attendanceClassId}|${attendanceDate}|${studentId}`;
}

const attendanceCounts = {
  present: 0,
  excused: 0,
  absent: 0,
  unmarked: 0,
};

for (const student of attendanceStudents) {
  const status = attendance[attendanceKey(student.id)];

  if (
    status === "present" ||
    status === "excused" ||
    status === "absent"
  ) {
    attendanceCounts[status]++;
  } else {
    attendanceCounts.unmarked++;
  }
}

const attendanceDateLabel = attendanceDate
  ? new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${attendanceDate}T00:00:00+07:00`))
  : "Chưa chọn ngày";
if (isLoadingDashboard) {
  return (
    <main className="dashboard-state">
      <div>
        <span className="dashboard-spinner" />

        <strong>Đang tải dữ liệu...</strong>

        <p>
          Đang lấy lớp và học viên được phân công.
        </p>
      </div>
    </main>
  );
}

if (dashboardError) {
  return (
    <main className="dashboard-state">
      <div>
        <strong>Không thể tải dashboard</strong>

        <p>{dashboardError}</p>

        <button
          type="button"
          onClick={() => window.location.reload()}
        >
          Thử lại
        </button>
      </div>
    </main>
  );
}

if (!dashboardData) {
  return null;
}

  function selectView(id: string) {
    setActiveView(id);
    setSidebarOpen(false);
  }

  function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowAddStudent(false);
    setToast("Đã lưu học viên vào bản giao diện mẫu.");
    window.setTimeout(() => setToast(""), 2800);
  }

  async function handleLogout() {
  if (isLoggingOut) return;

  setIsLoggingOut(true);

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Không thể đăng xuất.");
    }

    router.replace("/login");
    router.refresh();
  } catch {
    setIsLoggingOut(false);
    setToast("Không thể đăng xuất. Vui lòng thử lại.");

    window.setTimeout(() => {
      setToast("");
    }, 2500);
  }
}

  return (
    <div className="app-shell">
      <button className={`sidebar-scrim ${sidebarOpen ? "show" : ""}`} aria-label="Đóng menu" onClick={() => setSidebarOpen(false)} />

      <aside
        id="dashboard-sidebar"
        className={`sidebar ${sidebarOpen ? "open" : ""} ${
          sidebarCollapsed ? "collapsed" : ""
        }`}
      >
        <button
          type="button"
          className="icon-button sidebar-toggle"
          aria-controls="dashboard-sidebar"
          aria-expanded={!sidebarCollapsed}
          aria-label={
            sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"
          }
          title={
            sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"
          }
          onClick={() => setSidebarCollapsed((current) => !current)}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>
        <div className="brand-row">
          <LogoMark />
          <div><strong>Giáo Lý Hub</strong><span>Giáo xứ Biên Hoà</span></div>
          <button className="icon-button close-sidebar" aria-label="Đóng menu" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <details
          className="year-picker"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              event.currentTarget.open = false;
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary className="year-picker-trigger">
            <span className="year-picker-icon">
              <CalendarDays size={22} />
            </span>

            <span className="year-picker-text">
              <span>Niên khóa</span>
              <strong>{schoolYear || "Chưa phân công"}</strong>
            </span>

            <ChevronDown size={18} className="year-picker-chevron" />
          </summary>

          <div className="year-picker-menu">
            <p>CHỌN NIÊN KHÓA</p>

            {schoolYears.length ? schoolYears.map((year) => (
              <button
                key={year}
                type="button"
                className={`year-picker-option ${schoolYear === year ? "selected" : ""}`}
                aria-pressed={schoolYear === year}
                onClick={(event) => {
                  setSelectedSchoolYear(year);
                  setSearchQuery("");
                  setAttendance({});
                  setShowAddStudent(false);

                  const picker = event.currentTarget.closest("details");
                  if (picker) {
                    picker.open = false;
                    picker.querySelector("summary")?.focus();
                  }
                }}
              >
                <span>{year}</span>
                {schoolYear === year && <Check size={17} />}
              </button>
            )) : (
              <span className="year-picker-empty">Chưa có lớp được phân công.</span>
            )}
          </div>
        </details>

        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          <span className="nav-heading">QUẢN LÝ</span>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${activeView === item.id ? "active" : ""}`}  title={sidebarCollapsed ? item.label : undefined} onClick={() => selectView(item.id)}>
                <Icon size={19} strokeWidth={1.9} />
                <span>{item.label}</span>
                {item.id === "students" && <em>{studentCount}</em>}
              </button>
            );
          })}
          <span className="nav-heading nav-heading-spaced">HỆ THỐNG</span>
          <button className="nav-item" onClick={() => selectView("settings")}><Settings size={19} strokeWidth={1.9} /><span>Cài đặt</span></button>
          <button
            type="button"
            className="nav-item logout-button"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            <LogOut size={19} strokeWidth={1.9} />

            <span>
              {isLoggingOut
                ? "Đang đăng xuất..."
                : "Đăng xuất"}
            </span>
          </button>
        </nav>

        <div className="sidebar-support">
          <div className="support-icon"><BookOpen size={19} /></div>
          <strong>Cần hỗ trợ?</strong>
          <span>Xem hướng dẫn sử dụng hệ thống</span>
          <button>Đọc hướng dẫn <ArrowUpRight size={14} /></button>
        </div>

        <div className="sidebar-user">
          <span className="user-avatar">GL</span>
          <div><strong>{teacherName}</strong><span>Giáo Lý Viên</span></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      <main className={`main-area ${
        sidebarCollapsed ? "sidebar-collapsed" : ""
      }`}>
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Mở menu" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <label className="global-search">
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm học viên, lớp học..." aria-label="Tìm kiếm" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Thông báo"><Bell size={20} /><span /></button>
            <button className="quick-add" onClick={() => setShowAddStudent(true)}><Plus size={18} /><span>Thêm học viên</span></button>
          </div>
        </header>

        <div className="content-wrap">
          <div className={activeView === "dashboard" ? "view-screen" : "view-screen hidden-view"}>
          <section className="page-heading">
            <div>
              <span className="eyebrow">{currentDateLabel}</span>
              <h1>{greeting}, {teacherName}!</h1>
              <p>Đây là tình hình sinh hoạt giáo lý của giáo xứ hôm nay.</p>
            </div>
            <button className="secondary-button"><Download size={17} />Xuất báo cáo</button>
          </section>

          <section className="stat-grid" aria-label="Số liệu tổng quan">
            <article className="stat-card">
              <div className="stat-icon navy"><UsersRound size={21} /></div>
              <div className="stat-copy"><span>Học viên phụ trách</span><strong>{studentCount}</strong></div>
              <span className="trend positive">Theo lớp phụ trách</span>
            </article>
            <article className="stat-card">
              <div className="stat-icon sky"><BookOpen size={21} /></div>
              <div className="stat-copy"><span>Lớp đang học</span><strong>{String(classCount).padStart(2, "0")}</strong></div>
              <span className="trend neutral">
                Theo phân công
              </span>
            </article>
            <article className="stat-card">
              <div className="stat-icon mint"><UserCheck size={21} /></div>
              <div className="stat-copy"><span>Chuyên cần</span><strong>-</strong></div>
              <span className="trend neutral">Chưa tổng hợp CCAMS</span>
            </article>
            <article className="stat-card warning-card">
              <div className="stat-icon amber"><AlertCircle size={21} /></div>
              <div className="stat-copy"><span>Hồ sơ cần bổ sung</span><strong>—</strong>
              <span className="trend neutral">Chưa có dữ liệu hồ sơ</span></div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel attendance-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">CHUYÊN CẦN</span>
                  <h2>Thống kê điểm danh</h2>
                </div>
              </div>

              <div className="empty-search">
                Chưa tổng hợp dữ liệu CCAMS cho niên khóa {schoolYear}.
              </div>
            </article>

            <article className="panel schedule-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">
                    NIÊN KHÓA {schoolYear}
                  </span>
                  <h2>Lịch học các lớp</h2>
                </div>
              </div>

              <div className="schedule-list">
                {classes.length === 0 ? (
                  <div className="empty-search">
                    Chưa có lớp trong niên khóa này.
                  </div>
                ) : (
                  classes.map((item) => (
                    <div className="schedule-item" key={item.id}>
                      <time>{item.schedule || "Chưa có lịch"}</time>

                      <span className="schedule-line coral-line" />

                      <div>
                        <strong>{item.name}</strong>

                        <span>
                          <CircleUserRound size={14} />
                          {item.teacher}
                        </span>
                      </div>

                      <em>{item.students} em</em>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                className="full-link"
                onClick={() => selectView("classes")}
              >
                Xem tất cả lớp
                <ChevronRight size={15} />
              </button>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel students-panel">
              <div className="panel-heading table-panel-heading">
                <div><span className="panel-kicker">HỌC VIÊN</span><h2>Học viên trong niên khoá</h2></div>
                <button className="text-link" onClick={() => selectView("students")}>Xem tất cả <ChevronRight size={15} /></button>
              </div>
              <div className="student-table-wrap">
                <table className="student-table">
                  <thead><tr><th>HỌC VIÊN</th><th>LỚP</th><th>PHỤ HUYNH</th><th>TRẠNG THÁI</th><th><span className="sr-only">Tùy chọn</span></th></tr></thead>
                  <tbody>
                    {filteredStudents.slice(0, 4).map((student) => (
                      <tr key={student.name}>
                        <td><div className="student-name-cell"><StudentAvatar student={student} /><strong>{student.name}</strong></div></td>
                        <td>{student.className}</td><td>{student.guardian}</td>
                        <td><span className={`status-pill ${student.status === "Đang học" ? "active" : "pending"}`}>{student.status === "Đang học" && <Check size={12} />}{student.status}</span></td>
                        <td><button className="table-action" aria-label={`Tùy chọn cho ${student.name}`}><MoreHorizontal size={18} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredStudents.length === 0 && <div className="empty-search">Không tìm thấy học viên phù hợp.</div>}
              </div>
            </article>

            <article className="panel attention-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">CẦN CHÚ Ý</span>
                  <h2>Việc cần xử lý</h2>
                </div>
              </div>

              <div className="empty-search">
                Chưa có dữ liệu để tổng hợp việc cần xử lý.
              </div>
            </article>
          </section>
          </div>

          {activeView === "students" && (
            <section className="module-view">
              <div className="module-heading">
                <div><span className="eyebrow">QUẢN LÝ HỌC VIÊN</span><h1>Danh sách học viên</h1><p>Theo dõi hồ sơ, lớp học và thông tin liên hệ phụ huynh.</p></div>
                <div className="student-heading-actions">
                  <StudentExcelImport
                    key={schoolYear}
                    classes={dashboardData.classes}
                    schoolYear={schoolYear}
                    onImported={refreshDashboardAfterImport}
                  />

                  <button
                    type="button"
                    className="primary-button module-primary"
                    onClick={() => setShowAddStudent(true)}
                  >
                    <UserPlus size={17} />
                    Thêm học viên
                  </button>
                </div>
              </div>
              <div className="module-stat-row">
                <div>
                  <span>Học viên phụ trách</span>
                  <strong>{studentCount}</strong>
                </div>

                <div>
                  <span>Đang theo học</span>
                  <strong>{studentCount}</strong>
                </div>

                <div>
                  <span>Lớp phụ trách</span>
                  <strong>{classCount}</strong>
                </div>

                <div>
                  <span>Hồ sơ chưa đủ</span>
                  <strong>0</strong>
                </div>
              </div>
              <article className="panel directory-panel">
                <div className="directory-tools">
                  <label className="directory-search"><Search size={17} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm theo tên học viên hoặc phụ huynh" /></label>
                  <button className="filter-button"><Filter size={16} /> Tất cả lớp <ChevronDown size={14} /></button>
                  <button className="filter-button"><Filter size={16} /> Trạng thái <ChevronDown size={14} /></button>
                  <button className="secondary-button export-students"><Download size={16} /> Xuất danh sách</button>
                </div>
                <div className="student-table-wrap module-table">
                  <table className="student-table">
                    <thead><tr><th>HỌC VIÊN</th><th>LỚP GIÁO LÝ</th><th>PHỤ HUYNH</th><th>LIÊN HỆ</th><th>TRẠNG THÁI</th><th><span className="sr-only">Tùy chọn</span></th></tr></thead>
                    <tbody>
                      {filteredStudents.map((student, index) => (
                        <tr key={student.name}>
                          <td><div className="student-name-cell"><StudentAvatar student={student} /><div className="student-detail"><strong>{student.name}</strong><span>Mã: GL{String(2601 + index).padStart(4, "0")}</span></div></div></td>
                          <td><span className="class-chip">{student.className}</span></td>
                          <td>{student.guardian}</td>
                          <td><div className="contact-cell"><button aria-label={`Gọi cho phụ huynh của ${student.name}`}><Phone size={14} /></button><button aria-label={`Gửi thư cho phụ huynh của ${student.name}`}><Mail size={14} /></button></div></td>
                          <td><span className={`status-pill ${student.status === "Đang học" ? "active" : "pending"}`}>{student.status === "Đang học" && <Check size={12} />}{student.status}</span></td>
                          <td><button className="table-action" aria-label={`Tùy chọn cho ${student.name}`}><MoreHorizontal size={18} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredStudents.length === 0 && <div className="empty-search">Không tìm thấy học viên phù hợp.</div>}
                </div>
                <div className="pagination-row"><span>Hiển thị {filteredStudents.length} trong tổng số {studentCount} học viên</span><div><button disabled>Trước</button><button className="current">1</button><button>2</button><button>3</button><button>Sau</button></div></div>
              </article>
            </section>
          )}

          {activeView === "classes" && (
            <section className="module-view">
              <div className="module-heading">
                <div><span className="eyebrow">NIÊN KHÓA {schoolYear}</span><h1>Lớp giáo lý</h1><p>Quản lý giáo lý viên, lịch học và tiến độ của từng lớp.</p></div>
                <button className="primary-button module-primary" onClick={() => { setToast("Đã mở quy trình tạo lớp mới."); window.setTimeout(() => setToast(""), 2500); }}><Plus size={17} /> Tạo lớp mới</button>
              </div>
              <div className="class-toolbar">
                <div className="segmented"><button className="active">Tất cả lớp <span>{classCount}</span></button><button>Đang học <span>{classCount}</span></button><button>Đã kết thúc <span>0</span></button></div>
                <button className="filter-button"><CalendarDays size={16} /> NIÊN KHÓA {schoolYear} <ChevronDown size={14} /></button>
              </div>
              <div className="class-grid">
                {classes.map((item) => (
                  <article className="class-card" key={item.name}>
                    <div className={`class-accent ${item.tone}`} />
                    <div className="class-card-head"><span className={`class-symbol ${item.tone}`}><BookOpen size={20} /></span><button className="table-action" aria-label={`Tùy chọn lớp ${item.name}`}><MoreHorizontal size={18} /></button></div>
                    <h2>{item.name}</h2><p>{item.teacher}</p>
                    <div className="class-meta"><span><UsersRound size={15} /> {item.students} học viên</span><span><CalendarDays size={15} /> {item.schedule}</span></div>
                    <div className="class-card-actions">
                      <button
                        type="button"
                        className="class-open"
                        onClick={() => {
                          setSelectedSeatingClassId(item.id);
                          setActiveView("seating");
                        }}
                      >
                        <Armchair size={16} />
                        Sơ đồ chỗ ngồi
                        <ChevronRight size={15} />
                      </button>
                      <button
                        type="button"
                        className="class-open"
                        onClick={() => {
                          setSelectedDiligenceClassId(item.id);
                          setActiveView("diligence");
                        }}
                      >
                        <UserCheck size={16} />
                        Chuyên cần
                        <ChevronRight size={15} />
                      </button>
                      <button
                        type="button"
                        className="class-open secondary"
                        onClick={() => setActiveView("attendance")}
                      >
                        Điểm danh
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeView === "seating" && (
            <section className="module-view">
              <div className="module-heading">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActiveView("classes")}
                >
                  Quay lại lớp giáo lý
                </button>

                <label className="seating-class-select">
                  <span>Chọn lớp</span>

                  <select
                    value={seatingClassId}
                    onChange={(event) =>
                      setSelectedSeatingClassId(
                        event.target.value,
                      )
                    }
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!seatingClass ? (
                <article className="panel seating-empty">
                  <Armchair size={34} />

                  <h2>Chưa có lớp trong niên khóa này</h2>

                  <p>
                    Hãy tạo hoặc phân công lớp trước khi lập
                    sơ đồ chỗ ngồi.
                  </p>
                </article>
              ) : (
                <article className="panel seating-plan">
                  <div className="seating-plan-heading">
                    <div>
                      <span>LỚP ĐANG XEM</span>
                      <h2>{seatingClass.name}</h2>
                    </div>

                    <strong>
                      {seatingStudents.length} học viên
                    </strong>
                  </div>

                  <div className="seating-board">
                    BẢNG LỚP
                  </div>

                  {seatingStudents.length === 0 ? (
                    <div className="seating-empty">
                      <Armchair size={32} />
                      <p>Lớp này chưa có học viên.</p>
                    </div>
                  ) : (
                    <div className="seating-grid">
                      {seatingStudents.map((student, index) => (
                        <div
                          className="seat-card"
                          key={student.id}
                        >
                          <span className="seat-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <Armchair size={20} />

                          <div>
                            <strong>{student.fullName}</strong>
                            <small>{student.studentCode}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )}
            </section>
          )}
          {activeView === "diligence" && (
            <section className="module-view">
              <div className="module-heading">
                <div>
                  <span className="eyebrow">THEO DÕI CHUYÊN CẦN</span>

                  <h1>
                    {classes.find(
                      (item) => item.id === selectedDiligenceClassId,
                    )?.name ?? "Chuyên cần"}
                  </h1>

                  <p>Điểm lễ và số buổi vắng giáo lý của từng học viên.</p>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActiveView("classes")}
                >
                  Quay lại lớp giáo lý
                </button>
              </div>

              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Quy tắc chuyên cần</h2>
                    <p>
                      Điểm lễ: cộng tổng số ngày tham dự lễ vào thứ Năm,
                      thứ Sáu, thứ Bảy và Chủ nhật; yêu cầu 2 điểm mỗi tuần.
                    </p>

                    <p>
                      Điểm lễ cộng thêm được bù cho các buổi lễ còn thiếu.
                    </p>

                    <p>
                      Giáo lý: tính cả vắng có phép và không phép;
                      vắng từ 6 buổi là vượt giới hạn.
                    </p>
                  </div>
                </div>
              </article>
            </section>
          )}
          {activeView === "attendance" && (
            <CcamsAttendance />
          )}

          {(activeView === "sacraments" || activeView === "reports" || activeView === "settings") && (
            <section className="module-view">
              <div className="module-heading">
                <div>
                  <span className="eyebrow">GIÁO LÝ HUB</span>
                  <h1>{activeView === "sacraments" ? "Theo dõi Bí tích" : activeView === "reports" ? "Báo cáo và thống kê" : "Cài đặt hệ thống"}</h1>
                  <p>{activeView === "sacraments" ? "Lưu tiến trình và chứng nhận Bí tích của từng học viên." : activeView === "reports" ? "Tổng hợp số liệu học viên, chuyên cần và kết quả niên khóa." : "Thiết lập giáo xứ, niên khóa và quyền sử dụng."}</p>
                </div>
              </div>
              <div className="feature-grid">
                {featureSets[activeView].map((feature) => {
                  const FeatureIcon = feature.icon;
                  return <button className="feature-card" key={feature.title}><span><FeatureIcon size={22} /></span><div><strong>{feature.title}</strong><small>{feature.caption}</small></div><ChevronRight size={18} /></button>;
                })}
              </div>
              <article className="panel roadmap-card"><span className="roadmap-icon"><Check size={22} /></span><div><h2>Giao diện phân hệ đã sẵn sàng</h2><p>Chức năng lưu thật sẽ được kích hoạt khi kết nối cơ sở dữ liệu ở giai đoạn tiếp theo.</p></div><button className="secondary-button" onClick={() => setActiveView("dashboard")}>Về tổng quan</button></article>
            </section>
          )}
        </div>
      </main>

      {showAddStudent && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAddStudent(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-student-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="modal-icon"><UserPlus size={21} /></span><div><h2 id="add-student-title">Thêm học viên mới</h2><p>Nhập thông tin cơ bản để tạo hồ sơ.</p></div></div>
              <button className="icon-button" aria-label="Đóng" onClick={() => setShowAddStudent(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddStudent}>
              <label>Họ và tên<input required placeholder="Ví dụ: Nguyễn Minh Anh" /></label>
              <div className="form-row">
                <label>Ngày sinh<input required type="date" /></label>
                <label>Giới tính<select defaultValue=""><option value="" disabled>Chọn</option><option>Nam</option><option>Nữ</option></select></label>
              </div>
              <label>Lớp giáo lý<select required defaultValue=""><option value="" disabled>Chọn lớp</option><option>Khai Tâm 2</option><option>Rước Lễ 1B</option><option>Thêm Sức 1A</option><option>Thêm Sức 2A</option></select></label>
              <label>Họ tên phụ huynh<input required placeholder="Người liên hệ chính" /></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowAddStudent(false)}>Hủy</button><button type="submit" className="primary-button"><Plus size={17} /> Thêm học viên</button></div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  );
}
