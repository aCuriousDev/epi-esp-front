import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, Plus } from "lucide-solid";
import { For } from "solid-js";
import ButtonMenu from "../components/common/ButtonMenu";
import { characters } from "../stores/charactersStore";

export default function CharactersComponent() {
	const navigate = useNavigate();

	return (
		<div class="relative min-h-full w-full overflow-y-auto bg-brand-gradient">
			<div class="vignette absolute inset-0 pointer-events-none"></div>

			{/* Back button */}
			<A href="/" class="settings-btn" aria-label="Retour">
				<ArrowLeft class="settings-icon h-5 w-5" />
			</A>

			<header class="text-center pt-6">
				<h1 class="title-shine title-gradient font-display text-white text-5xl sm:text-6xl md:text-7xl tracking-wide bg-clip-text text-transparent drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
					Mes Personnages
				</h1>
				<p class="mt-3 text-slate-100/90 max-w-xl mx-auto">
					L'ensemble de vos héros créés apparaîtront ici.
				</p>
				<div class="mt-6 mx-auto decorative-divider"></div>
			</header>

			<main class="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-6 p-6 sm:p-10">
				<For each={characters()}>
					{(character) => (
						<ButtonMenu
							label={character.name}
							subLabel={`${character.race} - ${character.class}`}
							imageUrl={`/src/assets/classes/${character.classKey}.png`}
							onClick={() => console.log("View character:", character)}
						/>
					)}
				</For>

				{/* Add new character button */}
				<ButtonMenu
					icon={<Plus class="h-6 w-6" />}
					onClick={() => navigate("/characters/create")}
				/>
			</main>
		</div>
	);
}
