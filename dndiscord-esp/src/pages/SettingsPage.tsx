import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show, For } from "solid-js";
import {
  Settings,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Monitor,
  Bell,
  BellOff,
  Globe,
  Trash2,
  LogOut,
  User,
  Palette,
  Gamepad2,
  BookOpen,
  Sparkles,
  Gauge,
  Bug,
  Sliders,
  ShieldCheck,
  Download,
  Scale,
  Cookie,
} from "lucide-solid";
import { authStore } from "../stores/auth.store";
import { AuthService } from "../services/auth.service";
import { consentStore } from "../stores/consent.store";
import { useEscapeToClose } from "../hooks/useModalAccessibility";
import {
  soundSettings,
  setSfxEnabled,
  setMusicEnabled,
} from "../stores/sound.store";
import { restartTutorialTest } from "../stores/tutorial.store";
import {
  graphicsSettings,
  setPreset,
  setShadowResolution,
  setHardwareScaling,
  setEffect,
  setDebug,
  resetGraphicsDefaults,
} from "../stores/graphics.store";
import type {
  QualityPreset,
  ShadowResolution,
  HardwareScaling,
} from "../engine/quality/QualityPresets";
import { getEngine } from "../components/GameCanvas";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

const PRESETS: { id: QualityPreset; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "ultra", label: "Ultra" },
  { id: "custom", label: "Custom" },
];

const EFFECT_ITEMS: {
  key: keyof ReturnType<typeof graphicsSettings.effects>;
  label: string;
}[] = [
  { key: "bloom", label: "Bloom" },
  { key: "fxaa", label: "FXAA" },
  { key: "vignette", label: "Vignette" },
  { key: "chromaticAberration", label: "Aberration" },
  { key: "glow", label: "Glow" },
  { key: "ambientParticles", label: "Particles" },
  { key: "shadows", label: "Shadows" },
];

const DEBUG_ITEMS: {
  key: keyof ReturnType<typeof graphicsSettings.debug>;
  label: string;
}[] = [
  { key: "fpsMeter", label: "FPS" },
  { key: "wireframe", label: "Wireframe" },
  { key: "boundingBoxes", label: "Bounding boxes" },
  { key: "collisionCells", label: "Collisions" },
];

const SHADOW_RESOLUTIONS: ShadowResolution[] = [512, 1024, 2048, 4096];
const HARDWARE_SCALINGS: HardwareScaling[] = [1.5, 1.0, 0.75, 0.5];

