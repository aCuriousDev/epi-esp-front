import { Show, createSignal, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { LogOut, User, Mail, Calendar, Shield, Edit3, Drama, Swords, ScrollText, Trophy, Dices } from "lucide-solid";
import { authStore } from "../stores/auth.store";
import { AuthService } from "../services/auth.service";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

/**
 * Profile Page - User details and settings
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = createSignal(false);

  const user = () => authStore.user();

  const avatarUrl = () => {
    const u = user();
    return u ? AuthService.getAvatarUrl(u) : "";
  };

  const joinDate = () => {
    const u = user();
    if (!u?.createdAt) return "N/A";
    return new Date(u.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
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

  return (
    <>
      <PageMeta title={t("page.profile.title")} />

      <div class="profile-page min-h-screen w-full">
        {/* Background effects */}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        {/* Main content */}
        <main class="relative z-10 max-w-2xl mx-auto p-6 pt-8">
          <Show
            when={user()}
            fallback={
              <div class="flex items-center justify-center py-20">
                <div class="w-10 h-10 border-3 border-white/20 border-t-purple-500 rounded-full animate-spin" />
              </div>
            }
          >
            {/* Profile Card */}
            <div class="profile-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {/* Banner */}
              <div class="h-32 bg-gradient-to-r from-purple-600/40 via-indigo-600/40 to-violet-600/40 relative">
                <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
              </div>

              {/* Avatar */}
              <div class="relative px-6 -mt-16">
                <div class="relative inline-block">
                  <div class="w-32 h-32 rounded-full overflow-hidden border-4 border-game-dark/60 shadow-xl">
                    <img
                      src={avatarUrl()}
                      alt={user()?.username || "User avatar"}
                      class="w-full h-full object-cover"
                    />
                  </div>
                  {/* Online indicator */}
                  <div class="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-game-dark/60" />
                </div>
              </div>

              {/* User Info */}
              <div class="px-6 pt-4 pb-6">
                <div class="flex items-start justify-between mb-6">
                  <div>
                    <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                      {user()?.username}
                      <Show when={user()?.discordId}>
                        <span class="px-2 py-0.5 text-xs bg-discord-blurple/20 text-discord-blurple rounded-full border border-discord-blurple/30">
                          Discord
                        </span>
                      </Show>
                    </h2>
                    <p class="text-slate-400 text-sm mt-1">
                      {t("page.profile.adventurer")}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  <StatCard icon={<Drama class="w-6 h-6 text-purple-300" />} label={t("page.profile.stat.characters")} value="0" />
                  <StatCard icon={<Swords class="w-6 h-6 text-red-300" />} label={t("page.profile.stat.combats")} value="0" />
                  <StatCard icon={<ScrollText class="w-6 h-6 text-amber-300" />} label={t("page.profile.stat.campaigns")} value="0" />
                  <StatCard icon={<Trophy class="w-6 h-6 text-game-gold" />} label={t("page.profile.stat.victories")} value="0" />
                </div>

                {/* Details Section */}
                <div class="space-y-4">
                  <h3 class="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    {t("page.profile.accountInfo")}
                  </h3>

                  <div class="space-y-3">
                    <InfoRow
                      icon={<User class="w-4 h-4" />}
                      label={t("page.profile.username")}
                      value={user()?.username || "N/A"}
                    />
                    <InfoRow
                      icon={<Mail class="w-4 h-4" />}
                      label={t("page.profile.email")}
                      value={user()?.email || t("page.profile.emailEmpty")}
                    />
                    <InfoRow
                      icon={<Shield class="w-4 h-4" />}
                      label={t("page.profile.discordId")}
                      value={user()?.discordId || "N/A"}
                    />
                    <InfoRow
                      icon={<Calendar class="w-4 h-4" />}
                      label={t("page.profile.memberSince")}
                      value={joinDate()}
                    />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div class="px-6 py-4 bg-white/5 border-t border-white/10 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/characters")}
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors"
                >
                  <Edit3 class="w-4 h-4" />
                  <span>{t("page.profile.action.myCharacters")}</span>
                </button>

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut()}
                  class="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl transition-colors disabled:opacity-50"
                >
                  <LogOut class="w-4 h-4" />
                  <span>{isLoggingOut() ? t("page.profile.loggingOut") : t("page.profile.logout")}</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickActionCard
                icon={<Dices class="w-6 h-6 text-blue-300" />}
                title={t("page.profile.action.startGame")}
                description={t("page.profile.action.startGame.desc")}
                onClick={() => navigate("/practice")}
              />
              <QuickActionCard
                icon={<ScrollText class="w-6 h-6 text-amber-300" />}
                title={t("page.profile.action.myCampaigns")}
                description={t("page.profile.action.myCampaigns.desc")}
                onClick={() => navigate("/campaigns")}
              />
            </div>
          </Show>
        </main>

        <style jsx>{`
          .profile-page {
            background: linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%);
          }

          .profile-card {
            animation: cardSlideUp 0.5s ease-out;
          }

          @keyframes cardSlideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
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
 * Stat card component
 */
function StatCard(props: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div class="flex flex-col items-center p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
      <span class="mb-1">{props.icon}</span>
      <span class="text-xl font-bold text-white">{props.value}</span>
      <span class="text-xs text-slate-400">{props.label}</span>
    </div>
  );
}

/**
 * Info row component
 */
function InfoRow(props: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div class="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
      <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-500/20 text-purple-400 rounded-lg">
        {props.icon}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-slate-400">{props.label}</p>
        <p class="text-white truncate">{props.value}</p>
      </div>
    </div>
  );
}

/**
 * Quick action card component
 */
function QuickActionCard(props: { icon: JSX.Element; title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      class="flex items-center gap-4 p-4 bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-left group"
    >
      <div class="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white/10 rounded-xl group-hover:scale-110 transition-transform">
        {props.icon}
      </div>
      <div>
        <h3 class="font-semibold text-white group-hover:text-purple-300 transition-colors">
          {props.title}
        </h3>
        <p class="text-sm text-slate-400">{props.description}</p>
      </div>
    </button>
  );
}
