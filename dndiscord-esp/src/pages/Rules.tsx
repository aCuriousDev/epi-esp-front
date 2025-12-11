import { A } from '@solidjs/router';

export default function Rules() {
	return (
		<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
			<div class="vignette absolute inset-0"></div>
			<main class="relative z-10 mx-auto min-h-full max-w-6xl p-6 sm:p-10 space-y-6">
				<header class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-3xl sm:text-4xl bg-clip-text text-transparent title-gradient title-shine">Règles du jeu</h2>
					<A href="/" class="settings-btn" aria-label="Retour">←</A>
				</header>

				<div class="mt-2 mx-auto decorative-divider"></div>

				

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
					<section id="creation" class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<h3 class="font-display text-xl mb-3">Création de personnage</h3>
						<ul class="text-sm text-slate-200 space-y-2 list-disc pl-5">
							<li><span class="text-slate-100 font-medium">Caractéristiques</span>: Force, Dextérité, Constitution, Intelligence, Sagesse, Charisme.</li>
							<li><span class="text-slate-100 font-medium">Modificateur</span>: floor((score − 10) / 2).</li>
							<li><span class="text-slate-100 font-medium">Bonus de maîtrise</span>: +2 (niv. 1–4), +3 (5–8), +4 (9–12), +5 (13–16), +6 (17–20).</li>
							<li><span class="text-slate-100 font-medium">Points de vie</span>: dé de vie de classe + mod. de Constitution par niveau.</li>
							<li><span class="text-slate-100 font-medium">Classe d’Armure (CA)</span>: armure + mod. DEX (selon armure). Sans armure: 10 + mod. DEX.</li>
							<li><span class="text-slate-100 font-medium">Initiative</span>: 1d20 + mod. DEX.</li>
							<li><span class="text-slate-100 font-medium">Vitesse</span>: typiquement 9 m (30 ft), selon race/traits.</li>
						</ul>
					</section>

					<section id="jets" class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<h3 class="font-display text-xl mb-3">Jets de dés</h3>
						<ul class="text-sm text-slate-200 space-y-2 list-disc pl-5">
							<li><span class="text-slate-100 font-medium">DD (Degré de Difficulté)</span>: un jet réussit si 1d20 + modificateurs ≥ DD.</li>
							<li><span class="text-slate-100 font-medium">Tests de caractéristique</span>: 1d20 + mod. carac + bonus de maîtrise si compétent.</li>
							<li><span class="text-slate-100 font-medium">Jets d’attaque</span>: 1d20 + mod. d’attribut (FOR/DEX) + maîtrise si compétent.</li>
							<li><span class="text-slate-100 font-medium">Jets de sauvegarde</span>: 1d20 + mod. carac, + maîtrise si la sauvegarde est maîtrisée.</li>
							<li><span class="text-slate-100 font-medium">Avantage/Désavantage</span>: lancer 2d20 et garder le meilleur/pire.</li>
							<li><span class="text-slate-100 font-medium">Réussites/échecs critiques</span>: 20 naturel = réussite auto d’attaque; 1 naturel = échec auto d’attaque.</li>
						</ul>
					</section>
				</div>

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
					<section id="combat" class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<h3 class="font-display text-xl mb-3">Combat</h3>
						<ul class="text-sm text-slate-200 space-y-2 list-disc pl-5">
							<li><span class="text-slate-100 font-medium">Ordre de tour</span>: initiative décroissante; tour = mouvement + action; parfois action bonus.</li>
							<li><span class="text-slate-100 font-medium">Mouvement</span>: jusqu’à votre vitesse, fractionnable durant le tour.</li>
							<li><span class="text-slate-100 font-medium">Actions</span>: Attaquer, Lancer un sort, Se désengager, Esquiver, Se cacher, Se précipiter, Aider, Utiliser un objet, Chercher, Se préparer.</li>
							<li><span class="text-slate-100 font-medium">Réactions</span>: ex. Attaque d’opportunité quand une créature quitte votre portée.</li>
							<li><span class="text-slate-100 font-medium">Couvert</span>: 1/2 (+2 CA, +2 JS DEX), 3/4 (+5), total (impossible à viser).</li>
							<li><span class="text-slate-100 font-medium">Attaques à distance</span>: désavantage si une cible ennemie est au contact.</li>
							<li><span class="text-slate-100 font-medium">Dégâts critiques</span>: lancer deux fois les dés de dégâts.</li>
						</ul>
					</section>

					<section id="repos" class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<h3 class="font-display text-xl mb-3">Repos et survie</h3>
						<ul class="text-sm text-slate-200 space-y-2 list-disc pl-5">
							<li><span class="text-slate-100 font-medium">Repos court</span>: au moins 1 h; dépenser des dés de vie pour récupérer des PV; certaines capacités se rechargent.</li>
							<li><span class="text-slate-100 font-medium">Repos long</span>: 8 h; récupération de PV, dés de vie (moitié niv. min. 1), emplacements de sorts, capacités longues.</li>
							<li><span class="text-slate-100 font-medium">Jets contre la mort</span>: à 0 PV, à chaque tour 1d20; 3 réussites = stabilisé, 3 échecs = mort; 20 = 1 PV, 1 = 2 échecs.</li>
						</ul>
					</section>
				</div>

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
					<section id="etats" class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<h3 class="font-display text-xl mb-3">États (Conditions)</h3>
						<p class="text-slate-200 text-sm mb-2">Effets fréquents qui altèrent une créature :</p>
						<ul class="text-sm text-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Aveuglé</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Assourdi</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Charmé</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Effrayé</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Empoigné</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Entravé</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">À terre</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Invisible</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Neutralisé</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Empoisonné</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Pétrifié</li>
							<li class="rounded-md bg-black/30 border border-white/10 p-2">Inconscient</li>
						</ul>
						<p class="text-xs text-slate-400 mt-2">Se référer au SRD pour les effets détaillés de chaque état.</p>
					</section>

					<section id="magie" class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
						<h3 class="font-display text-xl mb-3">Magie</h3>
						<ul class="text-sm text-slate-200 space-y-2 list-disc pl-5">
							<li><span class="text-slate-100 font-medium">Emplacements de sorts</span>: dépensés pour lancer des sorts de niveau approprié.</li>
							<li><span class="text-slate-100 font-medium">DD des sorts</span>: 8 + bonus de maîtrise + mod. de caractéristique d’incantation.</li>
							<li><span class="text-slate-100 font-medium">Jet d’attaque de sort</span>: bonus de maîtrise + mod. de caractéristique d’incantation.</li>
							<li><span class="text-slate-100 font-medium">Concentration</span>: si vous subissez des dégâts, JS CON (DD 10 ou moitié des dégâts, au plus haut) pour maintenir le sort.</li>
							<li><span class="text-slate-100 font-medium">Temps d’incantation, portée, composantes, durée</span>: précisés par chaque sort.</li>
						</ul>
					</section>
				</div>

				<section id="competences" class="rounded-xl bg-black/25 ring-1 ring-white/10 p-5 shadow-soft">
					<h3 class="font-display text-xl mb-3">Compétences et inspiration</h3>
					<ul class="text-sm text-slate-200 space-y-2 list-disc pl-5">
						<li><span class="text-slate-100 font-medium">Compétences</span>: l’aptitude d’une compétence ajoute le modificateur associé; ajouter le bonus de maîtrise si compétent.</li>
						<li><span class="text-slate-100 font-medium">Inspiration</span>: permet d’obtenir l’avantage sur un jet; accordée par le MJ pour un bon jeu de rôle.</li>
					</ul>
				</section>

				<footer class="pt-2">
					<div class="flex items-center justify-between text-sm">
						<A href="/" class="px-3 py-2 rounded-md bg-black/30 border border-white/10 hover:bg-black/40">← Retour</A>
						<a href="#intro" class="px-3 py-2 rounded-md bg-black/30 border border-white/10 hover:bg-black/40">Haut de page ↑</a>
					</div>
				</footer>

			</main>
		</div>
	);
}


