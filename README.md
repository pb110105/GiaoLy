# Website quản lý học viên Giáo lý

Giao diện quản lý học viên dành cho Ban Giáo lý, được xây dựng bằng Next.js và TypeScript.

## Chức năng giao diện hiện có

- Dashboard tổng quan số lượng học viên, lớp học và tỷ lệ chuyên cần.
- Danh sách, tìm kiếm và lọc học viên.
- Biểu mẫu thêm học viên.
- Quản lý lớp giáo lý và tiến độ chương trình.
- Điểm danh theo từng buổi học.
- Giao diện theo dõi Bí tích, báo cáo và cài đặt.
- Responsive cho máy tính, máy tính bảng và điện thoại.

> Hiện tại project đang sử dụng dữ liệu mẫu ở phía giao diện. Database và đăng nhập sẽ được tích hợp trong giai đoạn tiếp theo.

## Công nghệ

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React Icons

## Chạy project trên máy

Yêu cầu cài đặt Node.js 20 trở lên.

```bash
npm install
npm run dev
```

Sau đó mở trình duyệt tại:

```text
http://localhost:3000
```

## Kiểm tra bản build

```bash
npm run build
npm run start
```

## Đưa project lên GitHub

Tạo một repository trống trên GitHub, sau đó mở Terminal tại thư mục project và chạy:

```bash
git init
git add .
git commit -m "Initial commit: giao dien quan ly giao ly"
git branch -M main
git remote add origin https://github.com/TEN_GITHUB/TEN_REPOSITORY.git
git push -u origin main
```

Thay `TEN_GITHUB` và `TEN_REPOSITORY` bằng thông tin repository của bạn.

## Cấu trúc chính

```text
app/
├── globals.css     # Toàn bộ style và responsive
├── layout.tsx      # Layout, metadata và font chữ
└── page.tsx        # Giao diện và tương tác của website
public/
└── favicon.svg
```

## Giai đoạn tiếp theo

- Kết nối Supabase PostgreSQL.
- Xây dựng đăng nhập và phân quyền.
- Thiết kế các bảng học viên, phụ huynh, lớp học, điểm danh và Bí tích.
- Thay dữ liệu mẫu bằng dữ liệu thật.
- Triển khai website từ repository GitHub.
