"use client";

import * as React from "react";
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface LoginGateViewProps {
  onAuthenticate: (input: {
    email: string;
    name: string;
    password: string;
    workspaceName: string;
  }) => Promise<void>;
  externalError?: string | null;
}

export function LoginGateView({ onAuthenticate, externalError }: LoginGateViewProps) {
  const [adminId, setAdminId] = React.useState("admin@socialstudio.local");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId.trim()) {
      setLocalError("Please enter your Admin ID or Email.");
      return;
    }
    if (!password) {
      setLocalError("Please enter your Admin Password.");
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);
    try {
      await onAuthenticate({
        email: adminId.trim(),
        name: "Studio Admin",
        password,
        workspaceName: "",
      });
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "Invalid admin credentials. Please verify your ID and password."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDefaults = () => {
    setAdminId("admin@socialstudio.local");
    setPassword("admin123");
    setLocalError(null);
  };

  const activeError = localError || externalError;

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-br from-slate-50 via-surface-secondary to-slate-100 p-4 text-text-primary dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-3xl border border-border-subtle/80 bg-surface-primary/95 p-8 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex items-center gap-3">
              <span className="relative inline-flex h-10 w-10 items-center justify-center">
                <span className="h-5 w-5 rotate-45 rounded-[5px] bg-action-primary-bg shadow-sm" />
                <span className="-ml-2 h-5 w-5 rotate-45 rounded-[5px] bg-accent-primary/85 shadow-sm" />
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-text-primary">
                Social Studio
              </span>
            </div>

            <Badge variant="warning" className="mb-3 px-3 py-1 font-semibold flex items-center gap-1.5">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Studio Locked • Authentication Required
            </Badge>

            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              Admin Login Gate
            </h1>
            <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
              No unauthorized access permitted. Multiple team members can log in concurrently using this single admin credential.
            </p>
          </div>

          {/* Error Banner */}
          {activeError ? (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-2xl border border-status-danger-border bg-status-danger-bg p-3.5 text-xs text-status-danger-fg"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 leading-snug">{activeError}</div>
            </div>
          ) : null}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-id" className="text-xs font-semibold text-text-primary">
                Admin ID / Email
              </Label>
              <Input
                id="admin-id"
                type="text"
                autoComplete="username"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="admin@socialstudio.local or admin"
                required
                className="h-11 rounded-2xl px-3.5 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-password" className="text-xs font-semibold text-text-primary">
                Admin Password
              </Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  className="h-11 rounded-2xl pl-3.5 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              className="mt-2 h-11 rounded-2xl font-semibold shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>Unlock Studio</span>
                </>
              )}
            </Button>
          </form>

          {/* Quick Credential Hint / Multi-Login Info */}
          <div className="mt-6 rounded-2xl border border-border-subtle bg-surface-secondary/60 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-accent-primary shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-xs text-text-secondary leading-relaxed">
                <span className="font-semibold text-text-primary">
                  Multi-User Admin Access
                </span>
                <span>
                  Multiple team members can log in simultaneously using the configured Admin credentials without kicking each other out.
                </span>
                <span className="mt-1 font-mono text-[11px] text-text-tertiary">
                  Default ID: admin@socialstudio.local | Password: admin123
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={handleFillDefaults}
                className="text-[11px] font-semibold text-accent-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Fill default credentials
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}