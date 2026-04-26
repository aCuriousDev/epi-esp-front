import { createSignal, For, type JSX } from "solid-js";
import { BookOpen, Swords, Dices, Heart, Sparkles, Shield, Wand2, ChevronUp, Drama, Moon, Zap } from "lucide-solid";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

interface RuleSection {
	id: string;
	title: string;
	icon: JSX.Element;
	color: string;
}

const ruleSections: RuleSection[] = [
	{ id: "creation", title: "Creation", icon: <Drama class="w-4 h-4" />, color: "purple" },
	{ id: "jets", title: "Dice Rolls", icon: <Dices class="w-4 h-4" />, color: "blue" },
	{ id: "combat", title: "Combat", icon: <Swords class="w-4 h-4" />, color: "red" },
	{ id: "repos", title: "Rest", icon: <Moon class="w-4 h-4" />, color: "green" },
	{ id: "etats", title: "Conditions", icon: <Zap class="w-4 h-4" />, color: "yellow" },
	{ id: "magie", title: "Magic", icon: <Sparkles class="w-4 h-4" />, color: "indigo" },
];

export default function Rules() {
	const [activeSection, setActiveSection] = createSignal<string | null>(null);

	const scrollToSection = (id: string) => {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	return (
		<>
			<PageMeta title={t("page.rules.title")} />

			<div class="rules-page min-h-screen w-full overflow-y-auto">
				{/* Animated background elements */}
				<div class="fixed inset-0 overflow-hidden pointer-events-none">
					<div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
					<div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
					<div class="absolute top-3/4 left-1/2 w-[400px] h-[400px] bg-violet-500/8 rounded-full blur-3xl" />
				</div>

				{/* Top anchor */}
				<div id="rules-top" />

				{/* Quick Navigation */}
				<nav class="sticky top-0 z-20 bg-game-dark/60 backdrop-blur-sm border-b border-white/5 px-4 py-2 overflow-x-auto">
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
							{t("page.rules.heroTitle")}
						</h2>
						<p class="mt-3 text-slate-300 max-w-2xl mx-auto">
							{t("page.rules.heroSubtitle")}
						</p>
						<div class="mt-6 mx-auto decorative-divider" />
					</div>

					{/* Creation Section */}
					<RuleCard
						id="creation"
					icon={<Drama class="w-6 h-6 text-purple-300" />}
					title={t("page.rules.section.creation")}
						color="purple"
					>
						<ul class="space-y-3">
							<RuleItem label={t("page.rules.item.abilities")}>
								Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma.
							</RuleItem>
							<RuleItem label={t("page.rules.item.modifier")}>
								floor((score − 10) / 2).
							</RuleItem>
							<RuleItem label={t("page.rules.item.proficiencyBonus")}>
								+2 (lvl 1–4), +3 (5–8), +4 (9–12), +5 (13–16), +6 (17–20).
							</RuleItem>
							<RuleItem label={t("page.rules.item.hitPoints")}>
								class hit die + Constitution modifier per level.
							</RuleItem>
							<RuleItem label={t("page.rules.item.armorClass")}>
								armor + DEX mod (based on armor). Unarmored: 10 + DEX mod.
							</RuleItem>
							<RuleItem label={t("page.rules.item.initiative")}>
								1d20 + DEX mod.
							</RuleItem>
							<RuleItem label={t("page.rules.item.speed")}>
								typically 30 ft, depending on race/traits.
							</RuleItem>
						</ul>
					</RuleCard>

					{/* Dice Rolls Section */}
					<RuleCard
						id="jets"
					icon={<Dices class="w-6 h-6 text-blue-300" />}
					title={t("page.rules.section.diceRolls")}
						color="blue"
					>
						<ul class="space-y-3">
							<RuleItem label={t("page.rules.item.dc")}>
								a roll succeeds if 1d20 + modifiers ≥ DC.
							</RuleItem>
							<RuleItem label={t("page.rules.item.abilityChecks")}>
								1d20 + ability mod + proficiency bonus if proficient.
							</RuleItem>
							<RuleItem label={t("page.rules.item.attackRolls")}>
								1d20 + attribute mod (STR/DEX) + proficiency if proficient.
							</RuleItem>
							<RuleItem label={t("page.rules.item.savingThrows")}>
								1d20 + ability mod, + proficiency if the save is proficient.
							</RuleItem>
							<RuleItem label={t("page.rules.item.advantageDisadvantage")}>
								roll 2d20 and keep the higher/lower result.
							</RuleItem>
							<RuleItem label={t("page.rules.item.criticals")}>
								natural 20 = automatic attack hit; natural 1 = automatic attack miss.
							</RuleItem>
						</ul>
					</RuleCard>

					{/* Combat Section */}
					<RuleCard
						id="combat"
					icon={<Swords class="w-6 h-6 text-red-300" />}
					title={t("page.rules.section.combat")}
						color="red"
					>
						<ul class="space-y-3">
							<RuleItem label={t("page.rules.item.turnOrder")}>
								descending initiative; turn = movement + action; sometimes bonus action.
							</RuleItem>
							<RuleItem label={t("page.rules.item.movement")}>
								up to your speed, splittable during the turn.
							</RuleItem>
							<RuleItem label={t("page.rules.item.actions")}>
								Attack, Cast a Spell, Disengage, Dodge, Hide, Dash, Help, Use Object, Search, Ready.
							</RuleItem>
							<RuleItem label={t("page.rules.item.reactions")}>
								e.g. Opportunity Attack when a creature leaves your reach.
							</RuleItem>
							<RuleItem label={t("page.rules.item.cover")}>
								1/2 (+2 AC, +2 DEX save), 3/4 (+5), total (can't be targeted).
							</RuleItem>
							<RuleItem label={t("page.rules.item.rangedAttacks")}>
								disadvantage if a hostile creature is within melee range.
							</RuleItem>
							<RuleItem label={t("page.rules.item.criticalDamage")}>
								roll damage dice twice.
							</RuleItem>
						</ul>
					</RuleCard>

					{/* Rest Section */}
					<RuleCard
						id="repos"
					icon={<Moon class="w-6 h-6 text-green-300" />}
					title={t("page.rules.section.rest")}
						color="green"
					>
						<ul class="space-y-3">
							<RuleItem label={t("page.rules.item.shortRest")}>
								at least 1 h; spend hit dice to recover HP; some abilities recharge.
							</RuleItem>
							<RuleItem label={t("page.rules.item.longRest")}>
								8 h; recover HP, hit dice (half level min. 1), spell slots, long abilities.
							</RuleItem>
							<RuleItem label={t("page.rules.item.deathSaves")}>
								at 0 HP, each turn 1d20; 3 successes = stabilized, 3 failures = death; 20 = 1 HP, 1 = 2 failures.
							</RuleItem>
						</ul>
					</RuleCard>

					{/* Conditions Section */}
					<RuleCard
						id="etats"
					icon={<Zap class="w-6 h-6 text-yellow-300" />}
					title={t("page.rules.section.conditions")}
						color="yellow"
					>
						<p class="text-slate-300 text-sm mb-4">
							{t("page.rules.conditionsIntro")}
						</p>
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
							<For each={["Blinded", "Deafened", "Charmed", "Frightened", "Grappled", "Restrained", "Prone", "Invisible", "Incapacitated", "Poisoned", "Petrified", "Unconscious"]}>
								{(condition) => (
									<div class="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm text-center hover:bg-yellow-500/20 transition-colors">
										{condition}
									</div>
								)}
							</For>
						</div>
						<p class="text-xs text-slate-500 mt-4">
							{t("page.rules.conditionsNote")}
						</p>
					</RuleCard>

					{/* Magic Section */}
					<RuleCard
						id="magie"
					icon={<Sparkles class="w-6 h-6 text-indigo-300" />}
					title={t("page.rules.section.magic")}
						color="indigo"
					>
						<ul class="space-y-3">
							<RuleItem label={t("page.rules.item.spellSlots")}>
								expended to cast spells of the appropriate level.
							</RuleItem>
							<RuleItem label={t("page.rules.item.spellDC")}>
								8 + proficiency bonus + spellcasting ability modifier.
							</RuleItem>
							<RuleItem label={t("page.rules.item.spellAttack")}>
								proficiency bonus + spellcasting ability modifier.
							</RuleItem>
							<RuleItem label={t("page.rules.item.concentration")}>
								if you take damage, CON save (DC 10 or half damage, whichever is higher) to maintain the spell.
							</RuleItem>
							<RuleItem label={t("page.rules.item.spellComponents")}>
								casting time, range, components, duration specified per spell.
							</RuleItem>
						</ul>
					</RuleCard>

					{/* Skills Section */}
					<RuleCard
						id="competences"
					icon={<BookOpen class="w-6 h-6 text-purple-300" />}
					title={t("page.rules.section.skills")}
						color="purple"
					>
						<ul class="space-y-3">
							<RuleItem label={t("page.rules.item.skills")}>
								a skill proficiency adds the associated modifier; add proficiency bonus if proficient.
							</RuleItem>
							<RuleItem label={t("page.rules.item.inspiration")}>
								grants advantage on one roll; awarded by the DM for good roleplaying.
							</RuleItem>
						</ul>
					</RuleCard>

					{/* Footer Navigation */}
					<footer class="pt-8 flex items-center justify-end">
						<button
							onClick={() => scrollToSection("rules-top")}
							class="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-300 hover:text-purple-200 transition-all"
						>
							{t("page.rules.backToTop")}
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
		</>
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
