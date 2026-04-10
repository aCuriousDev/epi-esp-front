import { createStore } from "solid-js/store";

export type PartyChatAuthorRole = "DM" | "Player";

export interface PartyChatMessage {
  sessionId: string;
  content: string;
  authorName: string;
  authorUserId?: string;
  authorDiscordId: string;
  authorAvatar?: string | null;
  authorRole: PartyChatAuthorRole;
  timestamp: number;
  messageId: string;
}

export interface PartyChatState {
  messages: PartyChatMessage[];
}

export const [partyChatState, setPartyChatState] = createStore<PartyChatState>({
  messages: [],
});

export function addPartyChatMessage(msg: PartyChatMessage): void {
  setPartyChatState("messages", (prev) => {
    if (prev.some((m) => m.messageId === msg.messageId)) return prev;
    const next = [...prev, msg];
    return next.length > 200 ? next.slice(next.length - 200) : next;
  });
}

export function clearPartyChat(): void {
  setPartyChatState("messages", []);
}
