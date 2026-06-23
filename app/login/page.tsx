"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SkinSwitcher } from "@/components/skin-switcher";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ssoEmail, setSsoEmail] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isRegister) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid credentials");
    } else {
      router.push("/");
    }
  }

  async function handleSso(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const result = await signIn("sso", {
      email: ssoEmail,
      redirect: false,
    });

    if (result?.error) {
      setError("SSO sign-in failed");
    } else {
      router.push("/");
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--body)",
    fontSize: 15,
    padding: "11px 14px",
    border: "var(--card-border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--bg)",
    color: "var(--ink)",
    outline: "none",
    width: "100%",
    marginTop: 4,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--mono)",
    fontSize: "11px",
    color: "var(--muted)",
    letterSpacing: ".06em",
    textTransform: "uppercase",
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="absolute top-4 right-6">
        <SkinSwitcher />
      </div>

      <div
        className="w-full max-w-md p-8"
        style={{
          background: "var(--card)",
          border: "var(--card-border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <h1
          className="mb-6 text-center"
          style={{
            fontFamily: "var(--display)",
            fontWeight: 800,
            fontStyle: "var(--hi-style)",
            fontSize: 24,
            letterSpacing: "var(--hi-spacing)",
            textTransform: "var(--case)" as React.CSSProperties["textTransform"],
            color: "var(--ink)",
          }}
        >
          {isRegister ? "Create Account" : "Sign In"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full cursor-pointer transition-opacity hover:opacity-90"
            style={{
              fontFamily: "var(--display)",
              fontWeight: 800,
              fontSize: 15,
              padding: "12px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "var(--on-accent)",
            }}
          >
            {isRegister ? "Register" : "Sign In"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: ".06em", textTransform: "uppercase" }}>
            or
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        <form onSubmit={handleSso} className="space-y-3">
          <div>
            <label style={labelStyle}>Corporate Email (SSO)</label>
            <input
              type="email"
              value={ssoEmail}
              onChange={(e) => setSsoEmail(e.target.value)}
              placeholder="you@company.com"
              style={inputStyle}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full cursor-pointer transition-opacity hover:opacity-90"
            style={{
              fontFamily: "var(--display)",
              fontWeight: 800,
              fontSize: 15,
              padding: "12px",
              border: "var(--card-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          >
            Sign in with Company SSO
          </button>
        </form>

        <p
          className="mt-4 text-center text-sm"
          style={{ fontFamily: "var(--body)", color: "var(--muted)" }}
        >
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="cursor-pointer"
            style={{
              fontFamily: "var(--body)",
              fontWeight: 600,
              color: "var(--accent)",
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            {isRegister ? "Sign In" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
