"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/constants/routes";
import { LoadingSpinner, EyeIcon, EyeOffIcon } from "@/components/ui/icons";

type PageState = "loading" | "set-password" | "success" | "error";

export default function AcceptInvitePage() {
  const router = useRouter();
  const supabase = createClient();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    async function handleInviteToken() {
      // First check if there's already an active session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUserEmail(session.user.email ?? "");
        setPageState("set-password");
        return;
      }

      // Extract tokens from URL hash (Supabase puts them there for invite links)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (accessToken && refreshToken && type === "invite") {
        // Manually exchange the tokens for a session
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (data.session?.user && !error) {
          setUserEmail(data.session.user.email ?? "");
          setPageState("set-password");
          // Clean the hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
      }

      // No valid token found
      setPageState("error");
    }

    handleInviteToken();
  }, [supabase.auth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      if (updateError.message.includes("does not exist")) {
        setError("La sesion ha expirado. Solicita una nueva invitacion.");
      } else {
        setError(updateError.message);
      }
      setSubmitting(false);
      return;
    }

    setPageState("success");
    setTimeout(() => {
      router.push(ROUTES.DEVICES);
      router.refresh();
    }, 2000);
  }

  return (
    <div className="flex flex-col items-center">
      {/* Logo */}
      <div className="mb-10">
        <Image
          src="/sax-blanco.webp"
          alt="SAX Soluciones Analiticas"
          width={160}
          height={64}
          priority
          className="h-auto w-40"
        />
      </div>

      {/* Card */}
      <div className="w-full rounded-2xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl">
        {pageState === "loading" && <LoadingState />}
        {pageState === "error" && <ErrorState />}
        {pageState === "success" && <SuccessState />}
        {pageState === "set-password" && (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Bienvenido
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Configura tu contrasena para acceder a la plataforma
              </p>
              {userEmail && (
                <p className="mt-3 rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300">
                  {userEmail}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-gray-300"
                >
                  Nueva contrasena
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimo 8 caracteres"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-red-500/50 focus:bg-white/8 focus:ring-2 focus:ring-red-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-200"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1.5 block text-sm font-medium text-gray-300"
                >
                  Confirmar contrasena
                </label>
                <div className="relative">
                  <input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repite la contrasena"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-red-500/50 focus:bg-white/8 focus:ring-2 focus:ring-red-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-200"
                  >
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <PasswordStrength password={password} />
              )}

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    Configurando...
                  </span>
                ) : (
                  "Crear contrasena"
                )}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-gray-600">
        SAX Soluciones Analiticas SPA
      </p>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ caracteres", met: password.length >= 8 },
    { label: "Una mayuscula", met: /[A-Z]/.test(password) },
    { label: "Un numero", met: /[0-9]/.test(password) },
  ];

  const metCount = checks.filter((c) => c.met).length;
  const barColor =
    metCount === 3
      ? "bg-emerald-500"
      : metCount >= 2
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < metCount ? barColor : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {checks.map((check) => (
          <span
            key={check.label}
            className={`text-xs ${
              check.met ? "text-emerald-400" : "text-gray-600"
            }`}
          >
            {check.met ? "✓" : "○"} {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="mb-4">
        <LoadingSpinner />
      </div>
      <p className="text-sm text-gray-400">Verificando invitacion...</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <svg
          className="h-6 w-6 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-white">
        Enlace invalido
      </h2>
      <p className="text-sm text-gray-400">
        Este enlace de invitacion es invalido o ha expirado.
        <br />
        Solicita una nueva invitacion al administrador.
      </p>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
        <svg
          className="h-6 w-6 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-white">
        Cuenta configurada
      </h2>
      <p className="text-sm text-gray-400">
        Redirigiendo al dashboard...
      </p>
    </div>
  );
}
