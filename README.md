# Giáo Lý Hub

Website quản lý giáo lý nội bộ dành cho Giáo xứ Biên Hòa, được xây dựng bằng Next.js, TypeScript và Google Sheets.

## Chức năng

- Đăng ký tài khoản giáo lý viên, chờ quản trị viên phê duyệt.
- Đăng nhập và đăng xuất bằng phiên JWT trong HTTP-only cookie.
- Băm mật khẩu bằng bcrypt trước khi lưu.
- Phân quyền Admin và Giáo lý viên.
- Đọc danh sách lớp, học viên và phân công giáo lý viên từ Google Sheets.
- Tìm kiếm học viên theo tên, lớp và phụ huynh.
- Nhập học viên từ Excel `.xlsx`, có kiểm tra và xem trước trước khi lưu.
- Hiển thị sơ đồ chỗ ngồi theo học viên của từng lớp.
- API tra cứu điểm danh từ CCAMS.
- Giao diện responsive cho máy tính và điện thoại.

## Trạng thái triển khai

| Chức năng | Trạng thái |
|---|---|
| Đăng ký, đăng nhập, đăng xuất | Đã kết nối dữ liệu |
| Phân quyền Admin/Giáo lý viên | Đã triển khai cho dashboard và nhập Excel |
| Danh sách lớp, học viên | Đã đọc từ Google Sheets |
| Nhập học viên bằng Excel | Đã lưu vào Google Sheets |
| Sơ đồ chỗ ngồi | Hiển thị theo danh sách học viên; chưa lưu vị trí tùy chỉnh |
| Tra cứu điểm danh CCAMS | API đã kết nối; đang tích hợp giao diện |
| Thêm học viên thủ công, tạo lớp | Đang hoàn thiện chức năng lưu |
| Điểm danh trực tiếp | Giao diện; chưa lưu dữ liệu thật |
| Bí tích, báo cáo, cài đặt | Giao diện; đang phát triển |

> Một số biểu đồ, thống kê, lịch học và thông tin buổi học vẫn sử dụng dữ liệu mẫu.

## Phân quyền

| Vai trò | Phạm vi dữ liệu |
|---|---|
| Admin | Xem toàn bộ lớp đang hoạt động và học viên; nhập Excel cho mọi lớp hợp lệ |
| Giáo lý viên | Chỉ xem và nhập Excel cho lớp được phân công |

Giáo lý viên cần được liên kết với hồ sơ `TEACHER` và phân công lớp trong `TEACHER_CLASS`.

API CCAMS hiện sử dụng số điện thoại tra cứu chung được cấu hình ở máy chủ. Việc giới hạn dữ liệu CCAMS theo lớp của từng giáo lý viên cần được hoàn thiện riêng.

## Công nghệ

- Next.js 16 — App Router
- React 19
- TypeScript
- CSS và Tailwind CSS 4
- Google Sheets API
- `jose` — tạo và xác minh JWT
- `bcryptjs` — băm mật khẩu
- `zod` — kiểm tra dữ liệu đầu vào
- `read-excel-file` — đọc Excel
- `lucide-react` — icon

## Cấu trúc project

```text
app/
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── logout/route.ts
│   │   └── register/route.ts
│   ├── ccams/attendance/route.ts
│   ├── dashboard/route.ts
│   └── students/import/route.ts
├── dashboard/page.tsx
├── login/
├── register/
├── globals.css
├── layout.tsx
└── page.tsx

components/
└── student-excel-import.tsx

lib/
├── access-control.ts
├── google-sheets.ts
├── session.ts
├── student-import.ts
├── student-import-excel.ts
└── student-import-service.ts

public/
└── images/
```

## Dữ liệu Google Sheets

Các tab chính:

| Tab | Nội dung |
|---|---|
| `ACCOUNT` | Tài khoản, mật khẩu đã băm, vai trò và trạng thái |
| `TEACHER` | Hồ sơ giáo lý viên liên kết với tài khoản |
| `CLASS` | Lớp, niên khóa, lịch học và phòng học |
| `TEACHER_CLASS` | Phân công giáo lý viên vào lớp |
| `STUDENT` | Hồ sơ học viên và lớp đang theo học |

Khóa liên kết:

- `TEACHER.account_id` → `ACCOUNT.id`
- `TEACHER_CLASS.teacher_id` → `TEACHER.id`
- `TEACHER_CLASS.class_id` → `CLASS.id`
- `STUDENT.class_id` → `CLASS.id`

