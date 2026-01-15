export interface User {
  id: string;
  username: string;
  email: string;
  discordId?: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthTokenResponse {
  token: string;
  user: User;
}

export interface DiscordAuthUrlResponse {
  url: string;
}

export type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

