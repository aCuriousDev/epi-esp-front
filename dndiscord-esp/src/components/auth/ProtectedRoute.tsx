import { Show, JSX, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authStore } from "../../stores/auth.store";

interface ProtectedRouteProps {
  children: JSX.Element;
  fallbackPath?: string;
}

/**
 * Protected Route - Redirects to login if not authenticated
 */
export default function ProtectedRoute(props: ProtectedRouteProps) {
  const navigate = useNavigate();
  const fallbackPath = props.fallbackPath || "/login";

  // Redirect if not authenticated (after loading completes)
  createEffect(() => {
    if (!authStore.isLoading() && !authStore.isAuthenticated()) {
      navigate(fallbackPath, { replace: true });
    }
  });

  return (
    <>
      {/* Show loading spinner while checking auth */}
      <Show when={authStore.isLoading()}>
        <div class="min-h-screen flex items-center justify-center bg-brand-gradient">
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p class="text-white text-lg">Vérification de l'authentification...</p>
          </div>
        </div>
      </Show>

      {/* Show content if authenticated */}
      <Show when={!authStore.isLoading() && authStore.isAuthenticated()}>
        {props.children}
      </Show>
    </>
  );
}

