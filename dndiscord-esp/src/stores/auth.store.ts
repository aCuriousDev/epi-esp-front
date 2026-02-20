import { createSignal, createRoot } from "solid-js";
import type { User } from "../types/auth";
import { AuthService } from "../services/auth.service";

/**
 * Global auth store using SolidJS signals
 * Created with createRoot to persist across component lifecycles
 */
function createAuthStore() {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);

  /**
   * Initialize auth state from stored token
   */
  async function init() {
    setIsLoading(true);

    if (AuthService.hasToken()) {
      try {
        const currentUser = await AuthService.getCurrentUser();
        setUser(currentUser);
        setIsAuthenticated(true);
      } catch (error: any) {
        // Token is invalid or expired - clear it silently
        console.warn("Session expired or invalid, clearing token");
        localStorage.removeItem("token");
        setUser(null);
        setIsAuthenticated(false);

        // Don't log the full error in production - it's expected when tokens expire
        if (import.meta.env.DEV) {
          console.debug(
            "Token validation failed:",
            error?.response?.status || error?.message,
          );
        }
      }
    }

    setIsLoading(false);
  }

  /**
   * Login with Discord OAuth code
   */
  async function loginWithCode(code: string) {
    setIsLoading(true);

    try {
      const response = await AuthService.exchangeCode(code);
      AuthService.setToken(response.token);
      setUser(response.user);
      setIsAuthenticated(true);
      return response.user;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Set user directly (used by popup callback)
   */
  function setAuthData(userData: User, token: string) {
    AuthService.setToken(token);
    setUser(userData);
    setIsAuthenticated(true);
  }

  /**
   * Logout user
   */
  async function logout() {
    setIsLoading(true);

    try {
      await AuthService.logout();
    } catch (error) {
      console.warn("Logout API call failed:", error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }

  /**
   * Open Discord OAuth popup
   */
  async function openDiscordLogin(): Promise<void> {
    try {
      const authUrl = AuthService.getDiscordRedirectUrl();

      // Calculate popup position (center of screen)
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        "Discord Login",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
      );

      if (!popup) {
        throw new Error(
          "Popup was blocked. Please allow popups for this site.",
        );
      }

      // Listen for message from popup
      return new Promise((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          // Verify origin
          if (event.origin !== window.location.origin) return;

          if (event.data?.type === "AUTH_SUCCESS") {
            window.removeEventListener("message", handleMessage);
            const { user, token } = event.data.payload;
            setAuthData(user, token);
            resolve();
          } else if (event.data?.type === "AUTH_ERROR") {
            window.removeEventListener("message", handleMessage);
            reject(new Error(event.data.error || "Authentication failed"));
          }
        };

        window.addEventListener("message", handleMessage);

        // Check if popup was closed without completing auth
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", handleMessage);
            // Don't reject - user may have just closed the popup
            resolve();
          }
        }, 500);
      });
    } catch (error) {
      console.error("Discord login error:", error);
      throw error;
    }
  }

  return {
    // State (getters)
    user,
    isLoading,
    isAuthenticated,

    // Actions
    init,
    loginWithCode,
    setAuthData,
    logout,
    openDiscordLogin,
  };
}

// Create singleton store instance
export const authStore = createRoot(createAuthStore);
