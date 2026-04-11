import { useNavigate } from "@solidjs/router";
import { createSignal, For, JSX, onCleanup, onMount, Show } from "solid-js";
import { Settings, ScrollText, Swords, Users, BookOpen } from "lucide-solid";

import { GameIconsFoldedPaper } from "../components/common/GameIconsFoldedPaper";
import { GameIconsPencilBrush } from "../components/common/GameIconsPencilBrush";
import { GameIconsCrossedSwords } from "../components/common/GameIconsCrossedSwords";
import { GameIconsTreasureMap } from "../components/common/GameIconsTreasureMap";
import { AnimatedD20 } from "../components/common/AnimatedD20";
import ButtonMenu from "../components/common/ButtonMenu";
import { LoginButton, UserMenu } from "../components/auth";
import { authStore } from "../stores/auth.store";
import { playAmbientMusic, stopAmbientMusic, playMenuHoverSound, playMenuClickSound } from "../game/audio/SoundIntegration";

export default function MenuComponent() {
	const [hovered, setHovered] = createSignal<string | null>(null);

	onMount(() => playAmbientMusic('menu'));
	onCleanup(() => stopAmbientMusic());

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
			route: "/board",
			hoveringDescription: "Lancez une partie et explorez le système de combat tactique.",
		},
		{
			label: "Personnages",
			icon: <GameIconsPencilBrush class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "characters",
			route: "/characters",
			hoveringDescription: "Forgez un héros pour vos quêtes.",
		},
		{
			label: "Campagnes",
			icon: <ScrollText class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "campaigns",
			route: "/campaigns",
			hoveringDescription: "Gérez vos campagnes et sessions de jeu.",
		},
		{
			label: "Campagnes Manager",
			icon: <ScrollText class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "campaigns",
			route: "/campaigns-manager",
			hoveringDescription: "Gérez vos campagnes",
		},
		{
			label: "Règles du jeu",
			icon: <GameIconsFoldedPaper class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "rules",
			route: "/rules",
			hoveringDescription: "Consultez les règles du jeu.",
		},
		{
			label: "Map Editor",
			icon: <GameIconsTreasureMap class="menu-badge-icon h-10 w-10" />,
			hoveringLabel: "map-editor",
			route: "/map-editor",
			hoveringDescription: "Créez et éditez vos propres cartes de jeu.",
		},
	]);
	const navigate = useNavigate();

	return (
		<div class="menu-page relative min-h-screen w-full overflow-hidden">
			{/* Animated background elements */}
			<div class="absolute inset-0 overflow-hidden pointer-events-none">
				<div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-3xl animate-pulse" />
				<div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s" />
				<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/8 rounded-full blur-3xl" />
				{/* Floating particles */}
				<div class="absolute top-20 left-1/4 w-2 h-2 bg-purple-400/40 rounded-full animate-float" />
				<div class="absolute top-40 right-1/3 w-1.5 h-1.5 bg-indigo-400/40 rounded-full animate-float" style="animation-delay: 0.5s" />
				<div class="absolute bottom-32 left-1/3 w-2 h-2 bg-violet-400/40 rounded-full animate-float" style="animation-delay: 1s" />
			</div>

			{/* Vignette effect */}
			<div class="vignette absolute inset-0" />

			{/* Top navigation bar with auth */}
			<nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 sm:px-6">
				<button
					class="settings-btn relative"
					style="position: relative; top: auto; right: auto;"
					aria-label="Paramètres"
					onClick={() => navigate("/settings")}
				>
					<Settings class="settings-icon h-5 w-5" />
				</button>

				{/* Auth section */}
				<div class="flex items-center gap-3">
					<Show 
						when={!authStore.isLoading()} 
						fallback={
							<div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
						}
					>
						<Show 
							when={authStore.isAuthenticated()} 
							fallback={<LoginButton />}
						>
							<UserMenu />
						</Show>
					</Show>
				</div>
			</nav>

			<main class="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 p-6 sm:p-10">
				{/* Logo and Title Section */}
				<header class="text-center hero-section">
					{/* Animated D20 dice - click to re-roll */}
					<div class="flex justify-center mb-6">
						<AnimatedD20 size={96} />
					</div>

					<h1 class="main-title font-display text-5xl sm:text-6xl md:text-7xl tracking-wide">
						DnDiscord
					</h1>
					<p class="mt-4 text-slate-200/90 text-lg max-w-xl mx-auto">
						Retrouvez l'univers Donjons & Dragons dans un format Discord.
					</p>
					<div class="mt-6 mx-auto decorative-divider" />
				</header>

				{/* Menu Buttons */}
				<section class="flex w-full flex-col items-center gap-4 menu-section" data-tutorial="menu">
					<For each={menuItems()}>
						{(item, index) => (
							<div class="menu-item" style={`animation-delay: ${index() * 100}ms`}>
								<ButtonMenu
									label={item.label}
									icon={item.icon}
									onMouseEnter={() => { setHovered(item.hoveringLabel); playMenuHoverSound(); }}
									onMouseLeave={() => setHovered(null)}
									onClick={() => { playMenuClickSound(); navigate(item.route); }}
									data-tutorial={
										item.route === "/characters"
											? "nav-characters"
											: item.route === "/campaigns" || item.route === "/campaigns-manager"
											? "nav-campaigns"
											: undefined
									}
								/>
							</div>
						)}
					</For>
				</section>

				{/* Context hint area with animation */}
				<div class="h-8 flex items-center justify-center">
					<Show when={hovered()}>
					<p class="text-center text-sm text-slate-300/90 animate-fadeIn">
						{menuItems().find((x) => x.hoveringLabel === hovered())?.hoveringDescription}
					</p>
					</Show>
				</div>

				{/* Quick Stats / Feature Cards */}
				<Show when={authStore.isAuthenticated()}>
					<section class="w-full max-w-2xl mt-4 stats-section">
						<div class="grid grid-cols-3 gap-3 sm:gap-4">
							<QuickStatCard 
								icon={<Users class="w-5 h-5" />}
								label="Personnages"
								value="0"
								onClick={() => navigate("/characters")}
							/>
							<QuickStatCard 
								icon={<ScrollText class="w-5 h-5" />}
								label="Campagnes"
								value="0"
								onClick={() => navigate("/campaigns")}
							/>
							<QuickStatCard 
								icon={<Swords class="w-5 h-5" />}
								label="Parties"
								value="0"
								onClick={() => navigate("/board")}
							/>
						</div>
					</section>
				</Show>
			</main>

			{/* Footer hint */}
			<footer class="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-400/60">
				Appuyez sur un bouton pour commencer votre aventure
			</footer>

			<style jsx>{`
				.menu-page {
					background: linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%);
				}

				.main-title {
					background: linear-gradient(135deg, var(--plum-300) 0%, var(--plum-300) 25%, var(--plum-500) 50%, var(--plum-500) 75%, var(--plum-300) 100%);
					background-size: 200% 200%;
					-webkit-background-clip: text;
					background-clip: text;
					-webkit-text-fill-color: transparent;
					text-shadow: 0 0 40px rgba(139, 92, 246, 0.5), 0 0 80px rgba(139, 92, 246, 0.3);
					filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
					animation: gradientShift 4s ease-in-out infinite;
				}

				@keyframes gradientShift {
					0%, 100% {
						background-position: 0% 50%;
					}
					50% {
						background-position: 100% 50%;
					}
				}

				.hero-section {
					animation: heroFadeIn 0.6s ease-out;
				}

				.menu-section {
					animation: menuSlideUp 0.5s ease-out;
					animation-delay: 0.2s;
					animation-fill-mode: both;
				}

				.menu-item {
					animation: itemFadeIn 0.4s ease-out;
					animation-fill-mode: both;
				}

				.stats-section {
					animation: statsFadeIn 0.5s ease-out;
					animation-delay: 0.5s;
					animation-fill-mode: both;
				}

				@keyframes heroFadeIn {
					from {
						opacity: 0;
						transform: translateY(-20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				@keyframes menuSlideUp {
					from {
						opacity: 0;
						transform: translateY(30px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				@keyframes itemFadeIn {
					from {
						opacity: 0;
						transform: translateX(-20px);
					}
					to {
						opacity: 1;
						transform: translateX(0);
					}
				}

				@keyframes statsFadeIn {
					from {
						opacity: 0;
						transform: translateY(20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				@keyframes float {
					0%, 100% {
						transform: translateY(0px);
					}
					50% {
						transform: translateY(-20px);
					}
				}

				.animate-float {
					animation: float 4s ease-in-out infinite;
				}

				.animate-fadeIn {
					animation: fadeIn 0.3s ease-out;
				}

				@keyframes fadeIn {
					from { opacity: 0; }
					to { opacity: 1; }
				}
			`}</style>
		</div>
	);
}

/**
 * Quick stat card component
 */
function QuickStatCard(props: { 
	icon: JSX.Element; 
	label: string; 
	value: string;
	onClick?: () => void;
}) {
	return (
		<button
			onClick={props.onClick}
			class="group p-4 bg-game-dark/50 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 hover:border-purple-500/30 transition-all text-center"
		>
			<div class="flex justify-center mb-2 text-purple-400 group-hover:text-purple-300 transition-colors">
				{props.icon}
			</div>
			<p class="text-2xl font-bold text-white">{props.value}</p>
			<p class="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{props.label}</p>
		</button>
	);
}
