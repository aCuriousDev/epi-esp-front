import { createMemo, createSignal } from 'solid-js';
import { A } from '@solidjs/router';

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
	{ key: 'barbarian', name: 'Barbare', primary: 'Force', hitDie: 'd12', saves: 'Force, Constitution', proficiencies: 'Armes simples & martiales, boucliers, armures légères et moyennes', casterType: 'Aucun', feature: 'Rage: bonus de dégâts, résistances' },
	{ key: 'bard', name: 'Barde', primary: 'Charisme', hitDie: 'd8', saves: 'Dextérité, Charisme', proficiencies: 'Armes simples, armures légères, instruments', casterType: 'Lanceur de sorts complet', feature: 'Inspiration bardique: buffs aux alliés' },
	{ key: 'cleric', name: 'Clerc', primary: 'Sagesse', hitDie: 'd8', saves: 'Sagesse, Charisme', proficiencies: 'Armes simples, armures légères à lourdes, boucliers', casterType: 'Lanceur de sorts complet (divin)', feature: 'Préparation quotidienne des sorts' },
	{ key: 'druid', name: 'Druide', primary: 'Sagesse', hitDie: 'd8', saves: 'Intelligence, Sagesse', proficiencies: 'Armes simples, armures légères et moyennes (non métalliques), boucliers', casterType: 'Lanceur de sorts complet (divin)', feature: 'Forme sauvage (Wild Shape)' },
	{ key: 'fighter', name: 'Guerrier', primary: 'Force ou Dextérité', hitDie: 'd10', saves: 'Force, Constitution', proficiencies: 'Armes simples & martiales, toutes armures, boucliers', casterType: 'Aucun', feature: 'Style de combat, attaques multiples' },
	{ key: 'monk', name: 'Moine', primary: 'Dextérité & Sagesse', hitDie: 'd8', saves: 'Force, Dextérité', proficiencies: 'Armes simples, épées courtes, pas d’armure', casterType: 'Aucun', feature: 'Ki, défense sans armure' },
	{ key: 'paladin', name: 'Paladin', primary: 'Force & Charisme', hitDie: 'd10', saves: 'Sagesse, Charisme', proficiencies: 'Armes simples & martiales, armures légères à lourdes, boucliers', casterType: 'Lanceur de sorts partiel (divin)', feature: 'Imposition des mains, auras, serments' },
	{ key: 'ranger', name: 'Rôdeur', primary: 'Dextérité & Sagesse', hitDie: 'd10', saves: 'Force, Dextérité', proficiencies: 'Armes simples & martiales, armures légères et moyennes, boucliers', casterType: 'Lanceur de sorts partiel (nature)', feature: 'Ennemi juré, terrain favori, soutien' },
	{ key: 'rogue', name: 'Voleur', primary: 'Dextérité', hitDie: 'd8', saves: 'Dextérité, Intelligence', proficiencies: 'Armes simples, armures légères', casterType: 'Aucun', feature: 'Attaque sournoise, expertise, esquive' },
	{ key: 'sorcerer', name: 'Ensorceleur', primary: 'Charisme', hitDie: 'd6', saves: 'Constitution, Charisme', proficiencies: 'Armes simples', casterType: 'Lanceur de sorts complet (inné)', feature: 'Métamagie (modifier les sorts)' },
	{ key: 'warlock', name: 'Sorcier', primary: 'Charisme', hitDie: 'd8', saves: 'Sagesse, Charisme', proficiencies: 'Armes simples', casterType: 'Lanceur de sorts complet (pactes)', feature: 'Pacte magique, recharges fréquentes' },
	{ key: 'wizard', name: 'Magicien', primary: 'Intelligence', hitDie: 'd6', saves: 'Intelligence, Sagesse', proficiencies: 'Armes simples', casterType: 'Lanceur de sorts complet (érudit)', feature: 'Livre de sorts, large préparation' }
];

const RACES = ['Humain', 'Elfe', 'Nain', 'Halfelin', 'Demi-orc', 'Tieffelin', 'Gnome'];

