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
    title: "Welcome to DnDiscord!",
    body: "This quick tour shows you the three pillars of the app: your characters, your campaigns, and the combat map. Ready?",
    cta: "Let's go",
  },
  {
    id: "characters",
    route: "/",
    target: "nav-characters",
    title: "Your characters",
    body: "Start by creating a hero here. You'll be able to pick it in the lobby before every session — give it a name, a class, and a portrait.",
    cta: "Got it",
  },
  {
    id: "campaigns",
    route: "/campaigns",
    target: "campaigns-panel",
    title: "Campaigns",
    body: "A campaign is your adventure. Create one as DM or join one with an invite code. Once inside, the DM can launch a session and invite the whole party.",
  },
  {
    id: "campaign-view",
    title: "Joining a session",
    body: "When the DM starts a session, everyone in the campaign gets a \"Join?\" notification. Accept it and you'll land in the lobby to pick your character.",
  },
  {
    id: "lobby",
    route: "/practice/combat?demo=1",
    title: "Demo: the combat map",
    body: "We're opening a practice map so you can see what a session looks like. Nothing is saved or sent to other players.",
  },
  {
    id: "prep",
    route: "/practice/combat?demo=1",
    target: "prep-ready",
    title: "Placement phase",
    body: "Before combat starts, place your unit on the highlighted tiles. When you're happy with your position, click Ready.",
  },
  {
    id: "combat",
    route: "/practice/combat?demo=1",
    title: "Turn-based combat",
    body: "On your turn: move across the grid, use an action (attack, ability…), then end your turn. HP and effects are tracked automatically.",
  },
  {
    id: "chat",
    route: "/practice/combat?demo=1",
    target: "chat-panel",
    title: "Chat & voice",
    body: "Messages from Discord voice activity appear here and as speech bubbles on the map — keep the roleplay going without switching windows.",
  },
  {
    id: "done",
    route: "/",
    title: "You're all set!",
    body: "You can replay this tour any time from Settings → Tutorial. Now go create your first character and start an adventure.",
    cta: "Let's play",
  },
];
