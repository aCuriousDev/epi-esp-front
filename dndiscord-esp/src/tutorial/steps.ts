export type TutorialStep = {
  id: string;
  /** Route to navigate to for this step (optional). */
  route?: string;
  title: string;
  body: string;
  /** Label for the primary CTA. */
  cta?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    route: "/",
    title: "Bienvenue sur DnDiscord",
    body:
      "Objectif: créer un personnage, rejoindre une campagne, puis jouer une session sur une map en tour par tour (style D&D).",
    cta: "Commencer",
  },
  {
    id: "characters",
    route: "/characters",
    title: "Créer un personnage",
    body:
      "Va dans Personnages pour créer ton héros. Tu pourras le sélectionner dans le lobby avant de jouer.",
    cta: "J'ai compris",
  },
  {
    id: "campaigns",
    route: "/campaigns",
    title: "Rejoindre / créer une campagne",
    body:
      "Une campagne est votre aventure. Tu peux en créer une (MJ) ou en rejoindre une via un code d'invitation.",
  },
  {
    id: "campaign-view",
    title: "Lancer une session (MJ) / rejoindre (joueur)",
    body:
      "Quand le MJ lance une session, les autres joueurs reçoivent une popup « Rejoindre ? ». En rejoignant, tu arrives dans le lobby.",
  },
  {
    id: "lobby",
    route: "/board",
    title: "Lobby: choix du perso et attente",
    body:
      "Dans le lobby, sélectionne ton personnage. Le MJ peut placer les unités (ou placement aléatoire), puis cliquer « Prêt » pour démarrer.",
  },
  {
    id: "prep",
    route: "/board",
    title: "Préparation: placement sur la map",
    body:
      "Avant le combat, place ton unité. Le MJ peut aussi déplacer joueurs/ennemis et lancer un placement aléatoire.",
  },
  {
    id: "combat",
    route: "/board",
    title: "Combat tour par tour",
    body:
      "À ton tour: déplacer, agir (attaque/capacité), puis finir le tour. Les PV et les dégâts sont gérés pendant le combat.",
  },
  {
    id: "chat",
    route: "/board",
    title: "Chat vocal Discord",
    body:
      "Quand tu parles dans le chat de l'activité Discord, le message apparaît dans le panneau Chat et en bulles sur la carte.",
  },
  {
    id: "done",
    route: "/",
    title: "C'est prêt",
    body:
      "Tu peux relancer ce tutoriel à tout moment depuis Paramètres → Tutoriel (mode test).",
    cta: "Terminer",
  },
];

