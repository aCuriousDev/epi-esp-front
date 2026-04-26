import { createMemo, createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { CharacterService, CharacterClass, CharacterRace } from "../services/character.service";
import { isPlayableClass } from "../types/character";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

type DnDClass = {
	key: string;
	name: string;
	primary: string;
	hitDie: string;
	saves: string;
	proficiencies: string;
	casterType: string;
	feature: string;
};

const CLASSES: DnDClass[] = [
	{
		key: "barbarian",
		name: "Barbare",
		primary: "Force",
		hitDie: "d12",
		saves: "Force, Constitution",
		proficiencies:
			"Armes simples & martiales, boucliers, armures légères et moyennes",
		casterType: "Aucun",
		feature: "Rage: bonus de dégâts, résistances",
	},
	{
		key: "bard",
		name: "Barde",
		primary: "Charisme",
		hitDie: "d8",
		saves: "Dextérité, Charisme",
		proficiencies: "Armes simples, armures légères, instruments",
		casterType: "Lanceur de sorts complet",
		feature: "Inspiration bardique: buffs aux alliés",
	},
	{
		key: "cleric",
		name: "Clerc",
		primary: "Sagesse",
		hitDie: "d8",
		saves: "Sagesse, Charisme",
		proficiencies: "Armes simples, armures légères à lourdes, boucliers",
		casterType: "Lanceur de sorts complet (divin)",
		feature: "Préparation quotidienne des sorts",
	},
	{
		key: "druid",
		name: "Druide",
		primary: "Sagesse",
		hitDie: "d8",
		saves: "Intelligence, Sagesse",
		proficiencies:
			"Armes simples, armures légères et moyennes (non métalliques), boucliers",
		casterType: "Lanceur de sorts complet (divin)",
		feature: "Forme sauvage (Wild Shape)",
	},
	{
		key: "fighter",
		name: "Guerrier",
		primary: "Force ou Dextérité",
		hitDie: "d10",
		saves: "Force, Constitution",
		proficiencies: "Armes simples & martiales, toutes armures, boucliers",
		casterType: "Aucun",
		feature: "Style de combat, attaques multiples",
	},
	{
		key: "monk",
		name: "Moine",
		primary: "Dextérité & Sagesse",
		hitDie: "d8",
		saves: "Force, Dextérité",
		proficiencies: "Armes simples, épées courtes, pas d’armure",
		casterType: "Aucun",
		feature: "Ki, défense sans armure",
	},
	{
		key: "paladin",
		name: "Paladin",
		primary: "Force & Charisme",
		hitDie: "d10",
		saves: "Sagesse, Charisme",
		proficiencies:
			"Armes simples & martiales, armures légères à lourdes, boucliers",
		casterType: "Lanceur de sorts partiel (divin)",
		feature: "Imposition des mains, auras, serments",
	},
	{
		key: "ranger",
		name: "Rôdeur",
		primary: "Dextérité & Sagesse",
		hitDie: "d10",
		saves: "Force, Dextérité",
		proficiencies:
			"Armes simples & martiales, armures légères et moyennes, boucliers",
		casterType: "Lanceur de sorts partiel (nature)",
		feature: "Ennemi juré, terrain favori, soutien",
	},
	{
		key: "rogue",
		name: "Voleur",
		primary: "Dextérité",
		hitDie: "d8",
		saves: "Dextérité, Intelligence",
		proficiencies: "Armes simples, armures légères",
		casterType: "Aucun",
		feature: "Attaque sournoise, expertise, esquive",
	},
	{
		key: "sorcerer",
		name: "Ensorceleur",
		primary: "Charisme",
		hitDie: "d6",
		saves: "Constitution, Charisme",
		proficiencies: "Armes simples",
		casterType: "Lanceur de sorts complet (inné)",
		feature: "Métamagie (modifier les sorts)",
	},
	{
		key: "warlock",
		name: "Sorcier",
		primary: "Charisme",
		hitDie: "d8",
		saves: "Sagesse, Charisme",
		proficiencies: "Armes simples",
		casterType: "Lanceur de sorts complet (pactes)",
		feature: "Pacte magique, recharges fréquentes",
	},
	{
		key: "wizard",
		name: "Magicien",
		primary: "Intelligence",
		hitDie: "d6",
		saves: "Intelligence, Sagesse",
		proficiencies: "Armes simples",
		casterType: "Lanceur de sorts complet (érudit)",
		feature: "Livre de sorts, large préparation",
	},
];

const RACES = [
	"Humain",
	"Elfe",
	"Nain",
	"Halfelin",
	"Demi-orc",
	"Tieffelin",
	"Gnome",
];

// Map frontend class keys to backend CharacterClass enum
const classKeyToEnum: Record<string, CharacterClass> = {
	"barbarian": CharacterClass.Barbare,
	"bard": CharacterClass.Barde,
	"cleric": CharacterClass.Clerc,
	"druid": CharacterClass.Druide,
	"fighter": CharacterClass.Guerrier,
	"monk": CharacterClass.Moine,
	"paladin": CharacterClass.Paladin,
	"ranger": CharacterClass.Rodeur,
	"rogue": CharacterClass.Voleur,
	"sorcerer": CharacterClass.Ensorceleur,
	"warlock": CharacterClass.Sorcier,
	"wizard": CharacterClass.Magicien,
};

// Only classes with a matching 3D asset are offered at character creation.
// The backend also rejects non-playable classes (CharacterClassExtensions.IsPlayable).
const PLAYABLE_CLASS_LIST = CLASSES.filter((c) =>
  isPlayableClass(classKeyToEnum[c.key]),
);

// Map frontend race names to backend CharacterRace enum
const raceNameToEnum: Record<string, CharacterRace> = {
	"Humain": CharacterRace.Humain,
	"Elfe": CharacterRace.Elfe,
	"Nain": CharacterRace.Nain,
	"Halfelin": CharacterRace.Halfelin,
	"Demi-orc": CharacterRace.DemiOrc,
	"Tieffelin": CharacterRace.Tieffelin,
	"Gnome": CharacterRace.Gnome,
};

export default function CreateCharacter() {
	const navigate = useNavigate();
	const [selectedClass, setSelectedClass] = createSignal<string>("fighter");
	const [selectedRace, setSelectedRace] = createSignal<string>("Humain");
	const [name, setName] = createSignal<string>("");
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const [prevClass, setPrevClass] = createSignal<string | null>(null);

	// Falls back to the first playable class if selectedClass() is stale (e.g.
	// restored from sessionStorage or a deprecated key) — avoids a non-null bang.
	const klass = createMemo(
		() =>
			PLAYABLE_CLASS_LIST.find((c) => c.key === selectedClass()) ??
			PLAYABLE_CLASS_LIST[0],
	);

	const handleCreate = async () => {
		if (!name().trim()) {
			setError(t("createCharacter.errorNameRequired"));
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			const characterClass = classKeyToEnum[selectedClass()];
			const characterRace = raceNameToEnum[selectedRace()];

			await CharacterService.createCharacter({
				name: name().trim(),
				class: characterClass,
				race: characterRace,
				abilities: {
					strength: 10,
					dexterity: 10,
					constitution: 10,
					intelligence: 10,
					wisdom: 10,
					charisma: 10,
				},
			});

			// Redirect to characters list
			navigate("/characters");
		} catch (err: any) {
			console.error("Failed to create character:", err);
			setError(err.response?.data?.message || "Impossible de créer le personnage. Veuillez réessayer.");
			setIsSubmitting(false);
		}
	};

	return (
		<div class="relative min-h-full w-full overflow-y-auto">
			<PageMeta title={t("page.createCharacter.title")} />
			<main class="relative z-10 mx-auto min-h-full max-w-6xl p-6 sm:p-10">

				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
					{/* Colonne gauche: formulaire */}
					<section class="lg:col-span-2 space-y-6">
						<div class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
							<label class="block text-sm text-slate-300 mb-2">
								{t("createCharacter.nameLabel")}
							</label>
							<input
								class="w-full bg-black/30 border border-white/10 rounded-md p-2"
								placeholder={t("createCharacter.namePlaceholder")}
								value={name()}
								onInput={(e) => setName(e.currentTarget.value)}
							/>
						</div>

						<div class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
							<label class="block text-sm text-slate-300 mb-3">{t("createCharacter.classLabel")}</label>
							<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
								{PLAYABLE_CLASS_LIST.map((c) => (
									<button
										class={`text-sm rounded-lg px-3 py-2 border transition ${
											selectedClass() === c.key
												? "bg-gradient-to-r from-brandStart to-brandEnd border-transparent text-white"
												: "bg-black/30 border-white/10 text-slate-200 hover:bg-black/40"
										}`}
										onClick={() => {
											setPrevClass(selectedClass());
											setSelectedClass(c.key);
										}}
										aria-pressed={selectedClass() === c.key}
									>
										{c.name}
									</button>
								))}
							</div>
							<p class="mt-2 text-xs text-slate-400">
								{t("createCharacter.classHint")}
							</p>
						</div>

						<div class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
							<label class="block text-sm text-slate-300 mb-3">{t("createCharacter.raceLabel")}</label>
							<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
								{RACES.map((r) => (
									<button
										class={`text-sm rounded-lg px-3 py-2 border transition ${
											selectedRace() === r
												? "bg-gradient-to-r from-brandStart to-brandEnd border-transparent text-white"
												: "bg-black/30 border-white/10 text-slate-200 hover:bg-black/40"
										}`}
										onClick={() => setSelectedRace(r)}
										aria-pressed={selectedRace() === r}
									>
										{r}
									</button>
								))}
							</div>
							<p class="mt-2 text-xs text-slate-400">
								{t("createCharacter.raceHint")}
							</p>
						</div>

						<section class="rounded-xl bg-black/30 ring-1 ring-white/10 p-5 shadow-soft">
							<h3 class="font-display text-xl mb-3">{t("createCharacter.classSummary")}</h3>
							{/* <p class="text-slate-200 text-sm"><span class="text-slate-100 font-medium">{klass().name}</span></p> */}
							<div class="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
								<div class="rounded-md bg-black/30 border border-white/10 p-2">
									{t("createCharacter.stat.primary")}: {klass().primary}
								</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">
									{t("createCharacter.stat.hitDie")}: {klass().hitDie}
								</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">
									{t("createCharacter.stat.saves")}: {klass().saves}
								</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">
									{t("createCharacter.stat.proficiencies")}: {klass().proficiencies}
								</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">
									{t("createCharacter.stat.casterType")}: {klass().casterType}
								</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">
									{t("createCharacter.stat.feature")}: {klass().feature}
								</div>
							</div>
						</section>

						{/* Error message */}
						<Show when={error()}>
							<div class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center">
								{error()}
							</div>
						</Show>

						{/* Create button */}
						<div class="flex justify-end">
							<button
								class="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-semibold flex items-center gap-2"
								onClick={handleCreate}
								disabled={isSubmitting() || !name().trim()}
							>
								<Show when={isSubmitting()} fallback={t("createCharacter.submit")}>
									<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									{t("createCharacter.submitting")}
								</Show>
							</button>
						</div>
					</section>

					{/* Colonne droite: illustration sticky */}
					<aside class="lg:col-span-1 sticky top-10 self-start">
						<div class="class-art-wrap overflow-visible">
							{prevClass() && (
								<div
									class="class-art art-exit"
									onAnimationEnd={() => setPrevClass(null)}
								>
									<img
										class="w-20 h-20 object-contain mx-auto"
										src={`/assets/classes/${prevClass()}.png`}
										alt="Classe précédente"
									/>
								</div>
							)}
							<div class="class-art art-enter">
								<img
									class="w-20 h-20 object-contain mx-auto"
									src={`/assets/classes/${selectedClass()}.png`}
									alt={klass().name}
								/>
							</div>
						</div>
					</aside>
				</div>
			</main>
		</div>
	);
}
