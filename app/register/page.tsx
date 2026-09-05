"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
} from "lucide-react";
import styles from "./register.module.css";

type RegisterResponse = {
  success: boolean;
  message: string;
  errors?: Array<{
    field?: string | number;
    message: string;
  }>;
};

export default function RegisterPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsSuccess(false);

    if (password !== confirmPassword) {
      setMessage("Mật khẩu nhập lại không khớp.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          email,
          password,
        }),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        const validationMessage = data.errors
          ?.map((error) => error.message)
          .join(" ");

        setMessage(validationMessage || data.message);
        return;
      }

      setIsSuccess(true);
      setMessage(data.message);

      setPhone("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      setMessage(
        "Không thể kết nối với máy chủ. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Đăng ký tài khoản</h1>

        <p className={styles.description}>
          Dành cho Giáo Lý Viên Giáo Xứ Biên Hoà
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="phone">Số điện thoại</label>

            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="Ví dụ: 0901234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">Gmail</label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Mật khẩu</label>

            <div className={styles.passwordContainer}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Ít nhất 8 ký tự"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-label={
                showPassword
                  ? "Ẩn mật khẩu"
                  : "Hiện mật khẩu"
                }
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
            </button>
          </div>
        </div>
          <div className={styles.field}>
            <label htmlFor="confirmPassword">
              Nhập lại mật khẩu
            </label>

          <div className={styles.passwordContainer}>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              minLength={8}
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-label={
                showConfirmPassword
                  ? "Ẩn mật khẩu nhập lại"
                  : "Hiện mật khẩu nhập lại"
              }
              onClick={() =>
                setShowConfirmPassword(
                  (current) => !current,
                )
              }
            >
              {showConfirmPassword ? (
                <EyeOff size={21} />
              ) : (
                <Eye size={21} />
              )}
            </button>
          </div>
          </div>
          {message && (
            <p
              className={
                isSuccess
                  ? styles.successMessage
                  : styles.errorMessage
              }
              aria-live="polite"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        <p className={styles.loginLink}>
          Đã có tài khoản?{" "}
          <Link href="/login">Đăng nhập</Link>
        </p>
      </section>
    </main>
  );
}