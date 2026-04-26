import { useNavigate } from "@solidjs/router";
import { BookPlus } from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import CharacterCard from "../components/CharacterCard";
import { CharacterService, CharacterDto } from "../services/character.service";
import PageMeta from "../layouts/PageMeta";
import Button from "../components/common/Button";
import SectionHeader from "../components/common/SectionHeader";
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
      const data = await CharacterService.getMyCharacters();
      setCharacters(data);
    } catch (err) {
      console.error("Failed to load characters:", err);
      setError("Failed to load characters. Please try again.");
    } finally {
      setLoading(false);
    }
  });

  const counter = () => {
    const n = characters().length;
    if (n === 0) return undefined;
    return `${n} ${n === 1 ? t("page.characters.heroOne") : t("page.characters.heroMany")}`.toUpperCase();
  };

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

      <div class="max-w-[720px] mx-auto space-y-5">
        <p class="text-mid text-ds-body text-center font-old italic max-w-xl mx-auto">
          {t("page.characters.subtitle")}
        </p>

        <Show when={error()}>
          <div class="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-ds-md text-danger text-center">
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
          <div>
            <SectionHeader
              eyebrow={t("page.characters.rosterEyebrow")}
              counter={counter()}
            />
            <div class="flex flex-col gap-3">
              <Show
                when={characters().length > 0}
                fallback={
                  <p class="text-low text-center py-6 font-old italic">
                    {t("page.characters.empty")}
                  </p>
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

              <button
                type="button"
                onClick={() => navigate("/characters/create")}
                class="menu-card menu-card-ghost flex items-center justify-center gap-2.5 !py-4 !px-6"
              >
                <BookPlus size={18} class="text-gold-300" aria-hidden="true" />
                <span class="font-display font-semibold tracking-wide text-mid">
                  {t("page.characters.forgeNew")}
                </span>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </>
  );
}
