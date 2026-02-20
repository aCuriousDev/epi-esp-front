import { DiscordSDK } from "@discord/embedded-app-sdk";
import type { User } from "./types/auth";

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
if (!clientId) {
  console.warn("[Discord] VITE_DISCORD_CLIENT_ID is not set");
}

const discordSdk = new DiscordSDK(clientId ?? "");

export interface DiscordAuthResult {
  user: User;
  access_token: string;
  token: string;
}

let auth: DiscordAuthResult | null = null;

/**
 * Configure et authentifie via le SDK Discord Embedded App (Discord Activity).
 * À appeler quand l'app tourne dans un iframe Discord (Activity).
 */
export async function setupDiscord(): Promise<DiscordAuthResult> {
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: clientId ?? "",
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  const apiUrl = import.meta.env.VITE_API_URL || "";
  const base = apiUrl.replace(/\/$/, "");
  const url = `${base}/api/discord/token`;
  const redirectUri = typeof window !== "undefined" ? window.location.origin : "";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  auth = {
    user: data.user,
    access_token: data.access_token,
    token: data.token,
  };

  return auth;
}

/**
 * Indique si l'app est probablement exécutée dans une Discord Activity (iframe).
 */
export function isDiscordActivityContext(): boolean {
  return typeof window !== "undefined" && window !== window.top;
}

export function getDiscordSdk(): DiscordSDK {
  return discordSdk;
}

export function getAuth(): DiscordAuthResult | null {
  return auth;
}
