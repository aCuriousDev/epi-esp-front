import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import "./index.css";
import App from "./App";
import CreateCharacter from "./pages/CreateCharacter";
import CharacterView from "./pages/CharacterView";
import Rules from "./pages/Rules";
import BoardGame from "./pages/BoardGame";
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
import CampaignManagerPage from "./pages/CampaignManagerPage";

// Initialize auth state on app load
authStore.init();

// Protected route wrapper component
function Protected(props: { children: any }) {
	return (
		<ProtectedRoute fallbackPath="/login">
			{props.children}
		</ProtectedRoute>
	);
}

render(
	() => (
		<Router>
			{/* Public routes */}
			<Route path="/login" component={LoginPage} />
			<Route path="/auth/callback" component={AuthCallback} />
			<Route path="/rules" component={Rules} />
			
			{/* Protected routes - require authentication */}
			<Route path="/" component={() => <Protected><App /></Protected>} />
			<Route path="/settings" component={() => <Protected><SettingsPage /></Protected>} />
			<Route path="/profile" component={() => <Protected><ProfilePage /></Protected>} />
			<Route path="/characters" component={() => <Protected><CharactersComponent /></Protected>} />
			<Route path="/characters/create" component={() => <Protected><CreateCharacter /></Protected>} />
			<Route path="/characters/:id" component={() => <Protected><CharacterView /></Protected>} />
			<Route path="/campaigns" component={() => <Protected><CampaignsPage /></Protected>} />
			<Route path="/campaigns/:id/manager" component={() => <Protected><CampaignManagerPage /></Protected>} />
			<Route path="/campaigns/create" component={() => <Protected><CreateCampaign /></Protected>} />
			<Route path="/campaigns/:id" component={() => <Protected><CampaignView /></Protected>} />
			<Route path="/board" component={() => <Protected><BoardGame /></Protected>} />
			
		</Router>
	),
	document.getElementById("root") as HTMLElement
);
