import axios from "axios";
import type { AuthTokenResponse, DiscordAuthUrlResponse, User } from "../types/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5054";

/**
 * Auth Service - handles all authentication API calls
 */
export const AuthService = {
  /**
   * Get Discord OAuth URL from backend
   */
  async getDiscordAuthUrl(): Promise<string> {
    const response = await axios.get<DiscordAuthUrlResponse>(
      `${API_URL}/api/auth/discord/url`
    );
    return response.data.url;
  },

  /**
   * Exchange Discord OAuth code for JWT token
   */
  async exchangeCode(code: string): Promise<AuthTokenResponse> {
    const response = await axios.post<AuthTokenResponse>(
      `${API_URL}/api/auth/discord/callback`,
      { code }
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
          }
        );
      }
    } finally {
      localStorage.removeItem("token");
    }
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
    const defaultIndex = user.discordId 
      ? parseInt(user.discordId) % 5 
      : 0;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  },
};

