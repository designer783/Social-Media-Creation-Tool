"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Globe,
  Palette,
  Wand2,
  Radar,
  CalendarClock,
  FileText,
  CheckCircle2,
  FolderArchive,
  Settings,
  Plus,
  Sun,
  Moon,
  UserCheck,
  Sparkles,
  KeyRound,
  LogOut,
  Video,
  Menu,
  X,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Bell,
  ChevronDown,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type {
  StudioModuleId,
  WorkspaceSnapshot,
  BackgroundTaskState,
} from "@/hooks/use-studio-state";
import type { GeminiConnectionScope } from "@/types/domain";

interface AppShellProps {
  activeModule: StudioModuleId;
  onSelectModule: (module: StudioModuleId) => void;
  snapshot: WorkspaceSnapshot | null;
  onSwitchWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onDeleteWorkspace?: (workspaceId: string) => Promise<void>;
  onAuthenticate: (input: {
    email: string;
    name: string;
    password: string;
    workspaceName: string;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
  onConnectGemini: (input: {
    scope: GeminiConnectionScope;
    label: string;
    apiKey: string;
    textModel: string;
    imageModel: string;
  }) => Promise<void>;
  announcement: string;
  backgroundTask: BackgroundTaskState;
  children: React.ReactNode;
}

const NAVIGATION_ITEMS: Array<{
  id: StudioModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "brands", label: "1. Website & Brand", icon: Globe },
  { id: "brand-kits", label: "2. Brand Identity Kit", icon: Palette },
  { id: "studio", label: "3. Post Studio", icon: Wand2 },
  { id: "video-generation", label: "4. Video Studio", icon: Video },
  { id: "blog-studio", label: "5. Blog Studio", icon: BookOpen },
  { id: "approvals", label: "6. Review & Approve", icon: CheckCircle2 },
  { id: "exports", label: "7. Download & Export", icon: FolderArchive },
  { id: "radar", label: "Trend & Brand Radar", icon: Radar },
  { id: "tracker", label: "Social Tracker", icon: CalendarClock },
  { id: "content", label: "SEO Descriptions", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AppShell({
  activeModule,
  onSelectModule,
  snapshot,
  onSwitchWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  onAuthenticate,
  onLogout,
  onConnectGemini,
  announcement,
  backgroundTask,
  children,
}: AppShellProps) {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const [quickSearch, setQuickSearch] = React.useState("");
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [isNewWsOpen, setIsNewWsOpen] = React.useState(false);
  const [newWsName, setNewWsName] = React.useState("");
  const [wsError, setWsError] = React.useState("");

  const [isAuthOpen, setIsAuthOpen] = React.useState(false);
  const [authEmail, setAuthEmail] = React.useState("");
  const [authName, setAuthName] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [authWorkspace, setAuthWorkspace] = React.useState("");
  const [authError, setAuthError] = React.useState("");

  const [isGeminiOpen, setIsGeminiOpen] = React.useState(false);
  const [geminiScope, setGeminiScope] =
    React.useState<GeminiConnectionScope>("user");
  const [geminiLabel, setGeminiLabel] = React.useState("");
  const [geminiKey, setGeminiKey] = React.useState("");
  const [geminiTextModel, setGeminiTextModel] = React.useState("gemini-flash-latest");
  const [geminiImageModel, setGeminiImageModel] = React.useState("auto");
  const [geminiErr, setGeminiErr] = React.useState("");
  const [isSavingGemini, setIsSavingGemini] = React.useState(false);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleCreateWsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newWsName.trim().length < 2) {
      setWsError("Enter a workspace name with at least 2 characters.");
      return;
    }
    setWsError("");
    await onCreateWorkspace(newWsName.trim());
    setNewWsName("");
    setIsNewWsOpen(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) return;
    setAuthError("");
    try {
      await onAuthenticate({
        email: authEmail.trim(),
        name: authName.trim(),
        password: authPassword,
        workspaceName: authWorkspace.trim(),
      });
      setAuthPassword("");
      setIsAuthOpen(false);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Authentication failed."
      );
    }
  };

