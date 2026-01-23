import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, Plus, Settings } from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import ButtonMenu from "../components/common/ButtonMenu";
import roguePortrait from "../assets/classes/rogue.png";
import { CharacterService, CharacterDto } from "../services/character.service";

interface CharacterListItem {
	id: string;
	first_name: string;
	last_name: string;
	campaign?: { title: string };
	profil_picture_url: string;
}

export default function CharactersComponent() {
	const navigate = useNavigate();
	const [characters, setCharacters] = createSignal<CharacterListItem[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal<string | null>(null);

	// Load characters on mount
	onMount(async () => {
		try {
			setLoading(true);
			setError(null);
			const charactersData = await CharacterService.getMyCharacters();

			// Map backend data to frontend format
			const mappedCharacters = charactersData.map((char: CharacterDto) => ({
				id: char.id,
				first_name: char.name.split(' ')[0] || char.name,
				last_name: char.name.split(' ').slice(1).join(' ') || '',
				profil_picture_url: roguePortrait, // TODO: Add character portraits
			}));

			setCharacters(mappedCharacters);
		} catch (err) {
			console.error("Failed to load characters:", err);
			setError("Impossible de charger les personnages. Veuillez réessayer.");
		} finally {
			setLoading(false);
		}
	});

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
				{/* Error message */}
				<Show when={error()}>
					<div class="w-full max-w-md p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center">
						{error()}
					</div>
				</Show>

				{/* Loading state */}
				<Show when={loading()}>
					<div class="text-center">
						<div class="w-16 h-16 mx-auto mb-4 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
						<p class="text-slate-300">Chargement des personnages...</p>
					</div>
				</Show>

				{/* Characters list */}
				<Show when={!loading()}>
					<For each={characters()}>
						{(character) => (
							<ButtonMenu
								label={character.first_name + " " + character.last_name}
								imageUrl={character.profil_picture_url}
								onClick={() => navigate(`/characters/${character.id}`)}
							/>
						)}
					</For>

					{/* Add new character button */}
					<ButtonMenu
						icon={<Plus class="h-6 w-6" />}
						onClick={() => navigate("/characters/create")}
					/>
				</Show>
			</main>
		</div>
	);
}
