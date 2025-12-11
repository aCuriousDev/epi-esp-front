import { useNavigate } from "@solidjs/router";
import { createSignal, For, JSX } from "solid-js";
import { Settings } from "lucide-solid";

import { GameIconsFoldedPaper } from "../components/common/GameIconsFoldedPaper";
import { GameIconsPencilBrush } from "../components/common/GameIconsPencilBrush";
import { GameIconsCrossedSwords } from "../components/common/GameIconsCrossedSwords";
import ButtonMenu from "../components/common/ButtonMenu";

export default function MenuComponent() {
	const [hovered, setHovered] = createSignal<string | null>(null);
	const [menuItems, setMenuItems] = createSignal<
		Array<{
			label: string;
			icon?: JSX.Element;
			hoveringLabel: string;
			route: string;
			hoveringDescription?: string;
		}>
	>([
		{
			label: "Jouer",
			icon: <GameIconsCrossedSwords class="menu-badge-icon h-12 w-12" />,
			hoveringLabel: "play",
			route: "/play",
			hoveringDescription: "Commencez une aventure en un clic.",
		},
		{
			label: "Board Game (POC)",
			icon: <GameIconsCrossedSwords class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "board",
			route: "/board",
			hoveringDescription: "Testez le système de combat tactique sur plateau.",
		},
		{
			label: "Personnages",
			icon: <GameIconsPencilBrush class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "characters",
			route: "/characters",
			hoveringDescription: "Forgez un héros pour vos quêtes.",
		},
		{
			label: "Règles du jeu",
			icon: <GameIconsFoldedPaper class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "rules",
			route: "/rules",
			hoveringDescription: "Consultez les règles du jeu.",
		},
	]);
	const navigate = useNavigate();

	return (
		<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
			{/* Subtle vignette to increase contrast in iframe */}
			<div class="vignette absolute inset-0"></div>

			<main class="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-10 p-6 sm:p-10">
				<header class="text-center">
					<button
						class="settings-btn"
						aria-label="Paramètres"
						onClick={() => (location.hash = "#parametres")}
					>
						<Settings class="settings-icon h-5 w-5" />
					</button>
					<h1 class="title-shine title-gradient font-display text-white text-5xl sm:text-6xl md:text-7xl tracking-wide bg-clip-text text-transparent drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
						DnDiscord
					</h1>
					<p class="mt-3 text-slate-100/90 max-w-xl mx-auto">
						Retrouvez l'univers Donjons & Dragons dans un format Discord.
					</p>
					<div class="mt-6 mx-auto decorative-divider"></div>
				</header>

				<section class="flex w-full flex-col items-center gap-4">
					<For each={menuItems()}>
						{(item) => (
							<ButtonMenu
								label={item.label}
								icon={item.icon}
								onMouseEnter={() => setHovered(item.hoveringLabel)}
								onMouseLeave={() => setHovered(null)}
								onClick={() => navigate(item.route)}
							/>
						)}
					</For>
				</section>

				{/* Context hint area */}
				<footer class="mt-2 text-center text-xs text-slate-200/80">
					{menuItems().find((x) => x.hoveringLabel == hovered()) !=
					undefined ? (
						<span>
							{
								menuItems().find((x) => x.hoveringLabel == hovered())!
									.hoveringDescription
							}
						</span>
					) : null}
				</footer>
			</main>
		</div>
	);
}
