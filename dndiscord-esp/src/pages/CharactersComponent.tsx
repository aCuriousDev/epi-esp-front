import { useNavigate } from "@solidjs/router";
import { Plus } from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import ButtonMenu from "../components/common/ButtonMenu";
import CharacterCard from "../components/CharacterCard";
import { CharacterService, CharacterDto } from "../services/character.service";
import PageMeta from "../layouts/PageMeta";
import Button from "../components/common/Button";
import { t } from "../i18n";

export default function CharactersComponent() {
	const navigate = useNavigate();
	const [characters, setCharacters] = createSignal<CharacterDto[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal<string | null>(null);

	onMount(async () => {
		try {
			setLoading(true);
			setError(null);
			const charactersData = await CharacterService.getMyCharacters();
			setCharacters(charactersData);
		} catch (err) {
			console.error("Failed to load characters:", err);
			setError("Failed to load characters. Please try again.");
		} finally {
			setLoading(false);
		}
	});

	return (
		<>
			<PageMeta
				title={t("page.characters.title")}
				rightSlot={
					<Button href="/characters/create" size="sm">
						{t("common.create")}
					</Button>
				}
			/>

			<div class="space-y-6">
				<p class="text-mid text-ds-body text-center max-w-xl mx-auto">
					{t("page.characters.subtitle")}
				</p>

				<Show when={error()}>
					<div class="w-full max-w-md mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-ds-md text-danger text-center">
						{error()}
					</div>
				</Show>

				<Show when={loading()}>
					<div class="text-center py-8">
						<div class="w-12 h-12 mx-auto mb-3 border-4 border-plum-500/30 border-t-plum-500 rounded-full animate-spin" />
						<p class="text-mid text-ds-small">{t("common.loading")}</p>
					</div>
				</Show>

				<Show when={!loading()}>
					<div class="w-full flex flex-col gap-4 max-w-2xl mx-auto">
						<Show
							when={characters().length > 0}
							fallback={
								<p class="text-low text-center py-6">{t("page.characters.empty")}</p>
							}
						>
							<For each={characters()}>
								{(character) => (
									<CharacterCard
										character={character}
										onClick={() => navigate(`/characters/${character.id}`)}
									/>
								)}
							</For>
						</Show>

						<div class="w-full max-w-md mx-auto">
							<ButtonMenu
								icon={<Plus class="h-6 w-6" />}
								onClick={() => navigate("/characters/create")}
							/>
						</div>
					</div>
				</Show>
			</div>
		</>
	);
}
