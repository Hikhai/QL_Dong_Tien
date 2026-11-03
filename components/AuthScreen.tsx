"use client";

import { useState } from "react";
import { Alert, Button, Field, cn, fieldClass } from "@/components/ui";
import { passwordError, usernameError } from "@/lib/state";

export function AuthScreen({
  onSubmit,
}: {
  onSubmit: (mode: "login" | "register", username: string, password: string) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const nameIssue = usernameError(username);
    if (nameIssue) {
      setError(nameIssue);
      return;
    }
    const passIssue = passwordError(password);
    if (passIssue) {
      setError(passIssue);
      return;
    }
    if (mode === "register" && password !== again) {
      setError("Mật khẩu nhập lại chưa khớp.");
      return;
    }
    setPending(true);
    const message = await onSubmit(mode, username, password);
    setPending(false);
    if (message) setError(message);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Thu Chi</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">Sổ riêng cho từng người</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Mỗi tài khoản có một sổ dòng tiền, công nợ và ngân sách. Bạn bè đăng ký tên riêng thì không thấy dữ liệu của nhau.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-stone-200/70 p-1">
        {(
          [
            ["login", "Đăng nhập"],
            ["register", "Tạo tài khoản"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError("");
            }}
            className={cn("rounded-xl py-2 text-sm font-semibold", mode === value ? "bg-white shadow-sm" : "text-[var(--muted)]")}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Tên đăng nhập" hint="Chữ thường, số, dấu gạch dưới. Ví dụ: minh_nguyen">
          <input
            className={fieldClass}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>
        <Field label="Mật khẩu">
          <input
            className={fieldClass}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {mode === "register" ? (
          <Field label="Nhập lại mật khẩu">
            <input className={fieldClass} type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} />
          </Field>
        ) : null}
        {error ? <Alert>{error}</Alert> : null}
        <Button className="w-full" type="submit" disabled={pending}>
          {pending ? "Đang lưu…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </Button>
      </form>
    </div>
  );
}
