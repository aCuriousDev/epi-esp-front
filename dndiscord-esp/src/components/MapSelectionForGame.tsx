import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { ArrowLeft, Map, Dices } from 'lucide-solid';
import { fetchMine, type MapMeta } from '../services/mapRepository';

interface MapSelectionForGameProps {
  onSelectMap: (mapId: string | null) => void;
  onBack: () => void;
}

export const MapSelectionForGame: Component<MapSelectionForGameProps> = (props) => {
  const [maps, setMaps] = createSignal<MapMeta[]>([]);

  onMount(() => {
    loadMaps();
  });

  const loadMaps = async () => {
    const allMaps = await fetchMine();
    setMaps(allMaps);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div class="w-full h-screen flex items-center justify-center bg-game-darker relative">
      {/* Back button */}
      <button
        onClick={props.onBack}
        class="in-game-back-btn"
        aria-label="Back"
      >
        <ArrowLeft class="in-game-back-icon h-5 w-5" />
      </button>

      <div class="max-w-4xl w-full px-4 sm:px-8">
        {/* Title */}
        <div class="text-center mb-12">
          <h1 class="font-fantasy text-3xl sm:text-4xl md:text-5xl text-game-gold mb-4 flex items-center justify-center gap-3">
            <Map class="w-8 h-8 sm:w-10 sm:h-10" />
            Select a Map
          </h1>
          <p class="text-xl text-gray-300">Choose the battlefield for your game</p>
        </div>

        {/* Use default map option */}
        <button
          onClick={() => props.onSelectMap(null)}
          class="w-full mb-6 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium rounded-xl transition shadow-lg flex items-center justify-center gap-2"
        >
          <Dices class="w-5 h-5" />
          <span>Use Default Map</span>
        </button>

        {/* Maps list */}
        <Show
          when={maps().length > 0}
          fallback={
            <div class="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
              <p class="text-slate-300">No saved maps available</p>
              <p class="text-slate-400 text-sm mt-2">Use the default map or create maps in the Map Editor</p>
            </div>
          }
        >
          <div class="space-y-3">
            <h3 class="text-game-gold font-fantasy text-xl mb-4">Saved Maps</h3>
            <For each={maps()}>
              {(map) => (
                <button
                  onClick={() => props.onSelectMap(map.id)}
                  class="w-full bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-game-gold/50 hover:shadow-lg hover:shadow-game-gold/20 transition cursor-pointer text-left group"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <h3 class="text-white font-medium text-lg mb-1 group-hover:text-game-gold transition">
                        {map.name}
                      </h3>
                      <div class="flex gap-4 text-sm text-gray-400">
                        <span>Created: {formatDate(map.createdAt)}</span>
                        <span>•</span>
                        <span>Updated: {formatDate(map.updatedAt)}</span>
                      </div>
                    </div>
                    <div class="text-game-gold opacity-0 group-hover:opacity-100 transition">
                      →
                    </div>
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};
