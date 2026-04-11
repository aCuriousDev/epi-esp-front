import { Component, createSignal, onMount, For, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { ArrowLeft, Plus, Trash2, Edit2 } from "lucide-solid";
import { getAllMaps, deleteMap, getAllDungeons, deleteDungeon, loadDungeon } from "../services/mapStorage";
import { DungeonCreationWizard } from "../components/DungeonCreationWizard";
import { safeConfirm } from "../services/ui/confirm";

export default function MapSelectionScreen() {
	const navigate = useNavigate();
	const [maps, setMaps] = createSignal<Array<{ id: string; name: string; createdAt: number; updatedAt: number }>>([]);
	const [dungeons, setDungeons] = createSignal<Array<{ id: string; name: string; totalRooms: number; createdAt: number; updatedAt: number }>>([]);
	const [deletingId, setDeletingId] = createSignal<string | null>(null);
	const [showDungeonWizard, setShowDungeonWizard] = createSignal(false);

	onMount(() => {
		loadData();
	});

	const loadData = () => {
		const allMaps = getAllMaps();
		allMaps.sort((a, b) => b.updatedAt - a.updatedAt);
		const standaloneMaps = allMaps.filter(m => {
			try {
				const data = localStorage.getItem(`dndiscord_maps_${m.id}`);
				if (!data) return true;
				const parsed = JSON.parse(data);
				return parsed.mapType !== "dungeon-room";
			} catch { return true; }
		});
		setMaps(standaloneMaps);

		const allDungeons = getAllDungeons();
		allDungeons.sort((a, b) => b.updatedAt - a.updatedAt);
		setDungeons(allDungeons);
	};

	const handleCreateNew = () => {
		navigate("/map-editor/new");
	};

	const handleEdit = (mapId: string) => {
		navigate(`/map-editor/${mapId}`);
	};

	const handleEditDungeonRoom = (dungeonId: string, roomIndex: number) => {
		const dungeon = loadDungeon(dungeonId);
		if (!dungeon || roomIndex >= dungeon.roomIds.length) return;
		const roomId = dungeon.roomIds[roomIndex];
		navigate(`/map-editor/${roomId}?dungeon=${dungeonId}&room=${roomIndex}`);
	};

	const handleDelete = (e: Event, mapId: string) => {
		e.stopPropagation();
		if (safeConfirm("Êtes-vous sûr de vouloir supprimer cette map ?")) {
			setDeletingId(mapId);
			deleteMap(mapId);
			loadData();
			setDeletingId(null);
		}
	};

	const handleDeleteDungeon = (e: Event, dungeonId: string) => {
		e.stopPropagation();
		if (safeConfirm("Êtes-vous sûr de vouloir supprimer ce donjon et toutes ses salles ?")) {
			setDeletingId(dungeonId);
			deleteDungeon(dungeonId);
			loadData();
			setDeletingId(null);
		}
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
		<Show when={!showDungeonWizard()} fallback={
			<DungeonCreationWizard onBack={() => { setShowDungeonWizard(false); loadData(); }} />
		}>
			<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
				<div class="vignette absolute inset-0 pointer-events-none"></div>

				<A href="/" class="settings-btn" aria-label="Retour">
					<ArrowLeft class="settings-icon h-5 w-5" />
				</A>

				<div class="flex flex-col items-center justify-center min-h-screen p-8">
					<div class="w-full max-w-4xl">
						<div class="mb-8 text-center">
							<h1 class="text-4xl font-display text-white mb-2">Mes Maps</h1>
							<p class="text-slate-300">Sélectionnez une map à modifier ou créez-en une nouvelle</p>
						</div>

						<div class="flex flex-col sm:flex-row gap-3 mb-6">
							<button
								onClick={handleCreateNew}
								class="flex-1 px-6 py-4 bg-gradient-to-r from-brandStart to-brandEnd hover:from-brandStart/90 hover:to-brandEnd/90 text-white font-medium rounded-xl transition shadow-lg flex items-center justify-center gap-2"
							>
								<Plus class="h-5 w-5" />
								Nouvelle map classique
							</button>
							<button
								onClick={() => setShowDungeonWizard(true)}
								class="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-medium rounded-xl transition shadow-lg flex items-center justify-center gap-2"
							>
								<Plus class="h-5 w-5" />
								Nouveau donjon
							</button>
						</div>

						{/* Dungeons */}
						<Show when={dungeons().length > 0}>
							<div class="mb-8">
								<h2 class="text-xl font-display text-purple-300 mb-4">Donjons</h2>
								<div class="space-y-3">
									<For each={dungeons()}>
										{(dungeon) => {
											const dData = loadDungeon(dungeon.id);
											return (
												<div class="bg-purple-900/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 group">
													<div class="flex items-center justify-between mb-3">
														<div class="flex-1">
															<h3 class="text-white font-medium text-lg">{dungeon.name}</h3>
															<div class="flex gap-4 text-sm text-slate-400">
																<span>{dungeon.totalRooms} salles</span>
																<span>•</span>
																<span>Modifié le {formatDate(dungeon.updatedAt)}</span>
															</div>
														</div>
														<button
															onClick={(e) => handleDeleteDungeon(e, dungeon.id)}
															class="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition opacity-0 group-hover:opacity-100"
															title="Supprimer le donjon"
															disabled={deletingId() === dungeon.id}
														>
															<Trash2 class="h-4 w-4" />
														</button>
													</div>
													<div class="flex flex-wrap gap-2">
														<For each={Array.from({ length: dungeon.totalRooms }, (_, i) => i)}>
															{(roomIndex) => (
																<button
																	onClick={() => handleEditDungeonRoom(dungeon.id, roomIndex)}
																	class="px-3 py-1.5 rounded-lg bg-purple-700/40 hover:bg-purple-600/60 text-purple-200 text-sm transition border border-purple-500/20"
																>
																	Salle {roomIndex + 1}
																</button>
															)}
														</For>
													</div>
												</div>
											);
										}}
									</For>
								</div>
							</div>
						</Show>

						{/* Standalone maps */}
						<Show when={maps().length > 0}>
							<h2 class="text-xl font-display text-white mb-4">Maps classiques</h2>
						</Show>
						<Show
							when={maps().length > 0}
							fallback={
								<div class="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
									<p class="text-slate-300">Aucune map classique sauvegardée</p>
									<p class="text-slate-400 text-sm mt-2">Créez votre première map pour commencer</p>
								</div>
							}
						>
							<div class="space-y-3">
								<For each={maps()}>
									{(map) => (
									<div
										class="w-full text-left bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-white/20 transition cursor-pointer group"
										role="group"
										aria-label={map.name}
									>
											<div class="flex items-center justify-between">
												<button
													class="flex-1 text-left"
													onClick={() => handleEdit(map.id)}
												>
													<h3 class="text-white font-medium text-lg mb-1">{map.name}</h3>
													<div class="flex gap-4 text-sm text-slate-400">
														<span>Créée le {formatDate(map.createdAt)}</span>
														<span>•</span>
														<span>Modifiée le {formatDate(map.updatedAt)}</span>
													</div>
												</button>
												<div class="flex items-center gap-2">
													<button
														onClick={() => handleEdit(map.id)}
														class="p-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition opacity-0 group-hover:opacity-100"
														title="Modifier"
														aria-label={`Modifier ${map.name}`}
													>
														<Edit2 class="h-4 w-4" />
													</button>
													<button
														onClick={(e) => handleDelete(e, map.id)}
														class="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition opacity-0 group-hover:opacity-100"
														title="Supprimer"
														aria-label={`Supprimer ${map.name}`}
														disabled={deletingId() === map.id}
													>
														<Trash2 class="h-4 w-4" />
													</button>
												</div>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</div>
				</div>
			</div>
		</Show>
	);
}