export default function CreateCharacter() {
	const [selectedClass, setSelectedClass] = createSignal<string>('fighter');
	const [selectedRace, setSelectedRace] = createSignal<string>('Humain');
	const [name, setName] = createSignal<string>('');

	const [prevClass, setPrevClass] = createSignal<string | null>(null);

	const klass = createMemo(() => CLASSES.find(c => c.key === selectedClass())!);

	return (
		<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
			<div class="vignette absolute inset-0"></div>
			<main class="relative z-10 mx-auto min-h-full max-w-6xl p-6 sm:p-10">
				<header class="mb-6 flex items-center justify-between">
					<div>
						<h2 class="font-display text-3xl sm:text-4xl bg-clip-text text-transparent title-gradient title-shine">Créer un personnage</h2>
					</div>
					<A href="/" class="settings-btn" aria-label="Retour">←</A>
				</header>

				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
					{/* Colonne gauche: formulaire */}
					<section class="lg:col-span-2 space-y-6">
						<div class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
							<label class="block text-sm text-slate-300 mb-2">Nom du personnage</label>
							<input class="w-full bg-black/30 border border-white/10 rounded-md p-2" placeholder="Ex: Aria Sombrelame" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
						</div>

					<div class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<label class="block text-sm text-slate-300 mb-3">Classe</label>
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{CLASSES.map(c => (
								<button
									class={`text-sm rounded-lg px-3 py-2 border transition ${selectedClass() === c.key ? 'bg-gradient-to-r from-brandStart to-brandEnd border-transparent text-white' : 'bg-black/30 border-white/10 text-slate-200 hover:bg-black/40'}`}
									onClick={() => { setPrevClass(selectedClass()); setSelectedClass(c.key); }}
									aria-pressed={selectedClass() === c.key}
								>
									{c.name}
								</button>
							))}
						</div>
						<p class="mt-2 text-xs text-slate-400">La classe détermine vos aptitudes principales en combat et en magie.</p>
					</div>

					<div class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<label class="block text-sm text-slate-300 mb-3">Race</label>
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{RACES.map(r => (
								<button
									class={`text-sm rounded-lg px-3 py-2 border transition ${selectedRace() === r ? 'bg-gradient-to-r from-brandStart to-brandEnd border-transparent text-white' : 'bg-black/30 border-white/10 text-slate-200 hover:bg-black/40'}`}
									onClick={() => setSelectedRace(r)}
									aria-pressed={selectedRace() === r}
								>
									{r}
								</button>
							))}
						</div>
						<p class="mt-2 text-xs text-slate-400">Choisissez la race de votre héros.</p>
					</div>

						<section class="rounded-xl bg-black/30 ring-1 ring-white/10 p-5 shadow-soft">
							<h3 class="font-display text-xl mb-3">Résumé de la classe</h3>
							{/* <p class="text-slate-200 text-sm"><span class="text-slate-100 font-medium">{klass().name}</span></p> */}
							<div class="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
								<div class="rounded-md bg-black/30 border border-white/10 p-2">Caractéristique principale: {klass().primary}</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">Dé de vie: {klass().hitDie}</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">Jets de sauvegarde: {klass().saves}</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">Maîtrises: {klass().proficiencies}</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">Lanceur de sorts: {klass().casterType}</div>
								<div class="rounded-md bg-black/30 border border-white/10 p-2">Particularité: {klass().feature}</div>
							</div>
						</section>

						{/* <div class="flex justify-end">
							<button class="menu-button px-6 py-3 w-auto">Continuer</button>
						</div> */}
					</section>

					{/* Colonne droite: illustration sticky */}
					<aside class="lg:col-span-1 sticky top-10 self-start">
						<div class="class-art-wrap overflow-visible">
							{prevClass() && (
								<div class="class-art art-exit" onAnimationEnd={() => setPrevClass(null)}>
									<img class="w-20 h-20 object-contain mx-auto" src={`/src/assets/classes/${prevClass()}.png`} alt="Classe précédente" />
								</div>
							)}
							<div class="class-art art-enter">
								<img class="w-20 h-20 object-contain mx-auto" src={`/src/assets/classes/${selectedClass()}.png`} alt={klass().name} />
							</div>
						</div>
					</aside>
				</div>
			</main>
		</div>
	);
}


