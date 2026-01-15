import { onMount, createSignal, Show } from "solid-js";
import { AuthService } from "../../services/auth.service";

/**
 * Auth Callback Page - Handles OAuth redirect in popup
 * Exchanges code for token and sends result back to parent window
 */
export default function AuthCallback() {
  const [status, setStatus] = createSignal<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = createSignal("");

  onMount(async () => {
    try {
      // Get code from URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const error = urlParams.get("error");
      const errorDescription = urlParams.get("error_description");

      if (error) {
        throw new Error(errorDescription || error || "OAuth error");
      }

      if (!code) {
        throw new Error("No authorization code received");
      }

      // Exchange code for token
      const response = await AuthService.exchangeCode(code);

      // Send success message to parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "AUTH_SUCCESS",
            payload: {
              user: response.user,
              token: response.token,
            },
          },
          window.location.origin
        );
      }

      setStatus("success");

      // Close popup after short delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setErrorMessage(message);
      setStatus("error");

      // Send error message to parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "AUTH_ERROR",
            error: message,
          },
          window.location.origin
        );
      }

      // Close popup after showing error
      setTimeout(() => {
        window.close();
      }, 3000);
    }
  });

  return (
    <div class="min-h-screen flex items-center justify-center bg-brand-gradient">
      <div class="text-center p-8 max-w-md">
        {/* Loading State */}
        <Show when={status() === "loading"}>
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p class="text-white text-lg">Connexion en cours...</p>
          </div>
        </Show>

        {/* Success State */}
        <Show when={status() === "success"}>
          <div class="flex flex-col items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg class="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p class="text-white text-lg font-medium">Connecté avec succès!</p>
            <p class="text-white/60 text-sm">Cette fenêtre va se fermer automatiquement...</p>
          </div>
        </Show>

        {/* Error State */}
        <Show when={status() === "error"}>
          <div class="flex flex-col items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p class="text-white text-lg font-medium">Erreur de connexion</p>
            <p class="text-red-400 text-sm">{errorMessage()}</p>
            <p class="text-white/60 text-sm mt-2">Cette fenêtre va se fermer automatiquement...</p>
          </div>
        </Show>
      </div>
    </div>
  );
}

