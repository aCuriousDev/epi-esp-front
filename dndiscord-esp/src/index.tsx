import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import "./index.css";
import App from "./App";
import CreateCharacter from "./pages/CreateCharacter";
import CharacterView from "./pages/CharacterView";
import Rules from "./pages/Rules";
import BoardGame from "./pages/BoardGame";
import MapEditor from "./pages/MapEditor";
import MapSelectionScreen from "./pages/MapSelectionScreen";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import CampaignsPage from "./pages/CampaignsPage";
import CreateCampaign from "./pages/CreateCampaign";
import CampaignView from "./pages/CampaignView";
import SettingsPage from "./pages/SettingsPage";
import type {} from "solid-styled-jsx";
import CharactersComponent from "./pages/CharactersComponent";
import { AuthCallback, ProtectedRoute } from "./components/auth";
import { authStore } from "./stores/auth.store";
import { initDiscordSDK } from "./services/discord";
import { initDevLogBridge } from "./services/devLogBridge";
// CampaignManagerPage intentionally unimported: the story-tree authoring UI is
// disconnected from gameplay today. File kept for a future revival.
// import CampaignManagerPage from "./pages/CampaignManagerPage";
import SessionInviteListener from "./components/SessionInviteListener";
import EditCampaign from "./pages/EditCampaign";
import TutorialOverlay from "./components/TutorialOverlay";

// Dev-only: mirror console output to back log file.
if (import.meta.env.DEV) {
  initDevLogBridge();
}

// Initialize auth state on app load
authStore.init();

// Protected route wrapper component
function Protected(props: { children: any }) {
  return (
    <ProtectedRoute fallbackPath="/login">
      <SessionInviteListener />
      <TutorialOverlay />
      {props.children}
    </ProtectedRoute>
  );
}

// Initialise le SDK Discord en arrière-plan (ne bloque pas le rendu)
async function initDiscord() {
  try {
    // Timeout de 5 secondes pour éviter de bloquer indéfiniment
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Discord SDK initialization timeout")),
        5000,
      ),
    );

    await Promise.race([initDiscordSDK(), timeoutPromise]);
    console.log("Discord Activity initialized successfully");
  } catch (error) {
    // Ignore l'erreur - l'application fonctionne sans Discord SDK
    console.log(
      "Discord SDK not available (this is normal outside Discord):",
      error,
    );
  }
}

// Rend l'application immédiatement, puis initialise Discord en arrière-plan
render(
  () => (
    <Router>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/rules" component={Rules} />

      {/* Protected routes - require authentication */}
      <Route
        path="/"
        component={() => (
          <Protected>
            <App />
          </Protected>
        )}
      />
      <Route
        path="/settings"
        component={() => (
          <Protected>
            <SettingsPage />
          </Protected>
        )}
      />
      <Route
        path="/profile"
        component={() => (
          <Protected>
            <ProfilePage />
          </Protected>
        )}
      />
      <Route
        path="/characters"
        component={() => (
          <Protected>
            <CharactersComponent />
          </Protected>
        )}
      />
      <Route
        path="/characters/create"
        component={() => (
          <Protected>
            <CreateCharacter />
          </Protected>
        )}
      />
      <Route
        path="/characters/:id"
        component={() => (
          <Protected>
            <CharacterView />
          </Protected>
        )}
      />
      <Route
        path="/campaigns"
        component={() => (
          <Protected>
            <CampaignsPage />
          </Protected>
        )}
      />
      {/* /campaigns/:id/manager route removed — story tree is a follow-up */}
      <Route
        path="/campaigns/create"
        component={() => (
          <Protected>
            <CreateCampaign />
          </Protected>
        )}
      />
      <Route
        path="/campaigns/:id"
        component={() => (
          <Protected>
            <CampaignView />
          </Protected>
        )}
      />
      <Route
        path="/campaigns/:id/edit"
        component={() => (
          <Protected>
            <EditCampaign />
          </Protected>
        )}
      />
      <Route
        path="/board"
        component={() => (
          <Protected>
            <BoardGame />
          </Protected>
        )}
      />
      <Route
        path="/map-editor"
        component={() => (
          <Protected>
            <MapSelectionScreen />
          </Protected>
        )}
      />
      <Route
        path="/map-editor/:mapId"
        component={() => (
          <Protected>
            <MapEditor />
          </Protected>
        )}
      />
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);

// Initialise Discord en arrière-plan (ne bloque pas le rendu)
initDiscord();
