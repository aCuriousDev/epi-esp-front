import { Show, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authStore } from "../stores/auth.store";
import { LoginButton } from "../components/auth";
import { AnimatedD20 } from "../components/common/AnimatedD20";

/**
 * Login Page - Landing page for unauthenticated users
 */
export default function LoginPage() {
  const navigate = useNavigate();

  // Redirect to home if already authenticated
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
            {/* Animated D20 dice - click to re-roll */}
            <div class="flex justify-center mb-6">
              <AnimatedD20 size={96} />
            </div>

            <h1 class="login-title font-display text-5xl sm:text-6xl tracking-wide">
              DnDiscord
            </h1>
            <p class="mt-4 text-slate-200/80 text-lg">
              Votre aventure commence ici
            </p>
          </header>

          {/* Login card */}
          <div class="login-card relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/30">
            {/* Card glow */}
            <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
            
            <div class="relative z-10">
              <h2 class="text-center text-xl font-semibold text-white mb-2">
                Bienvenue, aventurier !
              </h2>
              <p class="text-center text-slate-300/70 text-sm mb-8">
                Connectez-vous avec Discord pour accéder à vos personnages et campagnes.
              </p>

              {/* Loading state */}
              <Show when={authStore.isLoading()}>
                <div class="flex flex-col items-center gap-4 py-4">
                  <div class="w-10 h-10 border-3 border-white/20 border-t-purple-500 rounded-full animate-spin" />
                  <p class="text-slate-300/70 text-sm">Vérification de la session...</p>
                </div>
              </Show>

              {/* Login button */}
              <Show when={!authStore.isLoading()}>
                <div class="flex flex-col items-center gap-6">
                  <LoginButton class="w-full justify-center" />
                  
                  {/* Features preview */}
                  <div class="w-full pt-6 border-t border-white/10">
                    <p class="text-center text-xs text-slate-400 uppercase tracking-wider mb-4">
                      Ce qui vous attend
                    </p>
                    <div class="grid grid-cols-3 gap-4">
                      <FeaturePreview 
                        icon="⚔️" 
                        label="Combats tactiques" 
                      />
                      <FeaturePreview 
                        icon="🎭" 
                        label="Personnages" 
                      />
                      <FeaturePreview 
                        icon="📜" 
                        label="Campagnes" 
                      />
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Footer */}
          <footer class="mt-8 text-center">
            <p class="text-slate-400/60 text-xs">
              En vous connectant, vous acceptez nos conditions d'utilisation.
            </p>
          </footer>
        </div>
      </main>

      <style jsx>{`
        .login-page {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%);
        }

        .login-title {
          background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 25%, #8b5cf6 50%, #7c3aed 75%, #a78bfa 100%);
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
function FeaturePreview(props: { icon: string; label: string }) {
  return (
    <div class="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
      <span class="text-2xl">{props.icon}</span>
      <span class="text-xs text-slate-300/80 text-center leading-tight">
        {props.label}
      </span>
    </div>
  );
}