export default function SettingsPage() {
  const navigate = useNavigate();

  // Audio settings from persistent store
  const soundEnabled = soundSettings.sfxEnabled;
  const musicEnabled = soundSettings.musicEnabled;
  const [notificationsEnabled, setNotificationsEnabled] = createSignal(true);
  const [theme, setTheme] = createSignal<"dark" | "light" | "system">("dark");
  const [language, setLanguage] = createSignal("fr");
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [isLoggingOut, setIsLoggingOut] = createSignal(false);
  const [isDeletingAccount, setIsDeletingAccount] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [exportError, setExportError] = createSignal<string | null>(null);

  // ESC closes the delete confirmation modal (unless deletion is in progress).
  useEscapeToClose(
    () => showDeleteConfirm() && !isDeletingAccount(),
    () => setShowDeleteConfirm(false),
  );

  async function handleDeleteAccount() {
    setDeleteError(null);
    setIsDeletingAccount(true);
    try {
      await AuthService.deleteAccount();
      consentStore.clearPreferenceStorage();
      await authStore.logout();
      try { sessionStorage.setItem("account_just_deleted", "1"); } catch { /* ignore */ }
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteError(
        typeof err === "string"
          ? err
          : "Deletion failed. Please try again or contact support.",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleExportData() {
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await AuthService.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const idPrefix = authStore.user()?.discordId?.slice(0, 8) ?? "user";
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `dndiscord-export-${idPrefix}-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      let msg = "Export failed. Please try again or contact support.";
      try {
        const blob = err?.response?.data;
        if (blob instanceof Blob) {
          const text = await blob.text();
          const parsed = JSON.parse(text);
          if (parsed?.error) msg = parsed.error;
        } else if (typeof err === "string") {
          msg = err;
        }
      } catch {
        /* keep fallback */
      }
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  }

  const user = () => authStore.user();
  const avatarUrl = () => {
    const u = user();
    return u ? AuthService.getAvatarUrl(u) : "";
  };

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await authStore.logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleReplayTutorial() {
    restartTutorialTest();
    navigate("/", { replace: true });
  }

  return (
    <>
      <PageMeta title={t("page.settings.title")} />

      <div class="settings-page min-h-screen w-full overflow-y-auto">
        {/* Animated background elements */}
        <div class="fixed inset-0 overflow-hidden pointer-events-none">
          <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
          <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        <main class="relative z-10 max-w-2xl mx-auto p-6 pt-8 pb-20 space-y-6">
          {/* User Profile Section */}
          <Show when={authStore.isAuthenticated()}>
            <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <div class="p-5 border-b border-white/10">
                <h2 class="font-display text-lg text-white flex items-center gap-2">
                  <User class="w-5 h-5 text-purple-400" />
                  {t("page.settings.section.account")}
                </h2>
              </div>
              <div class="p-5">
                <div class="flex items-center gap-4">
                  <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/30">
                    <img
                      src={avatarUrl()}
                      alt={user()?.username || "Avatar"}
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div class="flex-1">
                    <p class="text-white font-semibold text-lg">
                      {user()?.username}
                    </p>
                    <p class="text-slate-400 text-sm">
                      {user()?.email || t("page.settings.emailEmpty")}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/profile")}
                    class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all text-sm"
                  >
                    {t("page.settings.viewProfile")}
                  </button>
                </div>
              </div>
            </section>
          </Show>

          {/* Audio Settings */}
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <Volume2 class="w-5 h-5 text-blue-400" />
                {t("page.settings.section.audio")}
              </h2>
            </div>
            <div class="p-5 space-y-4">
              <SettingToggle
                icon={<Volume2 class="w-5 h-5" />}
                label={t("page.settings.sfx")}
                description={t("page.settings.sfx.desc")}
                enabled={soundEnabled()}
                onToggle={() => setSfxEnabled(!soundEnabled())}
              />
              <SettingToggle
                icon={<Gamepad2 class="w-5 h-5" />}
                label={t("page.settings.music")}
                description={t("page.settings.music.desc")}
                enabled={musicEnabled()}
                onToggle={() => setMusicEnabled(!musicEnabled())}
              />
            </div>
          </section>

          {/* Graphics Settings */}
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <Sparkles class="w-5 h-5 text-pink-400" />
                {t("page.settings.section.graphics")}
              </h2>
            </div>
            <div class="p-5 space-y-5">
              {/* Preset picker */}
              <div>
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
                    <Gauge class="w-5 h-5" />
                  </div>
                  <div>
                    <p class="text-white font-medium">{t("page.settings.preset")}</p>
                    <p class="text-slate-400 text-sm">
                      {t("page.settings.preset.desc")}
                    </p>
                  </div>
                </div>
                <div class="grid grid-cols-5 gap-1 bg-white/5 rounded-xl p-1">
                  <For each={PRESETS}>
                    {(p) => (
                      <button
                        onClick={() => setPreset(p.id)}
                        class={`px-2 py-1.5 rounded-lg text-xs transition-all ${
                          graphicsSettings.preset() === p.id
                            ? "bg-pink-600 text-white"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {p.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Effect toggles */}
              <div class="space-y-3">
                <p class="text-white text-sm font-medium flex items-center gap-2">
                  <Sliders class="w-4 h-4 text-pink-300" />
                  {t("page.settings.effects")}
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <For each={EFFECT_ITEMS}>
                    {(e) => (
                      <label class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                        <span class="text-slate-200 text-sm">{e.label}</span>
                        <input
                          type="checkbox"
                          class="accent-pink-500"
                          checked={graphicsSettings.effects()[e.key]}
                          onChange={(ev) =>
                            setEffect(e.key, ev.currentTarget.checked)
                          }
                        />
                      </label>
                    )}
                  </For>
                </div>
              </div>

              {/* Shadow resolution */}
              <div>
                <p class="text-white text-sm font-medium mb-2">
                  {t("page.settings.shadowRes")}
                </p>
                <div class="grid grid-cols-4 gap-1 bg-white/5 rounded-xl p-1">
                  <For each={SHADOW_RESOLUTIONS}>
                    {(res) => (
                      <button
                        onClick={() => setShadowResolution(res)}
                        class={`px-2 py-1.5 rounded-lg text-xs transition-all ${
                          graphicsSettings.shadowResolution() === res
                            ? "bg-pink-600 text-white"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {res}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Hardware scaling */}
              <div>
                <p class="text-white text-sm font-medium mb-2">
                  {t("page.settings.renderScale")}
                  <span class="text-slate-500 text-xs ml-2">
                    {t("page.settings.renderScale.hint")}
                  </span>
                </p>
                <div class="grid grid-cols-4 gap-1 bg-white/5 rounded-xl p-1">
                  <For each={HARDWARE_SCALINGS}>
                    {(s) => (
                      <button
                        onClick={() => setHardwareScaling(s)}
                        class={`px-2 py-1.5 rounded-lg text-xs transition-all ${
                          graphicsSettings.hardwareScaling() === s
                            ? "bg-pink-600 text-white"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {s.toFixed(2)}x
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Debug */}
              <div class="space-y-3 border-t border-white/10 pt-4">
                <p class="text-white text-sm font-medium flex items-center gap-2">
                  <Bug class="w-4 h-4 text-amber-300" />
                  {t("page.settings.debug")}
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <For each={DEBUG_ITEMS}>
                    {(d) => (
                      <label class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                        <span class="text-slate-200 text-sm">{d.label}</span>
                        <input
                          type="checkbox"
                          class="accent-amber-400"
                          checked={graphicsSettings.debug()[d.key]}
                          onChange={(ev) =>
                            setDebug(d.key, ev.currentTarget.checked)
                          }
                        />
                      </label>
                    )}
                  </For>
                </div>
                <button
                  onClick={() => getEngine()?.showInspector()}
                  class="w-full px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 rounded-lg text-amber-200 text-sm transition-colors"
                >
                  {t("page.settings.openInspector")}
                </button>
              </div>

              <button
                onClick={resetGraphicsDefaults}
                class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-sm transition-colors"
              >
                {t("page.settings.resetDefaults")}
              </button>
            </div>
          </section>

          {/* Appearance Settings */}
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <Palette class="w-5 h-5 text-purple-400" />
                {t("page.settings.section.appearance")}
              </h2>
            </div>
            <div class="p-5 space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Moon class="w-5 h-5" />
                  </div>
                  <div>
                    <p class="text-white font-medium">{t("page.settings.theme")}</p>
                    <p class="text-slate-400 text-sm">
                      {t("page.settings.theme.desc")}
                    </p>
                  </div>
                </div>
                <div class="flex gap-1 bg-white/5 rounded-xl p-1">
                  <ThemeButton
                    icon={<Moon class="w-4 h-4" />}
                    active={theme() === "dark"}
                    onClick={() => setTheme("dark")}
                    label={t("page.settings.theme.dark")}
                  />
                  <ThemeButton
                    icon={<Sun class="w-4 h-4" />}
                    active={theme() === "light"}
                    onClick={() => setTheme("light")}
                    label={t("page.settings.theme.light")}
                  />
                  <ThemeButton
                    icon={<Monitor class="w-4 h-4" />}
                    active={theme() === "system"}
                    onClick={() => setTheme("system")}
                    label={t("page.settings.theme.auto")}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Notifications Settings */}
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <Bell class="w-5 h-5 text-yellow-400" />
                {t("page.settings.section.notifications")}
              </h2>
            </div>
            <div class="p-5 space-y-4">
              <SettingToggle
                icon={<Bell class="w-5 h-5" />}
                label={t("page.settings.notifications")}
                description={t("page.settings.notifications.desc")}
                enabled={notificationsEnabled()}
                onToggle={() => setNotificationsEnabled(!notificationsEnabled())}
              />
            </div>
          </section>

          {/* Tutorial (test mode) */}
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <BookOpen class="w-5 h-5 text-purple-400" />
                {t("page.settings.section.tutorial")}
              </h2>
            </div>
            <div class="p-5">
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-white font-medium">{t("page.settings.replayTutorial")}</p>
                  <p class="text-slate-400 text-sm">
                    {t("page.settings.replayTutorial.desc")}
                  </p>
                </div>
                <button
                  onClick={handleReplayTutorial}
                  class="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all text-sm whitespace-nowrap"
                >
                  {t("page.settings.replayTutorial.cta")}
                </button>
              </div>
            </div>
          </section>

          {/* Language Settings */}
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <Globe class="w-5 h-5 text-green-400" />
                {t("page.settings.section.language")}
              </h2>
            </div>
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                    <Globe class="w-5 h-5" />
                  </div>
                  <div>
                    <p class="text-white font-medium">{t("page.settings.languageLabel")}</p>
                    <p class="text-slate-400 text-sm">
                      {t("page.settings.languageHint")}
                    </p>
                  </div>
                </div>
                <select
                  value={language()}
                  onChange={(e) => setLanguage(e.currentTarget.value)}
                  class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
                >
                  <option value="fr" class="bg-game-dark">
                    FR — Français
                  </option>
                  <option value="en" class="bg-game-dark">
                    EN — English
                  </option>
                  <option value="es" class="bg-game-dark">
                    ES — Español
                  </option>
                  <option value="de" class="bg-game-dark">
                    DE — Deutsch
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* Privacy & Data (GDPR) — gated: requires authenticated account */}
          <Show when={authStore.isAuthenticated()}>
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <ShieldCheck class="w-5 h-5 text-purple-400" />
                {t("page.settings.section.privacy")}
              </h2>
            </div>
            <div class="p-5 space-y-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Download class="w-5 h-5" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-white font-medium">{t("page.settings.exportData")}</p>
                      <p class="text-slate-400 text-sm">
                        {t("page.settings.exportData.desc")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={isExporting()}
                    class="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-200 transition-all text-sm whitespace-nowrap disabled:opacity-50"
                  >
                    {isExporting() ? t("page.settings.exporting") : t("page.settings.export.cta")}
                  </button>
                </div>
                <Show when={exportError()}>
                  <p class="text-red-400 text-xs">{exportError()}</p>
                </Show>

              <div class="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                    <Cookie class="w-5 h-5" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-white font-medium">{t("page.settings.localStorage")}</p>
                    <p class="text-slate-400 text-sm">
                      {t("page.settings.localStorage.desc")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => consentStore.openPreferences()}
                  class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-200 transition-all text-sm whitespace-nowrap"
                >
                  {t("page.settings.manage")}
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
                <A
                  href="/privacy"
                  class="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 transition-colors"
                >
                  <ShieldCheck class="w-4 h-4" />
                  {t("page.settings.privacyPolicy")}
                </A>
                <span class="text-slate-600">·</span>
                <A
                  href="/terms"
                  class="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 transition-colors"
                >
                  <Scale class="w-4 h-4" />
                  {t("page.settings.terms")}
                </A>
                <span class="text-slate-600">·</span>
                <A
                  href="/legal"
                  class="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 transition-colors"
                >
                  {t("page.settings.legal")}
                </A>
                <span class="text-slate-600">·</span>
                <A
                  href="/cookies"
                  class="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 transition-colors"
                >
                  <Cookie class="w-4 h-4" />
                  {t("page.settings.cookies")}
                </A>
              </div>
            </div>
          </section>
          </Show>

          {/* Danger Zone */}
          <Show when={authStore.isAuthenticated()}>
            <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-red-500/20 rounded-2xl overflow-hidden">
              <div class="p-5 border-b border-red-500/20">
                <h2 class="font-display text-lg text-red-400 flex items-center gap-2">
                  <Trash2 class="w-5 h-5" />
                  {t("page.settings.section.dangerZone")}
                </h2>
              </div>
              <div class="p-5 space-y-4">
                {/* Logout */}
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                      <LogOut class="w-5 h-5" />
                    </div>
                    <div>
                      <p class="text-white font-medium">{t("page.settings.logout")}</p>
                      <p class="text-slate-400 text-sm">{t("page.settings.logout.desc")}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut()}
                    class="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-xl text-orange-400 transition-all text-sm disabled:opacity-50"
                  >
                    {isLoggingOut() ? t("page.settings.loggingOut") : t("page.settings.logout")}
                  </button>
                </div>

                {/* Delete Account */}
                <div class="flex items-center justify-between pt-4 border-t border-white/10">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                      <Trash2 class="w-5 h-5" />
                    </div>
                    <div>
                      <p class="text-white font-medium">{t("page.settings.deleteAccount")}</p>
                      <p class="text-slate-400 text-sm">
                        {t("page.settings.deleteAccount.desc")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 transition-all text-sm"
                  >
                    {t("page.settings.delete.cta")}
                  </button>
                </div>
                <Show when={deleteError()}>
                  <p class="text-red-400 text-xs">{deleteError()}</p>
                </Show>
              </div>
            </section>
          </Show>

          {/* App Info */}
          <footer class="text-center pt-8 text-slate-500 text-sm">
            <p>{t("page.settings.appVersion")}</p>
            <p class="mt-1">{t("page.settings.appTagline")}</p>
          </footer>
        </main>

        {/* Delete Confirmation Modal */}
        <Show when={showDeleteConfirm()}>
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div class="bg-game-dark border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div class="text-center mb-6">
                <div class="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <Trash2 class="w-8 h-8 text-red-400" />
                </div>
                <h3 class="text-xl font-semibold text-white mb-2">
                  {t("page.settings.deleteConfirm.title")}
                </h3>
                <p class="text-slate-400 text-sm">
                  {t("page.settings.deleteConfirm.body")}
                </p>
                <div class="mt-4 rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-left">
                  <p class="text-purple-200 text-xs font-medium mb-1">
                    {t("page.settings.deleteConfirm.revokeTitle")}
                  </p>
                  <p class="text-slate-300 text-xs leading-relaxed">
                    {t("page.settings.deleteConfirm.revokeBody")}{" "}
                    <strong>{t("page.settings.deleteConfirm.revokeInstructions")}</strong>.{" "}
                    <a
                      href="discord://users/@me/settings/authorized-apps"
                      class="text-purple-300 underline hover:text-purple-200"
                    >
                      {t("page.settings.deleteConfirm.openDiscord")}
                    </a>{" "}
                    ·{" "}
                    <a
                      href="https://discord.com/channels/@me"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-purple-300 underline hover:text-purple-200"
                    >
                      {t("page.settings.deleteConfirm.web")}
                    </a>
                  </p>
                </div>
              </div>
              <Show when={deleteError()}>
                <p class="text-red-400 text-xs mb-3 text-center">
                  {deleteError()}
                </p>
              </Show>
              <div class="flex gap-3">
                <button
                  ref={(el) => {
                    if (showDeleteConfirm()) queueMicrotask(() => el?.focus());
                  }}
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeletingAccount()}
                  class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all disabled:opacity-50"
                >
                  {t("page.settings.deleteConfirm.cancel")}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount()}
                  class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-white transition-all disabled:opacity-50"
                >
                  {isDeletingAccount() ? t("page.settings.deleting") : t("page.settings.deleteConfirm.confirm")}
                </button>
              </div>
            </div>
          </div>
        </Show>

        <style jsx>{`
          .settings-page {
            background: linear-gradient(
              135deg,
              var(--ink-700) 0%,
              var(--ink-800) 50%,
              var(--ink-900) 100%
            );
          }

          .settings-card {
            animation: cardFadeIn 0.4s ease-out;
            animation-fill-mode: both;
          }

          .settings-card:nth-child(1) {
            animation-delay: 0ms;
          }
          .settings-card:nth-child(2) {
            animation-delay: 50ms;
          }
          .settings-card:nth-child(3) {
            animation-delay: 100ms;
          }
          .settings-card:nth-child(4) {
            animation-delay: 150ms;
          }
          .settings-card:nth-child(5) {
            animation-delay: 200ms;
          }
          .settings-card:nth-child(6) {
            animation-delay: 250ms;
          }

          @keyframes cardFadeIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </>
  );
}

/**
 * Setting toggle component
 */
function SettingToggle(props: {
  icon: any;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            props.enabled
              ? "bg-purple-500/20 text-purple-400"
              : "bg-white/5 text-slate-500"
          }`}
        >
          {props.icon}
        </div>
        <div>
          <p class="text-white font-medium">{props.label}</p>
          <p class="text-slate-400 text-sm">{props.description}</p>
        </div>
      </div>
      <button
        onClick={props.onToggle}
        class={`w-14 h-8 rounded-full p-1 transition-colors ${
          props.enabled ? "bg-purple-600" : "bg-white/10"
        }`}
      >
        <div
          class={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
            props.enabled ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Theme button component
 */
function ThemeButton(props: {
  icon: any;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={props.onClick}
      class={`p-2 rounded-lg transition-all ${
        props.active
          ? "bg-purple-600 text-white"
          : "text-slate-400 hover:text-white hover:bg-white/10"
      }`}
      title={props.label}
    >
      {props.icon}
    </button>
  );
}
