/**
 * Cookie / Storage Consent Store
 *
 * Pilote la bannière d'information RGPD et expose l'état de prise de
 * connaissance par l'utilisateur. DnDiscord n'utilise que du stockage
 * exempté de consentement (authentification + préférences d'interface,
 * cf. CNIL « cookies et autres traceurs »), donc la bannière est
 * informative : l'utilisateur « prend connaissance », il peut aussi
 * choisir de vider ses préférences locales.
 *
 * Persisté dans localStorage sous `dndiscord_consent_v1`. Le suffixe de
 * version permet de re-déclencher la bannière si, plus tard, on ajoute
 * une catégorie réellement soumise à consentement (ex. analytics).
 */

import { createSignal } from "solid-js";

const STORAGE_KEY = "dndiscord_consent_v1";

export interface ConsentState {
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

const DEFAULT_STATE: ConsentState = {
  acknowledged: false,
  acknowledgedAt: null,
};

function load(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      acknowledged: !!parsed.acknowledged,
      acknowledgedAt:
        typeof parsed.acknowledgedAt === "string"
          ? parsed.acknowledgedAt
          : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function persist(state: ConsentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage peut être indisponible (mode privé strict) */
  }
}

const initial = load();
const [acknowledged, setAcknowledgedRaw] = createSignal(initial.acknowledged);
const [bannerOpen, setBannerOpen] = createSignal(!initial.acknowledged);
const [preferencesOpen, setPreferencesOpen] = createSignal(false);

function acknowledge() {
  const next: ConsentState = {
    acknowledged: true,
    acknowledgedAt: new Date().toISOString(),
  };
  setAcknowledgedRaw(true);
  setBannerOpen(false);
  setPreferencesOpen(false);
  persist(next);
}

/**
 * Vide toutes les clés de préférences locales (graphiques, son, tutoriel…).
 * Laisse l'authentification (token, session) et le contenu utilisateur
 * (personnages, cartes) intacts — l'utilisateur utilise « Supprimer mon
 * compte » pour ces données-là.
 */
function clearPreferenceStorage() {
  const keys = [
    "dnd-sound-settings",
    "dnd-graphics-settings",
    "dndiscord_tutorial_completed",
  ];
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

export const consentStore = {
  acknowledged,
  bannerOpen,
  preferencesOpen,
  acknowledge,
  openPreferences() {
    setPreferencesOpen(true);
  },
  closePreferences() {
    setPreferencesOpen(false);
  },
  /** Réouvre la bannière depuis un lien « Gérer mes préférences locales ». */
  reopenBanner() {
    setBannerOpen(true);
  },
  clearPreferenceStorage,
};
