import axios from "axios";
import type {
  AuthTokenResponse,
  DiscordAuthUrlResponse,
  User,
} from "../types/auth";
import { getApiUrl } from "./config";

const API_URL = getApiUrl();

/**
 * Auth Service - handles all authentication API calls
 */
export const AuthService = {
  /**
   * Get Discord OAuth URL from backend (requires fetch — blocked by CSP in Discord embed)
   */
  async getDiscordAuthUrl(): Promise<string> {
    const response = await axios.get<DiscordAuthUrlResponse>(
      `${API_URL}/api/auth/discord/url`,
    );
    return response.data.url;
  },

  /**
   * URL de redirection vers Discord OAuth. À utiliser pour la popup ou la redirection fenêtre.
   * state = URL de retour (quand la popup est bloquée, ex. activité Discord).
   */
  getDiscordRedirectUrl(state?: string): string {
    const base = `${API_URL}/api/auth/discord/redirect`;
    if (!state) return base;
    return base + "?state=" + encodeURIComponent(state);
  },

  /**
   * Exchange Discord OAuth code for JWT token
   */
  async exchangeCode(code: string): Promise<AuthTokenResponse> {
    const response = await axios.post<AuthTokenResponse>(
      `${API_URL}/api/auth/discord/callback`,
      { code },
    );
    return response.data;
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No token found");
    }

    const response = await axios.get<User>(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  /**
   * Logout - clears local token and calls backend
   */
  async logout(): Promise<void> {
    const token = localStorage.getItem("token");

    try {
      if (token) {
        await axios.post(
          `${API_URL}/api/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
    } finally {
      localStorage.removeItem("token");
    }
  },

  /**
   * Supprime le compte et toutes les données associées (RGPD art. 17).
   * Côté serveur : cascade sur Characters, Campaigns possédées, memberships,
   * révocation du token Discord. Le token local est effacé dans tous les cas.
   */
  async deleteAccount(): Promise<void> {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token found");

    try {
      await axios.delete(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally {
      localStorage.removeItem("token");
    }
  },

  /**
   * Exporte les données personnelles au format JSON (RGPD art. 20).
   * Renvoie l'objet Blob prêt à être téléchargé.
   */
  async exportData(): Promise<Blob> {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token found");

    const response = await axios.get(`${API_URL}/api/auth/me/export`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
    });
    return response.data as Blob;
  },

  /**
   * Check if user has a stored token
   */
  hasToken(): boolean {
    return !!localStorage.getItem("token");
  },

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem("token");
  },

  /**
   * Store token in localStorage
   */
  setToken(token: string): void {
    localStorage.setItem("token", token);
  },

  /**
   * Get Discord avatar URL
   */
  getAvatarUrl(user: User): string {
    if (user.avatar && user.discordId) {
      return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`;
    }
    // Default Discord avatar
    const defaultIndex = user.discordId ? parseInt(user.discordId) % 5 : 0;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  },
};