  const handleQuickAdminSignIn = async () => {
    setAuthError("");
    try {
      await onAuthenticate({
        email: "admin@socialstudio.local",
        name: "Studio Admin",
        password: "admin123",
        workspaceName: "",
      });
      setIsAuthOpen(false);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Admin authentication failed."
      );
    }
  };

  const handleGeminiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (geminiKey.trim().length < 12) {
      setGeminiErr("Enter a valid Gemini API key (at least 12 characters).");
      return;
    }
    setIsSavingGemini(true);
    setGeminiErr("");
    try {
      await onConnectGemini({
        scope: geminiScope,
        label: geminiLabel.trim(),
        apiKey: geminiKey.trim(),
        textModel: geminiTextModel,
        imageModel: geminiImageModel,
      });
      setGeminiKey("");
      setIsGeminiOpen(false);
    } catch (err) {
      setGeminiErr(
        err instanceof Error ? err.message : "Failed to connect Gemini API."
      );
    } finally {
      setIsSavingGemini(false);
    }
  };

  const totalBrands = snapshot?.metrics.totalBrands ?? 0;
  const totalCreatives = snapshot?.metrics.totalCreatives ?? 0;
  const pendingApprovals = snapshot?.metrics.pendingApprovals ?? 0;
  const activeRadarSignals = snapshot?.metrics.activeRadarSignals ?? 0;
  const totalVideos = snapshot?.videoGenerations?.length ?? 0;
  const geminiMeta = snapshot?.activeGeminiMeta;
  const activeNavItem =
    NAVIGATION_ITEMS.find((i) => i.id === activeModule) ?? NAVIGATION_ITEMS[0];

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background text-text-primary lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus:rounded-md focus:bg-action-primary-bg focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-action-primary-fg"
      >
        Skip to main content
      </a>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Persistent Sidebar Navigation (Pillio Soft Airy Sidebar) */}
      <aside
        aria-label="Primary studio navigation"
        className="flex w-full shrink-0 flex-col justify-between border-b border-border-subtle/80 bg-surface-secondary/75 backdrop-blur-md p-4 lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-6"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2.5">
                <span className="relative inline-flex h-8 w-8 items-center justify-center">
                  <span className="h-4 w-4 rotate-45 rounded-[4px] bg-action-primary-bg shadow-xs" />
                  <span className="-ml-1.5 h-4 w-4 rotate-45 rounded-[4px] bg-accent-primary/85 shadow-xs" />
                </span>
                <span className="text-lg font-extrabold tracking-tight text-text-primary">
                  Social Studio
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info" className="lg:hidden">
                  {activeNavItem.label}
                </Badge>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setIsMobileNavOpen((prev) => !prev)}
                  aria-expanded={isMobileNavOpen}
                  aria-label="Toggle navigation menu"
                >
                  {isMobileNavOpen ? (
                    <X className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Menu className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspace-switcher" className="text-xs text-text-secondary">
                Workspace
              </Label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <NativeSelect
                    id="workspace-switcher"
                    value={snapshot?.activeWorkspace.id ?? ""}
                    onChange={(e) => onSwitchWorkspace(e.target.value)}
                    aria-label="Switch active workspace"
                  >
                    {(snapshot?.workspaces ?? []).map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <Dialog open={isNewWsOpen} onOpenChange={setIsNewWsOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="Create new workspace"
                      title="Create new workspace"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    title="Create New Workspace"
                    description="Each workspace keeps its own isolated brands, website images, social posts, and Gemini settings."
                  >
                    <form onSubmit={handleCreateWsSubmit} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="new-ws-name">Workspace Name</Label>
                        <Input
                          id="new-ws-name"
                          value={newWsName}
                          onChange={(e) => setNewWsName(e.target.value)}
                          placeholder="Enter workspace name"
                          hasError={Boolean(wsError)}
                          required
                        />
                        {wsError ? (
                          <p className="text-xs text-status-danger-fg">{wsError}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsNewWsOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                          Create Workspace
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <nav
            aria-label="Studio modules"
            className={`${
              isMobileNavOpen ? "flex" : "hidden"
            } flex-col gap-1 lg:flex`}
          >
            {NAVIGATION_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectModule(item.id);
                    setIsMobileNavOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-10 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13px] transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-surface-primary text-text-primary font-bold shadow-[0_2px_12px_rgba(15,23,42,0.06)] border border-border-subtle"
                      : "text-text-secondary font-medium hover:bg-surface-primary/60 hover:text-text-primary border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-text-primary" : "text-text-muted"
                      }`}
                      aria-hidden={true}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.id === "approvals" && pendingApprovals > 0 ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-surface-primary text-text-primary"
                          : "bg-status-warning-bg text-status-warning-fg"
                      }`}
                    >
                      {pendingApprovals}
                    </span>
                  ) : null}
                  {item.id === "radar" && activeRadarSignals > 0 ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-surface-primary text-text-primary"
                          : "bg-status-info-bg text-status-info-fg"
                      }`}
                    >
                      {activeRadarSignals}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-text-primary">
                  {snapshot?.user.name ?? "Studio Creator"}
                </span>
                {snapshot?.user.isAdmin ? (
                  <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                    ADMIN
                  </Badge>
                ) : null}
              </div>
              <span className="truncate text-xs text-text-muted">
                {snapshot?.user.email ?? "studio@workspace.local"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={
                  theme === "light" ? "Switch to dark theme" : "Switch to light theme"
                }
                title={
                  theme === "light" ? "Switch to dark theme" : "Switch to light theme"
                }
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (window.confirm("Lock studio and log out of the admin session?")) {
                    await onLogout();
                  }
                }}
                aria-label="Lock studio and log out"
                title="Lock studio and log out"
              >
                <LogOut className="h-4 w-4 text-text-tertiary hover:text-status-danger-fg" aria-hidden="true" />
              </Button>

              <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Account sign in or switch user"
                    title="Account sign in or switch user"
                  >
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DialogTrigger>
                <DialogContent
                  title="Sign In or Register Studio Account"
                  description="Each user gets isolated sessions, workspaces, brands, and personal Gemini API connections. Only the Admin account can delete workspaces."
                >
                  <div className="flex flex-col gap-2 rounded-md border border-status-info-border bg-status-info-bg/40 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-text-primary flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-status-info-fg" aria-hidden="true" />
                          <span>Admin Account (Can Delete Any Workspace)</span>
                        </span>
                        <span className="font-mono text-[11px] text-text-secondary">
                          Email: admin@socialstudio.local | Password: admin123
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => void handleQuickAdminSignIn()}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>1-Click Sign In as Admin</span>
                      </Button>
                    </div>
                  </div>
                  <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                    {authError ? (
                      <div
                        role="alert"
                        className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-fg"
                      >
                        {authError}
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="auth-email">Email</Label>
                      <Input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="auth-name">Full Name (for new account)</Label>
                      <Input
                        id="auth-name"
                        type="text"
                        autoComplete="name"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="auth-password">Password</Label>
                      <Input
                        id="auth-password"
                        type="password"
                        autoComplete="current-password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="auth-ws">Initial Workspace Name (Optional)</Label>
                      <Input
                        id="auth-ws"
                        type="text"
                        value={authWorkspace}
                        onChange={(e) => setAuthWorkspace(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await onLogout();
                          setIsAuthOpen(false);
                        }}
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        <span>Reset to Default Session</span>
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setIsAuthOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                          Continue
                        </Button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Pillio-Style Floating Top Search, Quick Pipeline & Profile Header */}
        <header
          aria-label="Creative workflow steps and Gemini status"
          className="flex flex-col gap-3 border-b border-border-subtle/70 bg-background/60 backdrop-blur-md px-4 py-3.5 lg:px-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search & Quick Jump Command Bar */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <div className="flex items-center gap-2.5 rounded-2xl border border-border-subtle bg-surface-primary px-3.5 py-2 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
                <Search className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={quickSearch}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 180)}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Search modules, brands, or tools..."
                  aria-label="Quick search studio modules and brands"
                  className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
                <span className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-surface-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-tertiary">
                  ⌘K
                </span>
                <SlidersHorizontal className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
              </div>

              {isSearchFocused && quickSearch.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 flex flex-col gap-1 rounded-2xl border border-border-subtle bg-surface-primary p-2 shadow-xl">
                  {NAVIGATION_ITEMS.filter((item) =>
                    item.label.toLowerCase().includes(quickSearch.toLowerCase())
                  ).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={() => {
                          onSelectModule(item.id);
                          setQuickSearch("");
                        }}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-secondary cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-accent-primary" />
                          <span>{item.label}</span>
                        </span>
                        <span className="text-[10px] text-text-tertiary">Jump to view</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Status Icons & Pillio User Profile Pill */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onSelectModule("approvals")}
                title="Review & Approve Queue"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-primary text-text-secondary hover:text-text-primary shadow-[0_2px_8px_rgba(15,23,42,0.03)] cursor-pointer"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {pendingApprovals > 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-status-danger-fg ring-2 ring-surface-primary" />
                )}
              </button>

              <Dialog open={isGeminiOpen} onOpenChange={setIsGeminiOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 items-center gap-2 rounded-full border border-border-subtle bg-surface-primary px-3.5 py-1.5 text-left text-xs font-medium shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:bg-surface-secondary cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
                    <span className="hidden sm:inline font-semibold text-text-primary">Gemini API</span>
                    <Badge variant={geminiMeta?.configured ? "success" : "warning"}>
                      {geminiMeta?.configured
                        ? `${geminiMeta.sourceScope === "user" ? "Personal" : geminiMeta.sourceScope === "workspace" ? "Workspace" : "Env"} ••••${geminiMeta.keyLast4}`
                        : "Connect Key"}
                    </Badge>
                  </button>
                </DialogTrigger>
                <DialogContent
                  title="Connect Google Gemini API"
                  description="Connect your own Personal User Key (private to this workspace) or a Workspace Shared Key for your team."
                >
                  <form onSubmit={handleGeminiSubmit} className="flex flex-col gap-4">
                    {geminiErr ? (
                      <div
                        role="alert"
                        className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-fg"
                      >
                        {geminiErr}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="modal-gemini-scope">Connection Scope</Label>
                        <NativeSelect
                          id="modal-gemini-scope"
                          value={geminiScope}
                          onChange={(e) =>
                            setGeminiScope(e.target.value as GeminiConnectionScope)
                          }
                        >
                          <option value="user">Personal User Key (Private to this Workspace)</option>
                          <option value="workspace">Workspace Shared Key (Team Access)</option>
                        </NativeSelect>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="modal-gemini-label">Connection Label</Label>
                        <Input
                          id="modal-gemini-label"
                          value={geminiLabel}
                          onChange={(e) => setGeminiLabel(e.target.value)}
                          placeholder="e.g. My Pro AI Studio Key"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="modal-gemini-text-model">Reasoning & Copy Model</Label>
                        <NativeSelect
                          id="modal-gemini-text-model"
                          value={geminiTextModel}
                          onChange={(e) => setGeminiTextModel(e.target.value)}
                        >
                          <option value="gemini-flash-latest">Gemini Flash Latest (Auto Active)</option>
                          <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                          <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                        </NativeSelect>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="modal-gemini-image-model">Image Generation Model</Label>
                        <NativeSelect
                          id="modal-gemini-image-model"
                          value={geminiImageModel}
                          onChange={(e) => setGeminiImageModel(e.target.value)}
                        >
                          <option value="auto">Auto Best Available (2.5 / 3.1 / 3 Pro Image)</option>
                          <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                          <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image</option>
                          <option value="gemini-3-pro-image">Gemini 3 Pro Image Studio</option>
                          <option value="gemini-nano-banana-2.1">Gemini Nano Banana 2.1</option>
                        </NativeSelect>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="modal-gemini-key">
                        Google Gemini API Key (Encrypted with AES-256-GCM at rest)
                      </Label>
                      <Input
                        id="modal-gemini-key"
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="Paste AIza... Gemini API key"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsGeminiOpen(false);
                          onSelectModule("settings");
                        }}
                      >
                        Manage All Connections
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setIsGeminiOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" variant="primary" isLoading={isSavingGemini}>
                          Verify & Connect Gemini
                        </Button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Pillio User Profile Header Pill */}
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2.5 rounded-full border border-border-subtle bg-surface-primary py-1 pl-1.5 pr-3 text-left shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:bg-surface-secondary cursor-pointer"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8E96FA] to-[#6870EE] text-xs font-bold text-white shadow-xs">
                  {(snapshot?.user.name ?? "SC").slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden md:flex flex-col leading-tight">
                  <span className="text-xs font-bold text-text-primary flex items-center gap-1">
                    {snapshot?.user.name ?? "Studio Creator"}
                    {snapshot?.user.isAdmin && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-success-fg" title="Admin" />
                    )}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    @{snapshot?.user.email?.split("@")[0] ?? "studio_creator"}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Compact Workflow Step Pills */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => onSelectModule("brands")}
              className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-left text-xs transition-all cursor-pointer ${
                activeModule === "brands" || activeModule === "brand-kits"
                  ? "border-accent-primary/50 bg-surface-primary text-text-primary font-bold shadow-[0_2px_10px_rgba(112,120,244,0.08)]"
                  : "border-border-subtle bg-surface-primary/70 text-text-secondary hover:bg-surface-primary hover:text-text-primary"
              }`}
            >
              <span className="truncate">1. Website & Brand</span>
              <Badge variant={totalBrands > 0 ? "success" : "neutral"}>
                {totalBrands > 0 ? `${totalBrands} Saved` : "Start"}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => onSelectModule("studio")}
              className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-left text-xs transition-all cursor-pointer ${
                activeModule === "studio" || activeModule === "content"
                  ? "border-accent-primary/50 bg-surface-primary text-text-primary font-bold shadow-[0_2px_10px_rgba(112,120,244,0.08)]"
                  : "border-border-subtle bg-surface-primary/70 text-text-secondary hover:bg-surface-primary hover:text-text-primary"
              }`}
            >
              <span className="truncate">2. Post Studio</span>
              <Badge variant={totalCreatives > 0 ? "info" : "neutral"}>
                {totalCreatives > 0 ? `${totalCreatives} Posts` : "Create"}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => onSelectModule("video-generation")}
              className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-left text-xs transition-all cursor-pointer ${
                activeModule === "video-generation"
                  ? "border-accent-primary/50 bg-surface-primary text-text-primary font-bold shadow-[0_2px_10px_rgba(112,120,244,0.08)]"
                  : "border-border-subtle bg-surface-primary/70 text-text-secondary hover:bg-surface-primary hover:text-text-primary"
              }`}
            >
              <span className="truncate">3. Video Studio</span>
              <Badge variant={totalVideos > 0 ? "info" : "neutral"}>
                {totalVideos > 0 ? `${totalVideos} Videos` : "Direct"}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => onSelectModule("radar")}
              className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-left text-xs transition-all cursor-pointer ${
                activeModule === "radar" || activeModule === "tracker"
                  ? "border-accent-primary/50 bg-surface-primary text-text-primary font-bold shadow-[0_2px_10px_rgba(112,120,244,0.08)]"
                  : "border-border-subtle bg-surface-primary/70 text-text-secondary hover:bg-surface-primary hover:text-text-primary"
              }`}
            >
              <span className="truncate">4. Trend Radar</span>
              <Badge variant={activeRadarSignals > 0 ? "info" : "neutral"}>
                {activeRadarSignals > 0 ? `${activeRadarSignals} Signals` : "Scan"}
              </Badge>
            </button>
          </div>
        </header>

        {/* Real-time API & AI Processing Popup Modal */}
        {backgroundTask.isRunning ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-labelledby="processing-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div className="relative w-full max-w-md rounded-3xl border border-border-subtle bg-surface-primary/95 p-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-action-primary-bg/10 text-action-primary-bg">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
                  <span className="absolute inset-0 rounded-2xl ring-2 ring-accent-primary/25 animate-pulse" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-accent-primary flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      Processing Request
                    </span>
                    <span className="font-mono text-xs font-semibold text-text-secondary">
                      {backgroundTask.progressPercent}%
                    </span>
                  </div>
                  <h3
                    id="processing-modal-title"
                    className="text-sm font-semibold text-text-primary leading-snug"
                  >
                    {backgroundTask.label || "Processing request..."}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Please hold on while the server and Gemini process your request. This will complete automatically.
                  </p>
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="mt-5 flex flex-col gap-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-primary to-action-primary-bg transition-all duration-300 ease-out shadow-xs"
                    style={{
                      width: `${Math.max(15, backgroundTask.progressPercent)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <main id="main-content" className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
