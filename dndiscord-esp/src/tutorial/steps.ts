export type TutorialStep = {
  id: string;
  /** Route to navigate to for this step (optional). */
  route?: string;
  /** Optional UI target for spotlight (matches [data-tutorial="..."]). */
  target?: string;
  title: string;
  body: string;
  /** Label for the primary CTA. */
  cta?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    route: "/",
    target: "menu",
    title: "Welcome to DnDiscord!",
    body: "Goal: create a character, join a campaign, then play a turn-based session on a map (D&D style).",
    cta: "Get started",
  },
  {
    id: "characters",
    route: "/characters",
    target: "nav-characters",
    title: "Create a character",
    body: "Go to Characters to create your hero. You can select it in the lobby before playing.",
    cta: "Got it",
  },
  {
    id: "campaigns",
    route: "/campaigns",
    target: "nav-campaigns",
    title: "Join / create a campaign",
    body: "A campaign is your adventure. You can create one (DM) or join one via an invitation code.",
  },
  {
    id: "campaign-view",
    title: "Quick launch (DM) / join (player)",
    body: "When the DM starts a session, other players receive a \"Join?\" popup. After joining, you arrive in the lobby.",
  },
  {
    id: "lobby",
    route: "/practice/combat?demo=1",
    title: "Lobby: character selection and waiting",
    body: "Demo: we will launch a test map to show you the placement phase. (Nothing is sent to other players.)",
  },
  {
    id: "prep",
    route: "/practice/combat?demo=1",
    target: "prep-ready",
    title: "Preparation: placement on the map",
    body: "Before combat, place your unit on the allowed tiles. Then click \"Ready\" to start.",
  },
  {
    id: "combat",
    route: "/practice/combat?demo=1",
    title: "Turn-based combat",
    body: "On your turn: move, act (attack/ability), then end the turn. HP and damage are managed during combat.",
  },
  {
    id: "chat",
    route: "/practice/combat?demo=1",
    target: "chat-panel",
    title: "Discord voice chat",
    body: "When you speak in the Discord activity chat, the message appears in the Chat panel and as bubbles on the map.",
  },
  {
    id: "done",
    route: "/",
    title: "You're all set",
    body: "You can replay this tutorial at any time from Settings → Tutorial (test mode).",
    cta: "Finish",
  },
];
