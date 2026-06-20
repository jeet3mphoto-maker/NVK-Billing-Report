"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #003887 0%, #1a4fa3 50%, #2e6eca 100%)" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white">
        <Image src="/asa_logo.png" alt="ASA Logo" width={200} height={80} className="mb-8 brightness-0 invert" />
        <h1 className="text-4xl font-bold mb-4 text-center">Billing Intelligence Portal</h1>
        <p className="text-blue-200 text-lg text-center max-w-md">
          Enterprise-grade billing reconciliation, revenue analytics, and compliance tracking for childcare centers.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-md">
          {[
            { label: "Centers", value: "50+" },
            { label: "Families", value: "10K+" },
            { label: "Accuracy", value: "99.9%" },
            { label: "Savings", value: "$2M+" },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-blue-200 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex justify-center mb-6 lg:hidden">
              <Image src="/asa_logo.png" alt="ASA Logo" width={140} height={56} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-500 mb-6 text-sm">Sign in to your billing portal account</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003887] focus:border-transparent transition"
                  placeholder="you@asaind.co.in"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003887] focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: loading ? "#A6A6A6" : "#003887" }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700 font-medium mb-1">Demo Credentials</p>
              <p className="text-xs text-blue-600">admin@asaind.co.in / admin123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
