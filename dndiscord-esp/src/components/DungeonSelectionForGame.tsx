import { Component, createSignal, onMount, For, Show } from "solid-js";
import { ArrowLeft } from "lucide-solid";
import { getAllDungeons, loadDungeon, type DungeonData } from "../services/mapStorage";

interface DungeonSelectionForGameProps {
	onSelectDungeon: (dungeonId: string) => void;
	onBack: () => void;
}

export const DungeonSelectionForGame: Component<DungeonSelectionForGameProps> = (props) => {
	const [dungeons, setDungeons] = createSignal<
		Array<{ id: string; name: string; totalRooms: number; createdAt: number; updatedAt: number }>
	>([]);

	onMount(() => {
		const allDungeons = getAllDungeons();
		allDungeons.sort((a, b) => b.updatedAt - a.updatedAt);
		setDungeons(allDungeons);
	});

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
			<button onClick={props.onBack} class="settings-btn" aria-label="Retour">
				<ArrowLeft class="settings-icon h-5 w-5" />
			</button>

			<div class="max-w-4xl w-full px-8">
				<div class="text-center mb-12">
					<h1 class="font-fantasy text-5xl text-game-gold mb-4">🏰 Sélectionner un Donjon</h1>
					<p class="text-xl text-gray-300">Choisissez le donjon à explorer</p>
				</div>

				<Show
					when={dungeons().length > 0}
					fallback={
						<div class="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
							<p class="text-slate-300">Aucun donjon disponible</p>
							<p class="text-slate-400 text-sm mt-2">
								Créez un donjon dans l'éditeur de maps pour commencer
							</p>
						</div>
					}
				>
					<div class="space-y-3">
						<For each={dungeons()}>
							{(dungeon) => (
								<button
									onClick={() => props.onSelectDungeon(dungeon.id)}
									class="w-full bg-purple-900/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 transition cursor-pointer text-left group"
								>
									<div class="flex items-center justify-between">
										<div class="flex-1">
											<h3 class="text-white font-medium text-lg mb-1 group-hover:text-purple-300 transition">
												{dungeon.name}
											</h3>
											<div class="flex gap-4 text-sm text-gray-400">
												<span class="text-purple-400 font-medium">
													{dungeon.totalRooms} salles
												</span>
												<span>•</span>
												<span>Modifié le {formatDate(dungeon.updatedAt)}</span>
											</div>
										</div>
										<div class="text-purple-400 opacity-0 group-hover:opacity-100 transition text-2xl">
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
