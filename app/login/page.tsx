"use client";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useState,
  type SyntheticEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Phone,
  ShieldCheck,
} from "lucide-react";
import styles from "./login.module.css";
type LoginResponse = {
  success: boolean;
  message: string;
  account?: {
    id: string;
    phone: string;
    email: string;
    role: string;
  };
};
function ParishLogo() {
  return (
    <span className={styles.logo}>
      <Image
        src="/images/tntt.jpg"
        alt="Logo Đoàn Thiếu Nhi Thánh Thể Giáo xứ Biên Hòa"
        width={70}
        height={70}
        priority
      />
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
  const rememberedPhone = localStorage.getItem("rememberPhone");

  if (!rememberedPhone) return;

  const timeoutId = window.setTimeout(() => {
    setPhone(rememberedPhone);
    setRemember(true);
  }, 0);

  return () => window.clearTimeout(timeoutId);
}, []);

async function handleLogin(event: SyntheticEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");

  const normalizedPhone = phone.trim();

  if (!normalizedPhone || !password) {
    setError("Vui lòng nhập đầy đủ số điện thoại và mật khẩu.");
    return;
  }

  if (!/^0\d{9}$/.test(normalizedPhone)) {
    setError(
      "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.",
    );
    return;
  }

  setIsSubmitting(true);

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        password,
      }),
    });

    const data = (await response.json()) as LoginResponse;

    if (!response.ok) {
      setError(data.message || "Không thể đăng nhập.");
      return;
    }

    if (remember) {
      localStorage.setItem("rememberPhone", normalizedPhone);
    } else {
      localStorage.removeItem("rememberPhone");
    }

    router.push("/dashboard");
    router.refresh();
  } catch {
    setError(
      "Không thể kết nối với máy chủ. Vui lòng thử lại.",
    );
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <main className={styles.loginPage}>
      <section className={styles.introduction}>
        <div className={styles.introductionContent}>
          <div className={styles.brand}>
            <ParishLogo />

            <div>
              <strong>Giáo Lý Hub</strong>
              <span>Giáo xứ Biên Hoà</span>
            </div>
          </div>

          <div className={styles.welcome}>
            <span className={styles.eyebrow}>HỆ THỐNG QUẢN LÝ GIÁO LÝ NỘI BỘ GIÁO XỨ BIÊN HOÀ</span>

            <h1>
              Đồng hành và chăm sóc
              <br />
              hành trình đức tin.
            </h1>

            <p>
              Quản lý học viên, lớp học, điểm danh và hồ sơ Bí tích
              trong cùng một hệ thống.
            </p>
          </div>

          <div className={styles.feature}>
            <span>
              <ShieldCheck size={21} />
            </span>

            <div>
              <strong>Dữ liệu được quản lý an toàn</strong>
              <p>Chỉ người có tài khoản được cấp quyền mới có thể truy cập.</p>
            </div>
          </div>
        </div>

        <div className={styles.decorativeCircleOne} />
        <div className={styles.decorativeCircleTwo} />
      </section>

      <section className={styles.formSection}>
        <div className={styles.mobileBrand}>
          <ParishLogo />

          <div>
            <strong>Giáo Lý Hub</strong>
            <span>Giáo xứ Biên Hoà</span>
          </div>
        </div>

        <div className={styles.loginCard}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>CHÀO MỪNG TRỞ LẠI</span>
            <h2>Đăng nhập hệ thống</h2>
            <p>Nhập thông tin tài khoản để tiếp tục quản lý giáo lý.</p>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
            <label className={styles.formGroup}>
              <span>Số điện thoại</span>

              <div className={styles.inputWrapper}>
                <Phone size={18} />

                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  placeholder="Ví dụ: 0901234567"
                  autoComplete="tel"
                  maxLength={10}
                  required
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
            </label>

            <label className={styles.formGroup}>
              <span>Mật khẩu</span>

              <div className={styles.inputWrapper}>
                <LockKeyhole size={18} />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                />

                <button
                  type="button"
                  className={styles.passwordButton}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <div className={styles.formOptions}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>Ghi nhớ số điện thoại</span>
              </label>

              <button type="button" className={styles.forgotPassword}>
                Quên mật khẩu?
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Đang đăng nhập..."
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className={styles.support}>
            Bạn chưa có tài khoản?{" "}
            <Link href="/register">Đăng ký tại đây</Link>
          </p>
        </div>

        <p className={styles.copyright}>
          © 2026 Giáo Lý Hub · Giáo xứ Biên Hoà
        </p>
      </section>
    </main>
  );
}