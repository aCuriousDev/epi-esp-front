import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import "./index.css";
import App from "./App";
import CreateCharacter from "./pages/CreateCharacter";
import Rules from "./pages/Rules";
import Play from "./pages/Play";
import BoardGame from "./pages/BoardGame";
import type {} from "solid-styled-jsx";
import CharactersComponent from "./pages/CharactersComponent";

render(
	() => (
		<Router>
			<Route path="/" component={App} />
			<Route path="/characters" component={CharactersComponent} />
			<Route path="/characters/create" component={CreateCharacter} />
			<Route path="/play" component={Play} />
			<Route path="/rules" component={Rules} />
			<Route path="/board" component={BoardGame} />
		</Router>
	),
	document.getElementById("root") as HTMLElement
);
