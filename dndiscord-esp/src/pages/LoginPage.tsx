import { Show, createEffect, createSignal, type JSX } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Check, Swords, Drama, ScrollText, ShoppingBag } from "lucide-solid";
import { authStore } from "../stores/auth.store";
import { LoginButton } from "../components/auth";
import { AnimatedD20 } from "../components/common/AnimatedD20";

/**
 * Login Page - Landing page for unauthenticated users
 */
export default function LoginPage() {
  const navigate = useNavigate();

  // One-shot flag set by SettingsPage just before the redirect after
  // account deletion (GDPR art. 17). We read it then clear it
  // immediately — the banner won't reappear on reload.
  const [showDeleted, setShowDeleted] = createSignal(false);
  try {
    if (sessionStorage.getItem("account_just_deleted") === "1") {
      sessionStorage.removeItem("account_just_deleted");
      setShowDeleted(true);
    }
  } catch { /* sessionStorage unavailable: no banner, no big deal */ }

  // Redirect to home if already authenticated.
  createEffect(() => {
    if (!authStore.isLoading() && authStore.isAuthenticated()) {
      navigate("/", { replace: true });
    }
  });

  return (
    <div class="login-page relative min-h-screen w-full overflow-hidden bg-brand-gradient">
      {/* Animated background elements */}
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div class="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Vignette effect */}
      <div class="vignette absolute inset-0" />

      {/* Main content */}
      <main class="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <div class="w-full max-w-md">
          {/* Logo/Brand section */}
          <header class="text-center mb-12">
            {/* Animated D20 dice - click, hold-and-shake, or flick to roll */}
            <div class="flex justify-center mb-8">
              <AnimatedD20 size={180} />
            </div>

            <h1 class="login-title font-display text-5xl sm:text-6xl tracking-wide">
              DnDiscord
            </h1>
            <p class="mt-4 text-slate-200/80 text-lg">
              Your adventure starts here
            </p>
          </header>

          {/* Bannière de confirmation après suppression de compte (RGPD art. 17) */}
          <Show when={showDeleted()}>
            <div
              role="status"
              class="mb-6 flex gap-3 items-start rounded-2xl bg-emerald-500/15 border border-emerald-400/40 p-4 text-sm"
            >
              <span class="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check class="w-5 h-5 text-emerald-300" />
              </span>
              <div class="flex-1 space-y-1">
                <p class="text-emerald-100 font-semibold">
                  Account deleted
                </p>
                <p class="text-emerald-100/80 text-xs leading-relaxed">
                  Your characters, owned campaigns and memberships have been
                  deleted. To also revoke OAuth access on Discord's side:{" "}
                  <a
                    href="discord://users/@me/settings/authorized-apps"
                    class="underline hover:text-white"
                  >
                    Authorized Apps
                  </a>{" "}
                  (or <a
                    href="https://discord.com/channels/@me"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline hover:text-white"
                  >via the web</a>).
                </p>
              </div>
              <button
                onClick={() => setShowDeleted(false)}
                aria-label="Close"
                class="flex-shrink-0 text-emerald-200/70 hover:text-emerald-100 text-xl leading-none px-1"
              >
                ×
              </button>
            </div>
          </Show>

          {/* Login card */}
          <div class="login-card relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/30">
            {/* Card glow */}
            <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
            
            <div class="relative z-10">
              <h2 class="text-center text-xl font-semibold text-white mb-2">
                Welcome, adventurer!
              </h2>
              <p class="text-center text-slate-300/70 text-sm mb-8">
                Sign in with Discord to access your characters and campaigns.
              </p>

              {/* Loading state */}
              <Show when={authStore.isLoading()}>
                <div class="flex flex-col items-center gap-4 py-4">
                  <div class="w-10 h-10 border-3 border-white/20 border-t-purple-500 rounded-full animate-spin" />
                  <p class="text-slate-300/70 text-sm">Checking session...</p>
                </div>
              </Show>

              {/* Discord Activity error (debug) */}
              <Show when={authStore.activityError()}>
                <div class="w-full p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-xs break-all">
                  <strong>Activity error:</strong> {authStore.activityError()}
                </div>
              </Show>

              {/* Login button */}
              <Show when={!authStore.isLoading()}>
                <div class="flex flex-col items-center gap-6">
                  <LoginButton class="w-full justify-center" />

                  {/* Support shop entry — secondary CTA */}
                  <A
                    href="/shop"
                    class="group relative w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-300/40 text-slate-200 hover:text-white text-sm font-medium transition-all focus-ring-gold"
                  >
                    <ShoppingBag class="w-4 h-4 text-gold-300 group-hover:scale-110 transition-transform" />
                    Visit the support shop
                  </A>

                  {/* Features preview */}
                  <div class="w-full pt-6 border-t border-white/10">
                    <p class="text-center text-xs text-slate-400 uppercase tracking-wider mb-4">
                      What awaits you
                    </p>
                    <div class="grid grid-cols-3 gap-4">
                      <FeaturePreview
                        icon={<Swords class="w-6 h-6 text-red-300" />}
                        label="Tactical combat"
                      />
                      <FeaturePreview
                        icon={<Drama class="w-6 h-6 text-purple-300" />}
                        label="Characters"
                      />
                      <FeaturePreview
                        icon={<ScrollText class="w-6 h-6 text-amber-300" />}
                        label="Campaigns"
                      />
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Footer */}
          <footer class="mt-8 text-center space-y-2">
            <p class="text-slate-400/60 text-xs">
              By signing in, you agree to our{" "}
              <A href="/terms" class="text-slate-300 hover:text-white underline">
                terms of service
              </A>{" "}
              and our{" "}
              <A href="/privacy" class="text-slate-300 hover:text-white underline">
                privacy policy
              </A>
              .
            </p>
            <p class="flex items-center justify-center gap-2 text-[11px] text-slate-400/50">
              <A href="/legal" class="hover:text-slate-300 transition-colors">
                Legal notice
              </A>
              <span>·</span>
              <A href="/cookies" class="hover:text-slate-300 transition-colors">
                Cookies policy
              </A>
            </p>
          </footer>
        </div>
      </main>

      <style jsx>{`
        .login-page {
          background: linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%);
        }

        .login-title {
          background: linear-gradient(135deg, var(--plum-300) 0%, var(--plum-300) 25%, var(--plum-500) 50%, var(--plum-500) 75%, var(--plum-300) 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 40px rgba(139, 92, 246, 0.5), 0 0 80px rgba(139, 92, 246, 0.3);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
          animation: gradientShift 4s ease-in-out infinite;
        }

        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        .login-card {
          animation: cardSlideUp 0.6s ease-out;
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
        
        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
}

/**
 * Feature preview item component
 */
function FeaturePreview(props: { icon: JSX.Element; label: string }) {
  return (
    <div class="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
      <span>{props.icon}</span>
      <span class="text-xs text-slate-300/80 text-center leading-tight">
        {props.label}
      </span>
    </div>
  );
}

