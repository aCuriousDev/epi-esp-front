import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import {
  ArrowLeft,
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
} from "lucide-solid";
import { authStore } from "../stores/auth.store";
import { AuthService } from "../services/auth.service";
import {
  soundSettings,
  setSfxEnabled,
  setMusicEnabled,
} from "../stores/sound.store";
import { restartTutorialTest } from "../stores/tutorial.store";

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
    // Revenir au menu pour démarrer proprement le flow du tuto
    navigate("/", { replace: true });
  }

  return (
    <div class="settings-page min-h-screen w-full overflow-y-auto">
      {/* Animated background elements */}
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
        <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* Vignette */}
      <div class="vignette fixed inset-0 pointer-events-none" />

      {/* Header */}
      <header class="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/80 backdrop-blur-md">
        <button
          onClick={() => navigate("/")}
          class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Retour au menu</span>
        </button>

        <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
          <Settings class="w-5 h-5 text-purple-400" />
          Paramètres
        </h1>

        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-2xl mx-auto p-6 pt-8 pb-20 space-y-6">
        {/* User Profile Section */}
        <Show when={authStore.isAuthenticated()}>
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <h2 class="font-display text-lg text-white flex items-center gap-2">
                <User class="w-5 h-5 text-purple-400" />
                Compte
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
                    {user()?.email || "Email non renseigné"}
                  </p>
                </div>
                <button
                  onClick={() => navigate("/profile")}
                  class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all text-sm"
                >
                  Voir le profil
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
              Audio
            </h2>
          </div>
          <div class="p-5 space-y-4">
            <SettingToggle
              icon={<Volume2 class="w-5 h-5" />}
              label="Effets sonores"
              description="Sons d'interface et de combat"
              enabled={soundEnabled()}
              onToggle={() => setSfxEnabled(!soundEnabled())}
            />
            <SettingToggle
              icon={<Gamepad2 class="w-5 h-5" />}
              label="Musique de fond"
              description="Ambiance musicale pendant le jeu"
              enabled={musicEnabled()}
              onToggle={() => setMusicEnabled(!musicEnabled())}
            />
          </div>
        </section>

        {/* Appearance Settings */}
        <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          <div class="p-5 border-b border-white/10">
            <h2 class="font-display text-lg text-white flex items-center gap-2">
              <Palette class="w-5 h-5 text-purple-400" />
              Apparence
            </h2>
          </div>
          <div class="p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <Moon class="w-5 h-5" />
                </div>
                <div>
                  <p class="text-white font-medium">Thème</p>
                  <p class="text-slate-400 text-sm">
                    Choisissez l'apparence de l'interface
                  </p>
                </div>
              </div>
              <div class="flex gap-1 bg-white/5 rounded-xl p-1">
                <ThemeButton
                  icon={<Moon class="w-4 h-4" />}
                  active={theme() === "dark"}
                  onClick={() => setTheme("dark")}
                  label="Sombre"
                />
                <ThemeButton
                  icon={<Sun class="w-4 h-4" />}
                  active={theme() === "light"}
                  onClick={() => setTheme("light")}
                  label="Clair"
                />
                <ThemeButton
                  icon={<Monitor class="w-4 h-4" />}
                  active={theme() === "system"}
                  onClick={() => setTheme("system")}
                  label="Auto"
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
              Notifications
            </h2>
          </div>
          <div class="p-5 space-y-4">
            <SettingToggle
              icon={<Bell class="w-5 h-5" />}
              label="Notifications"
              description="Recevoir des notifications pour les sessions et messages"
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
              Tutoriel
            </h2>
          </div>
          <div class="p-5">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-white font-medium">Rejouer le tutoriel</p>
                <p class="text-slate-400 text-sm">
                  Relance l’onboarding pour tester ou revoir les étapes.
                </p>
              </div>
              <button
                onClick={handleReplayTutorial}
                class="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all text-sm whitespace-nowrap"
              >
                Lancer
              </button>
            </div>
          </div>
        </section>

        {/* Language Settings */}
        <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          <div class="p-5 border-b border-white/10">
            <h2 class="font-display text-lg text-white flex items-center gap-2">
              <Globe class="w-5 h-5 text-green-400" />
              Langue
            </h2>
          </div>
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                  <Globe class="w-5 h-5" />
                </div>
                <div>
                  <p class="text-white font-medium">Langue de l'interface</p>
                  <p class="text-slate-400 text-sm">
                    Choisissez votre langue préférée
                  </p>
                </div>
              </div>
              <select
                value={language()}
                onChange={(e) => setLanguage(e.currentTarget.value)}
                class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
              >
                <option value="fr" class="bg-game-dark">
                  🇫🇷 Français
                </option>
                <option value="en" class="bg-game-dark">
                  🇬🇧 English
                </option>
                <option value="es" class="bg-game-dark">
                  🇪🇸 Español
                </option>
                <option value="de" class="bg-game-dark">
                  🇩🇪 Deutsch
                </option>
              </select>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <Show when={authStore.isAuthenticated()}>
          <section class="settings-card bg-game-dark/60 backdrop-blur-xl border border-red-500/20 rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-red-500/20">
              <h2 class="font-display text-lg text-red-400 flex items-center gap-2">
                <Trash2 class="w-5 h-5" />
                Zone de danger
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
                    <p class="text-white font-medium">Se déconnecter</p>
                    <p class="text-slate-400 text-sm">Fermer votre session</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut()}
                  class="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-xl text-orange-400 transition-all text-sm disabled:opacity-50"
                >
                  {isLoggingOut() ? "Déconnexion..." : "Déconnexion"}
                </button>
              </div>

              {/* Delete Account */}
              <div class="flex items-center justify-between pt-4 border-t border-white/10">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                    <Trash2 class="w-5 h-5" />
                  </div>
                  <div>
                    <p class="text-white font-medium">Supprimer le compte</p>
                    <p class="text-slate-400 text-sm">
                      Cette action est irréversible
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 transition-all text-sm"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </section>
        </Show>

        {/* App Info */}
        <footer class="text-center pt-8 text-slate-500 text-sm">
          <p>DnDiscord v1.0.0</p>
          <p class="mt-1">Fait avec ❤️ pour les joueurs de D&D</p>
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
                Supprimer votre compte ?
              </h3>
              <p class="text-slate-400 text-sm">
                Cette action supprimera définitivement votre compte, vos
                personnages et toutes vos données. Cette action est
                irréversible.
              </p>
            </div>
            <div class="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all"
              >
                Annuler
              </button>
              <button class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-white transition-all">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </Show>

      <style jsx>{`
        .settings-page {
          background: linear-gradient(
            135deg,
            #1a1a2e 0%,
            #16213e 50%,
            #0f0f1a 100%
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
