import React, { useState } from "react";
import { Lock, Mail, User, Phone, Loader2, ShieldCheck } from "lucide-react";
import { apiRequest, saveSession } from "./api";

const palette = {
  bg: "#F4F6F5",
  surface: "#FFFFFF",
  ink: "#14231F",
  inkMuted: "#5B6B67",
  primary: "#0E5C56",
  primaryTint: "#E3EEEC",
  line: "#E3E7E4",
  danger: "#B3432E",
};

function Field({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: palette.inkMuted }} />
      <input
        {...props}
        required
        className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium outline-none"
        style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
      />
    </div>
  );
}

/**
 * variant: "customer" | "admin"
 * onSuccess(user): called once login/register succeeds.
 */
export default function AuthScreen({ variant = "customer", onSuccess }) {
  const isAdmin = variant === "admin";
  const [mode, setMode] = useState("login"); // "login" | "register" (register is customer-only)
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register" ? form : { email: form.email, password: form.password };
      const data = await apiRequest(path, { method: "POST", body });
      if (isAdmin && data.user.role !== "admin") {
        throw new Error("This account doesn't have admin access.");
      }
      saveSession(data.token, data.user);
      onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ backgroundColor: palette.bg, fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}
      >
        <div className="flex flex-col items-center mb-6 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{ backgroundColor: isAdmin ? palette.ink : palette.primary }}
          >
            {isAdmin ? <ShieldCheck size={22} color="#fff" /> : <Lock size={20} color="#fff" />}
          </div>
          <h1 className="text-xl font-extrabold" style={{ fontFamily: "'Cairo', sans-serif", color: palette.ink }}>
            {isAdmin ? "Admin Login" : mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-xs mt-1" style={{ color: palette.inkMuted }}>
            {isAdmin ? "Manzili operations dashboard" : "Book trusted home cleaning across Saudi Arabia"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {!isAdmin && mode === "register" && (
            <>
              <Field icon={User} placeholder="Full name" value={form.name} onChange={update("name")} />
              <Field icon={Phone} placeholder="Phone number" value={form.phone} onChange={update("phone")} />
            </>
          )}
          <Field
            icon={Mail}
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={update("email")}
          />
          <Field
            icon={Lock}
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={update("password")}
          />

          {error && (
            <p className="text-xs font-medium" style={{ color: palette.danger }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: isAdmin ? palette.ink : palette.primary, color: "#fff" }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        {!isAdmin && (
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="w-full text-center text-xs font-semibold mt-4"
            style={{ color: palette.primary }}
          >
            {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>
        )}

        {isAdmin && (
          <p className="text-center text-[11px] mt-4" style={{ color: palette.inkMuted }}>
            Default seeded login: admin@manzili.sa — change the password after first login.
          </p>
        )}
      </div>
    </div>
  );
}