Tài khoản đăng ký mới có `role = teacher` và `status = pending`. Quản trị viên phê duyệt bằng cách chuyển trạng thái thành `active` trong Google Sheets.

## Cài đặt và chạy

Cài Node.js phù hợp với phiên bản Next.js trong `package.json`.

```bash
git clone https://github.com/pb110105/GiaoLy.git
cd GiaoLy
npm install
```

Tạo file `.env.local` tại thư mục gốc:

```env
GOOGLE_SHEET_ID=your_spreadsheet_id
GOOGLE_SHEET_NAME=ACCOUNT
GOOGLE_APPLICATION_CREDENTIALS=C:/duong-dan/service-account.json

SESSION_SECRET=chuoi_bi_mat_dai_va_ngau_nhien

CCAMS_BASE_URL=https://dia-chi-api-ccams/
CCAMS_LOOKUP_PHONE=so_dien_thoai_tra_cuu
```

Lưu ý:

- Chia sẻ Google Sheets cho email của Service Account với quyền chỉnh sửa.
- `GOOGLE_APPLICATION_CREDENTIALS` phải trỏ đến file JSON tồn tại trên máy.
- `CCAMS_BASE_URL` phải là địa chỉ API đã kiểm tra trả về JSON, không phải địa chỉ giao diện trả về HTML.
- Không chia sẻ giá trị thật của các biến bí mật.

Khởi động:

```bash
npm run dev
```

Mở:

```text
http://localhost:3000
```

Kiểm tra code và bản production:

```bash
npm run lint
npm run build
npm run start
```

## Nhập học viên bằng Excel

- Định dạng được hỗ trợ: `.xlsx`.
- Dung lượng tối đa: 2 MB.
- Chọn lớp và niên khóa trước khi nhập.
- Xem trước kết quả kiểm tra trước khi xác nhận.
- Sau khi xác nhận, các dòng hợp lệ được lưu vào tab `STUDENT`.
- Máy chủ kiểm tra quyền truy cập lớp trước khi lưu.

## API chính

| Endpoint | Phương thức | Chức năng |
|---|---|---|
| `/api/auth/register` | POST | Đăng ký tài khoản |
| `/api/auth/login` | POST | Đăng nhập |
| `/api/auth/logout` | POST | Đăng xuất |
| `/api/dashboard` | GET | Lấy lớp, học viên theo quyền tài khoản |
| `/api/students/import` | POST | Xem trước và lưu học viên từ Excel |
| `/api/ccams/attendance` | GET | Tra cứu điểm danh CCAMS |

Bộ lọc của API CCAMS:

```text
date      Ngày tra cứu, dạng YYYY-MM-DD
loai      Loại điểm danh
nienhoc   Mã niên học CCAMS
khoi_lop  Mã khối hoặc lớp CCAMS
search    Từ khóa tìm kiếm
```

Hiện API CCAMS lấy trang đầu tiên của kết quả. Cần bổ sung xử lý phân trang nếu muốn lấy toàn bộ dữ liệu khi kết quả có nhiều trang.

## Triển khai

Mã nguồn được lưu trên GitHub. Website cần môi trường chạy Next.js phía máy chủ, chẳng hạn Vercel; không phù hợp với GitHub Pages khi giữ các API và chức năng đăng nhập hiện tại.

Trước khi triển khai:

1. Kiểm tra `npm run build` chạy thành công.
2. Khai báo các biến môi trường trên nền tảng hosting.
3. Chuyển xác thực Google Sheets từ đường dẫn file JSON cục bộ sang cách cấu hình phù hợp với hosting.
4. Kiểm tra đăng nhập, phân quyền, nhập Excel và kết nối CCAMS.
5. Tắt hoặc bảo vệ API kiểm thử và thông tin debug trước khi sử dụng chính thức.

## Bảo mật

- Không commit `.env.local` hoặc file JSON của Service Account.
- Không lưu private key hay session secret trực tiếp trong code.
- Không đưa dữ liệu học viên thật vào repository public.
- Không lưu mật khẩu dạng văn bản.
- Kiểm tra quyền ở máy chủ, không chỉ ẩn nút trên giao diện.
- Thu hồi và thay khóa nếu thông tin xác thực từng bị công khai.

## Cập nhật mã nguồn

```bash
git add .
git commit -m "Mo ta noi dung cap nhat"
git push
```

Nếu đã cấu hình tự động triển khai từ GitHub, bản cập nhật sẽ được triển khai sau khi push thành công.