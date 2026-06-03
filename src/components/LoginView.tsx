import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import AppLogo from "../assets/AppLogo";
import { useTranslationMessages } from "../contexts/I18nContext";
import { login } from "../services/auth";
import type { AuthUser } from "../types";

interface LoginViewProps {
  onSuccess: (user: AuthUser) => void;
}

const fieldClass =
  "box-border h-11 w-full rounded-lg border border-white/10 bg-surface px-3 text-sm text-white outline-none transition focus:border-accent/50";

export function LoginView({ onSuccess }: LoginViewProps) {
  const t = useTranslationMessages().auth;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password || loading) return;

    setLoading(true);
    setError("");

    try {
      const user = await login(username, password);
      onSuccess(user);
    } catch (e) {
      const message =
        typeof e === "string"
          ? e
          : e instanceof Error
            ? e.message
            : t.loginFailed;
      setError(message || t.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen min-h-0 items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121212] p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <AppLogo className="mb-4 h-14 w-14 rounded-2xl" />
          <h1 className="text-xl font-semibold text-white">{t.title}</h1>
          <p className="mt-2 text-sm text-text-muted">{t.subtitle}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm text-text-muted">{t.username}</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t.usernamePlaceholder}
              autoComplete="username"
              className={fieldClass}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-text-muted">{t.password}</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                autoComplete="current-password"
                className={`${fieldClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition hover:text-white"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? t.loggingIn : t.login}
          </button>
        </form>
      </div>
    </div>
  );
}
