import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, BookOpen, Swords, Dices, Heart, Sparkles, Shield, Wand2, ChevronUp } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";

interface RuleSection {
	id: string;
	title: string;
	icon: any;
	color: string;
}

const ruleSections: RuleSection[] = [
	{ id: "creation", title: "Création", icon: "🎭", color: "purple" },
	{ id: "jets", title: "Jets de dés", icon: "🎲", color: "blue" },
	{ id: "combat", title: "Combat", icon: "⚔️", color: "red" },
	{ id: "repos", title: "Repos", icon: "💤", color: "green" },
	{ id: "etats", title: "États", icon: "⚡", color: "yellow" },
	{ id: "magie", title: "Magie", icon: "✨", color: "indigo" },
];

export default function Rules() {
	const navigate = useNavigate();
	const [activeSection, setActiveSection] = createSignal<string | null>(null);

	const scrollToSection = (id: string) => {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	return (
		<div class="rules-page min-h-screen w-full overflow-y-auto">
			{/* Animated background elements */}
			<div class="fixed inset-0 overflow-hidden pointer-events-none">
				<div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
				<div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
				<div class="absolute top-3/4 left-1/2 w-[400px] h-[400px] bg-violet-500/8 rounded-full blur-3xl" />
			</div>

			{/* Vignette */}
			<div class="vignette fixed inset-0 pointer-events-none" />

			{/* Top anchor */}
			<div id="rules-top" />

			{/* Header */}
			<header class="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/80 backdrop-blur-md">
				<button
					onClick={() => navigate("/")}
					class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
				>
					<ArrowLeft class="w-5 h-5" />
					<span class="hidden sm:inline">Retour au menu</span>
				</button>

				<h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
					<BookOpen class="w-5 h-5 text-purple-400" />
					Règles du Jeu
				</h1>

				<div class="w-24" />
			</header>

			{/* Quick Navigation */}
			<nav class="sticky top-[65px] z-20 bg-game-dark/60 backdrop-blur-sm border-b border-white/5 px-4 py-2 overflow-x-auto">
				<div class="flex gap-2 justify-center min-w-max">
					<For each={ruleSections}>
						{(section) => (
							<button
								onClick={() => scrollToSection(section.id)}
								class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-purple-500/30 transition-all whitespace-nowrap"
							>
								<span>{section.icon}</span>
								<span class="hidden sm:inline">{section.title}</span>
							</button>
						)}
					</For>
				</div>
			</nav>

			<main class="relative z-10 max-w-5xl mx-auto p-6 pt-8 pb-20 space-y-8">
				{/* Hero Section */}
				<div class="text-center mb-10 hero-section">
					<div class="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center">
						<BookOpen class="w-8 h-8 text-purple-300" />
					</div>
					<h2 class="font-display text-3xl sm:text-4xl text-white drop-shadow-[0_2px_8px_rgba(139,92,246,0.4)]">
						Guide des Règles D&D 5e
					</h2>
					<p class="mt-3 text-slate-300 max-w-2xl mx-auto">
						Référence rapide des règles essentielles pour vos parties de Donjons & Dragons.
					</p>
					<div class="mt-6 mx-auto decorative-divider" />
				</div>

				{/* Creation Section */}
				<RuleCard
					id="creation"
					icon={<span class="text-2xl">🎭</span>}
					title="Création de personnage"
					color="purple"
				>
					<ul class="space-y-3">
						<RuleItem label="Caractéristiques">
							Force, Dextérité, Constitution, Intelligence, Sagesse, Charisme.
						</RuleItem>
						<RuleItem label="Modificateur">
							floor((score − 10) / 2).
						</RuleItem>
						<RuleItem label="Bonus de maîtrise">
							+2 (niv. 1–4), +3 (5–8), +4 (9–12), +5 (13–16), +6 (17–20).
						</RuleItem>
						<RuleItem label="Points de vie">
							dé de vie de classe + mod. de Constitution par niveau.
						</RuleItem>
						<RuleItem label="Classe d'Armure (CA)">
							armure + mod. DEX (selon armure). Sans armure: 10 + mod. DEX.
						</RuleItem>
						<RuleItem label="Initiative">
							1d20 + mod. DEX.
						</RuleItem>
						<RuleItem label="Vitesse">
							typiquement 9 m (30 ft), selon race/traits.
						</RuleItem>
					</ul>
				</RuleCard>

				{/* Dice Rolls Section */}
				<RuleCard
					id="jets"
					icon={<span class="text-2xl">🎲</span>}
					title="Jets de dés"
					color="blue"
				>
					<ul class="space-y-3">
						<RuleItem label="DD (Degré de Difficulté)">
							un jet réussit si 1d20 + modificateurs ≥ DD.
						</RuleItem>
						<RuleItem label="Tests de caractéristique">
							1d20 + mod. carac + bonus de maîtrise si compétent.
						</RuleItem>
						<RuleItem label="Jets d'attaque">
							1d20 + mod. d'attribut (FOR/DEX) + maîtrise si compétent.
						</RuleItem>
						<RuleItem label="Jets de sauvegarde">
							1d20 + mod. carac, + maîtrise si la sauvegarde est maîtrisée.
						</RuleItem>
						<RuleItem label="Avantage/Désavantage">
							lancer 2d20 et garder le meilleur/pire.
						</RuleItem>
						<RuleItem label="Réussites/échecs critiques">
							20 naturel = réussite auto d'attaque; 1 naturel = échec auto d'attaque.
						</RuleItem>
					</ul>
				</RuleCard>

				{/* Combat Section */}
				<RuleCard
					id="combat"
					icon={<span class="text-2xl">⚔️</span>}
					title="Combat"
					color="red"
				>
					<ul class="space-y-3">
						<RuleItem label="Ordre de tour">
							initiative décroissante; tour = mouvement + action; parfois action bonus.
						</RuleItem>
						<RuleItem label="Mouvement">
							jusqu'à votre vitesse, fractionnable durant le tour.
						</RuleItem>
						<RuleItem label="Actions">
							Attaquer, Lancer un sort, Se désengager, Esquiver, Se cacher, Se précipiter, Aider, Utiliser un objet, Chercher, Se préparer.
						</RuleItem>
						<RuleItem label="Réactions">
							ex. Attaque d'opportunité quand une créature quitte votre portée.
						</RuleItem>
						<RuleItem label="Couvert">
							1/2 (+2 CA, +2 JS DEX), 3/4 (+5), total (impossible à viser).
						</RuleItem>
						<RuleItem label="Attaques à distance">
							désavantage si une cible ennemie est au contact.
						</RuleItem>
						<RuleItem label="Dégâts critiques">
							lancer deux fois les dés de dégâts.
						</RuleItem>
					</ul>
				</RuleCard>

				{/* Rest Section */}
				<RuleCard
					id="repos"
					icon={<span class="text-2xl">💤</span>}
					title="Repos et survie"
					color="green"
				>
					<ul class="space-y-3">
						<RuleItem label="Repos court">
							au moins 1 h; dépenser des dés de vie pour récupérer des PV; certaines capacités se rechargent.
						</RuleItem>
						<RuleItem label="Repos long">
							8 h; récupération de PV, dés de vie (moitié niv. min. 1), emplacements de sorts, capacités longues.
						</RuleItem>
						<RuleItem label="Jets contre la mort">
							à 0 PV, à chaque tour 1d20; 3 réussites = stabilisé, 3 échecs = mort; 20 = 1 PV, 1 = 2 échecs.
						</RuleItem>
					</ul>
				</RuleCard>

				{/* Conditions Section */}
				<RuleCard
					id="etats"
					icon={<span class="text-2xl">⚡</span>}
					title="États (Conditions)"
					color="yellow"
				>
					<p class="text-slate-300 text-sm mb-4">
						Effets fréquents qui altèrent une créature :
					</p>
					<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
						<For each={["Aveuglé", "Assourdi", "Charmé", "Effrayé", "Empoigné", "Entravé", "À terre", "Invisible", "Neutralisé", "Empoisonné", "Pétrifié", "Inconscient"]}>
							{(condition) => (
								<div class="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm text-center hover:bg-yellow-500/20 transition-colors">
									{condition}
								</div>
							)}
						</For>
					</div>
					<p class="text-xs text-slate-500 mt-4">
						Se référer au SRD pour les effets détaillés de chaque état.
					</p>
				</RuleCard>

				{/* Magic Section */}
				<RuleCard
					id="magie"
					icon={<span class="text-2xl">✨</span>}
					title="Magie"
					color="indigo"
				>
					<ul class="space-y-3">
						<RuleItem label="Emplacements de sorts">
							dépensés pour lancer des sorts de niveau approprié.
						</RuleItem>
						<RuleItem label="DD des sorts">
							8 + bonus de maîtrise + mod. de caractéristique d'incantation.
						</RuleItem>
						<RuleItem label="Jet d'attaque de sort">
							bonus de maîtrise + mod. de caractéristique d'incantation.
						</RuleItem>
						<RuleItem label="Concentration">
							si vous subissez des dégâts, JS CON (DD 10 ou moitié des dégâts, au plus haut) pour maintenir le sort.
						</RuleItem>
						<RuleItem label="Temps d'incantation, portée, composantes, durée">
							précisés par chaque sort.
						</RuleItem>
					</ul>
				</RuleCard>

				{/* Skills Section */}
				<RuleCard
					id="competences"
					icon={<span class="text-2xl">📚</span>}
					title="Compétences et inspiration"
					color="purple"
				>
					<ul class="space-y-3">
						<RuleItem label="Compétences">
							l'aptitude d'une compétence ajoute le modificateur associé; ajouter le bonus de maîtrise si compétent.
						</RuleItem>
						<RuleItem label="Inspiration">
							permet d'obtenir l'avantage sur un jet; accordée par le MJ pour un bon jeu de rôle.
						</RuleItem>
					</ul>
				</RuleCard>

				{/* Footer Navigation */}
				<footer class="pt-8 flex items-center justify-between">
					<button
						onClick={() => navigate("/")}
						class="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-slate-300 hover:text-white transition-all"
					>
						<ArrowLeft class="w-4 h-4" />
						Retour au menu
					</button>
					<button
						onClick={() => scrollToSection("rules-top")}
						class="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-300 hover:text-purple-200 transition-all"
					>
						Haut de page
						<ChevronUp class="w-4 h-4" />
					</button>
				</footer>
			</main>

			<style jsx>{`
				.rules-page {
					background: linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%);
				}

				.hero-section {
					animation: fadeInDown 0.5s ease-out;
				}

				@keyframes fadeInDown {
					from {
						opacity: 0;
						transform: translateY(-20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
			`}</style>
		</div>
	);
}

/**
 * Rule card component
 */
function RuleCard(props: {
	id: string;
	icon: any;
	title: string;
	color: "purple" | "blue" | "red" | "green" | "yellow" | "indigo";
	children: any;
}) {
	const colorClasses = {
		purple: "from-purple-500/20 to-purple-600/10 border-purple-500/20 hover:border-purple-500/40",
		blue: "from-blue-500/20 to-blue-600/10 border-blue-500/20 hover:border-blue-500/40",
		red: "from-red-500/20 to-red-600/10 border-red-500/20 hover:border-red-500/40",
		green: "from-green-500/20 to-green-600/10 border-green-500/20 hover:border-green-500/40",
		yellow: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/20 hover:border-yellow-500/40",
		indigo: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 hover:border-indigo-500/40",
	};

	const titleColors = {
		purple: "text-purple-300",
		blue: "text-blue-300",
		red: "text-red-300",
		green: "text-green-300",
		yellow: "text-yellow-300",
		indigo: "text-indigo-300",
	};

	return (
		<section
			id={props.id}
			class={`rule-card rounded-2xl bg-gradient-to-br ${colorClasses[props.color]} border backdrop-blur-sm p-6 shadow-xl transition-all scroll-mt-32`}
		>
			<h3 class={`font-display text-xl mb-4 flex items-center gap-3 ${titleColors[props.color]}`}>
				{props.icon}
				{props.title}
			</h3>
			{props.children}
		</section>
	);
}

/**
 * Rule item component
 */
function RuleItem(props: { label: string; children: any }) {
	return (
		<li class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 text-sm">
			<span class="text-white font-medium shrink-0">{props.label}:</span>
			<span class="text-slate-300">{props.children}</span>
		</li>
	);
}
