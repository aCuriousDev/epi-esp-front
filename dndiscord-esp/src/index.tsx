import { onMount } from "solid-js";
import { render } from "solid-js/web";
import { Router, Route, useNavigate, type RouteSectionProps } from "@solidjs/router";
import "./index.css";
import "./App"; // keep font-side-effects from @fontsource imports defined in App.tsx

// Pages
import Home from "./pages/Home";
import CreateCharacter from "./pages/CreateCharacter";
import CharacterView from "./pages/CharacterView";
import CharactersComponent from "./pages/CharactersComponent";
import Rules from "./pages/Rules";
import BoardGame from "./pages/BoardGame";
import MapEditor from "./pages/MapEditor";
import MapSelectionScreen from "./pages/MapSelectionScreen";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import CampaignsPage from "./pages/CampaignsPage";
import CreateCampaign from "./pages/CreateCampaign";
import CampaignView from "./pages/CampaignView";
import EditCampaign from "./pages/EditCampaign";
import CampaignManagerPage from "./pages/CampaignManagerPage";
import CampaignLobbyPage from "./pages/CampaignLobbyPage";
import CampaignSessionPage from "./pages/CampaignSessionPage";
import CampaignSessionsListPage from "./pages/CampaignSessionsListPage";
import CampaignSessionReplayPage from "./pages/CampaignSessionReplayPage";
import SettingsPage from "./pages/SettingsPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import MentionsLegales from "./pages/MentionsLegales";
import CookiesPolicy from "./pages/CookiesPolicy";
import PracticeModeSelectPage from "./pages/PracticeModeSelectPage";

// Auth
import { AuthCallback } from "./components/auth";

// Layouts
import MenuShell from "./layouts/MenuShell";
import GameShell from "./layouts/GameShell";

// App-level wiring
import { authStore } from "./stores/auth.store";
import { initDiscordSDK } from "./services/discord";
import { initDevLogBridge } from "./services/devLogBridge";

import type {} from "solid-styled-jsx";

if (import.meta.env.DEV) {
  initDevLogBridge();
}

authStore.init();

async function initDiscord() {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Discord SDK initialization timeout")), 5000),
    );
    await Promise.race([initDiscordSDK(), timeoutPromise]);
    console.log("Discord Activity initialized successfully");
  } catch (error) {
    console.log("Discord SDK not available (this is normal outside Discord):", error);
  }
}

function RouterRoot(props: RouteSectionProps) {
  return <>{props.children}</>;
}

function BoardRedirect() {
  const navigate = useNavigate();
  onMount(() => {
    // Préserver le query string pour les liens legacy (/board?fromSession=1, /board?demo=1).
    // Sans ça, ?fromSession=1 est perdu et le lancement de carte atterrit sur
    // PracticeModeSelectPage au lieu de BoardGame.
    const qs = window.location.search;
    navigate(qs ? `/practice/session${qs}` : "/practice", { replace: true });
  });
  return null;
}

render(
  () => (
    <Router root={RouterRoot}>
      {/* Public — no shell */}
      <Route path="/login" component={LoginPage} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/legal" component={MentionsLegales} />
      <Route path="/cookies" component={CookiesPolicy} />

      {/* Compat: old /board → /practice */}
      <Route path="/board" component={BoardRedirect} />

      {/* Menu shell — chromed pages with auth gate */}
      <Route path="/" component={MenuShell}>
        <Route path="/" component={Home} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/rules" component={Rules} />
        <Route path="/characters" component={CharactersComponent} />
        <Route path="/characters/create" component={CreateCharacter} />
        <Route path="/characters/:id" component={CharacterView} />
        <Route path="/campaigns" component={CampaignsPage} />
        <Route path="/campaigns/create" component={CreateCampaign} />
        <Route path="/campaigns/:id" component={CampaignView} />
        <Route path="/campaigns/:id/edit" component={EditCampaign} />
        <Route path="/campaigns/:id/sessions" component={CampaignSessionsListPage} />
        <Route path="/campaigns/:id/sessions/:sessionId" component={CampaignSessionReplayPage} />
        <Route path="/map-editor" component={MapSelectionScreen} />
        <Route path="/practice" component={PracticeModeSelectPage} />
      </Route>

      {/* Game shell — full-bleed in-game pages */}
      <Route path="/" component={GameShell}>
        <Route path="/campaigns/:id/lobby" component={CampaignLobbyPage} />
        <Route path="/campaigns/:id/session" component={CampaignSessionPage} />
        <Route path="/campaigns/:id/manager" component={CampaignManagerPage} />
        <Route path="/map-editor/:mapId" component={MapEditor} />
        <Route path="/practice/:mode" component={BoardGame} />
      </Route>
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);

initDiscord();
