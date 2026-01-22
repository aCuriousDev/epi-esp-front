import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import "./index.css";
import App from "./App";
import CreateCharacter from "./pages/CreateCharacter";
import Rules from "./pages/Rules";
import Play from "./pages/Play";
import BoardGame from "./pages/BoardGame";
import MapEditor from "./pages/MapEditor";
import MapSelectionScreen from "./pages/MapSelectionScreen";
import type {} from "solid-styled-jsx";
import CharactersComponent from "./pages/CharactersComponent";
import { initDiscordSDK } from "./services/discord";

// Initialise le SDK Discord en arrière-plan (ne bloque pas le rendu)
async function initDiscord() {
	try {
		// Timeout de 5 secondes pour éviter de bloquer indéfiniment
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('Discord SDK initialization timeout')), 5000)
		);
		
		await Promise.race([initDiscordSDK(), timeoutPromise]);
		console.log("Discord Activity initialized successfully");
	} catch (error) {
		// Ignore l'erreur - l'application fonctionne sans Discord SDK
		console.log("Discord SDK not available (this is normal outside Discord):", error);
	}
}

// Rend l'application immédiatement, puis initialise Discord en arrière-plan
render(
	() => (
		<Router>
			<Route path="/" component={App} />
			<Route path="/characters" component={CharactersComponent} />
			<Route path="/characters/create" component={CreateCharacter} />
			<Route path="/play" component={Play} />
			<Route path="/rules" component={Rules} />
			<Route path="/board" component={BoardGame} />
			<Route path="/map-editor" component={MapSelectionScreen} />
			<Route path="/map-editor/:mapId" component={MapEditor} />
		</Router>
	),
	document.getElementById("root") as HTMLElement
);

// Initialise Discord en arrière-plan (ne bloque pas le rendu)
initDiscord();
