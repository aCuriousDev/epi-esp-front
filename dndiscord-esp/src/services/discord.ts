import { DiscordSDK } from "@discord/embedded-app-sdk";

// Instance singleton du SDK Discord
let discordSdkInstance: DiscordSDK | null = null;
let isInitialized = false;

/**
 * Initialise le SDK Discord et attend la connexion au client Discord
 * @returns Promise<DiscordSDK> - Instance du SDK Discord
 */
export async function initDiscordSDK(): Promise<DiscordSDK> {
  if (discordSdkInstance && isInitialized) {
    return discordSdkInstance;
  }

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;

  if (!clientId) {
    console.warn(
      "VITE_DISCORD_CLIENT_ID is not set. Discord SDK will not be initialized.",
    );
    throw new Error("Discord Client ID is required");
  }

  try {
    discordSdkInstance = new DiscordSDK(clientId);

    // Attend la connexion au client Discord
    await discordSdkInstance.ready();

    isInitialized = true;

    console.log("Discord SDK initialized successfully");

    return discordSdkInstance;
  } catch (error) {
    console.error("Failed to initialize Discord SDK:", error);
    throw error;
  }
}

/**
 * Récupère l'instance du SDK Discord (doit être initialisée avant)
 * @returns DiscordSDK | null
 */
export function getDiscordSDK(): DiscordSDK | null {
  return discordSdkInstance;
}

/**
 * Vérifie si le SDK Discord est initialisé
 * @returns boolean
 */
export function isDiscordSDKReady(): boolean {
  return isInitialized && discordSdkInstance !== null;
}

/**
 * Récupère l'utilisateur Discord actuel
 * @returns User | null
 */
export function getCurrentDiscordUser() {
  if (!discordSdkInstance) {
    return null;
  }
  return (discordSdkInstance as any).user ?? null;
}

/**
 * Récupère les IDs du contexte Discord (guildId / channelId)
 * @returns { guildId: string; channelId: string } | null
 */
export function getDiscordContextIds(): {
  guildId: string;
  channelId: string;
  voiceChannelId: string;
} | null {
  if (!discordSdkInstance) return null;
  const anySdk = discordSdkInstance as any;
  const guildId = String(anySdk.guildId ?? anySdk?.guild_id ?? "");
  const channelId = String(anySdk.channelId ?? anySdk?.channel_id ?? "");

  const voiceChannelId = String(
    anySdk.voiceChannelId ??
      anySdk?.voice_channel_id ??
      anySdk?.voice?.channelId ??
      anySdk?.voice?.channel_id ??
      "",
  );

  if (!guildId || !channelId) return null;
  return { guildId, channelId, voiceChannelId };
}

/**
 * Envoie un événement de présence Discord (ex: "Joue à DnDiscord")
 * @param activity - Activité à afficher
 */
export async function setDiscordActivity(activity: {
  details?: string;
  state?: string;
}) {
  if (!discordSdkInstance || !isInitialized) {
    console.warn("Discord SDK not initialized. Cannot set activity.");
    return;
  }

  try {
    // Le SDK Discord gère automatiquement la présence via l'iframe
    // Vous pouvez utiliser les commandes Discord pour définir des activités personnalisées
    console.log("Discord activity:", activity);
  } catch (error) {
    console.error("Failed to set Discord activity:", error);
  }
}
