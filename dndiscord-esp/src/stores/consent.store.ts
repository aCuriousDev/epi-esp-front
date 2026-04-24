/**
 * Cookie / Storage Consent Store
 *
 * Pilote la bannière d'information RGPD et expose l'état de prise de
 * connaissance par l'utilisateur.
 *
 * === Raisonnement légal (à relire avant d'ajouter un tracker) ===
 *
 * DnDiscord n'utilise QUE du stockage exempté de consentement au sens de
 * la Recommandation CNIL n° 2020-092 :
 *   - authentification (JWT) → exempté
 *   - personnalisation d'interface (graphiques, son, tutoriel) → exempté
 *   - contenu fonctionnel mis en cache (personnages, cartes) → exempté
 *
 * Stricto sensu la CNIL n'exige AUCUNE bannière pour un service
 * exempté-only. Nous affichons malgré tout une bannière informative
 * (prise de connaissance, pas de consentement gatant) pour :
 *   1) transparence envers l'utilisateur (brief projet)
 *   2) conformité Discord Developer Policy qui demande une divulgation
 *      claire du stockage côté client
 *
 * ⚠️ CE COMPOSANT N'EST PAS UN CONSENT GATE. Si un jour on intègre un
 * tracker publicitaire ou un outil d'analyse tiers (GA, Meta Pixel…),
 * il FAUT refondre ce store pour une vraie bannière consent CNIL-compliant
 * (boutons Accepter / Refuser d'égale simplicité, pas d'ack par usage
 * continué, blocage effectif des scripts tant que pas de OK). La clé
 * `dndiscord_consent_v1` est versionnée pour pouvoir re-déclencher
 * l'acquittement à ce moment-là.
 *
 * Persisté dans localStorage sous `dndiscord_consent_v1`.
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

const initial = load();
const [acknowledged, setAcknowledgedRaw] = createSignal(initial.acknowledged);
const [bannerOpen, setBannerOpen] = createSignal(!initial.acknowledged);
const [preferencesOpen, setPreferencesOpen] = createSignal(false);
// Signale que l'écriture localStorage a échoué (mode privé Safari, quota
// strict en iframe Discord Activity, etc.). Utilisé par l'UI pour informer
// l'utilisateur que son acquittement ne sera pas mémorisé entre sessions.
const [storageUnavailable, setStorageUnavailable] = createSignal(false);

function persistAndSignal(state: ConsentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStorageUnavailable(false);
  } catch {
    setStorageUnavailable(true);
    console.warn(
      "[consent] localStorage indisponible — l'acquittement ne sera pas persisté entre sessions.",
    );
  }
}

function acknowledge() {
  const next: ConsentState = {
    acknowledged: true,
    acknowledgedAt: new Date().toISOString(),
  };
  setAcknowledgedRaw(true);
  setBannerOpen(false);
  setPreferencesOpen(false);
  persistAndSignal(next);
}

/**
 * Vide toutes les clés de préférences locales (graphiques, son, tutoriel…)
 * y compris la prise de connaissance de cette politique (la bannière se
 * réaffichera à la prochaine visite, conformément à l'attente utilisateur
 * d'un reset complet). Laisse l'authentification (token, session) et le
 * contenu utilisateur (personnages, cartes) intacts — « Supprimer mon
 * compte » couvre ces données-là.
 */
function clearPreferenceStorage() {
  const keys = [
    "dnd-sound-settings",
    "dnd-graphics-settings",
    "dndiscord_tutorial_completed",
    STORAGE_KEY,
  ];
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  // Ré-aligner l'état in-memory avec le storage effacé.
  setAcknowledgedRaw(false);
  setBannerOpen(true);
}

export const consentStore = {
  acknowledged,
  bannerOpen,
  preferencesOpen,
  storageUnavailable,
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
