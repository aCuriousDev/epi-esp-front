import { Component, createSignal, onMount, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Plus, Trash2, Edit2 } from "lucide-solid";
import { getAllMaps, deleteMap, getAllDungeons, deleteDungeon, loadDungeon } from "../services/mapStorage";
import { DungeonCreationWizard } from "../components/DungeonCreationWizard";
import { safeConfirm } from "../services/ui/confirm";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

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
		if (safeConfirm(t("page.mapSelection.deleteMapConfirm"))) {
			setDeletingId(mapId);
			deleteMap(mapId);
			loadData();
			setDeletingId(null);
		}
	};

	const handleDeleteDungeon = (e: Event, dungeonId: string) => {
		e.stopPropagation();
		if (safeConfirm(t("page.mapSelection.deleteDungeonConfirm"))) {
			setDeletingId(dungeonId);
			deleteDungeon(dungeonId);
			loadData();
			setDeletingId(null);
		}
	};

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleDateString("en-US", {
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
			<>
				<PageMeta title={t("page.mapEditor.title")} />

				<div class="relative min-h-full w-full overflow-hidden map-selection-page">

					<div class="flex flex-col items-center justify-center min-h-screen p-8">
						<div class="w-full max-w-4xl">
							<div class="mb-8 text-center">
								<h1 class="text-4xl font-display text-white mb-2">{t("page.mapSelection.title")}</h1>
								<p class="text-slate-300">{t("page.mapSelection.subtitle")}</p>
							</div>

							<div class="flex flex-col sm:flex-row gap-3 mb-6">
								<button
									onClick={handleCreateNew}
									class="flex-1 px-6 py-4 bg-gradient-to-r from-brandStart to-brandEnd hover:from-brandStart/90 hover:to-brandEnd/90 text-white font-medium rounded-xl transition shadow-lg flex items-center justify-center gap-2"
								>
									<Plus class="h-5 w-5" />
									{t("page.mapSelection.newMap")}
								</button>
								<button
									onClick={() => setShowDungeonWizard(true)}
									class="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-medium rounded-xl transition shadow-lg flex items-center justify-center gap-2"
								>
									<Plus class="h-5 w-5" />
									{t("page.mapSelection.newDungeon")}
								</button>
							</div>

							{/* Dungeons */}
							<Show when={dungeons().length > 0}>
								<div class="mb-8">
									<h2 class="text-xl font-display text-purple-300 mb-4">{t("page.mapSelection.dungeons")}</h2>
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
																	<span>{t("page.mapSelection.rooms").replace("{n}", String(dungeon.totalRooms))}</span>
																	<span>•</span>
																	<span>{t("page.mapSelection.editedOn").replace("{date}", formatDate(dungeon.updatedAt))}</span>
																</div>
															</div>
															<button
																onClick={(e) => handleDeleteDungeon(e, dungeon.id)}
																class="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition opacity-0 group-hover:opacity-100"
																title={t("common.delete")}
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
																		{t("page.mapSelection.room").replace("{n}", String(roomIndex + 1))}
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
								<h2 class="text-xl font-display text-white mb-4">{t("page.mapSelection.classicMaps")}</h2>
							</Show>
							<Show
								when={maps().length > 0}
								fallback={
									<div class="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
										<p class="text-slate-300">{t("page.mapSelection.noMaps")}</p>
										<p class="text-slate-400 text-sm mt-2">{t("page.mapSelection.noMapsHint")}</p>
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
															<span>{t("page.mapSelection.createdOn").replace("{date}", formatDate(map.createdAt))}</span>
															<span>•</span>
															<span>{t("page.mapSelection.editedOn").replace("{date}", formatDate(map.updatedAt))}</span>
														</div>
													</button>
													<div class="flex items-center gap-2">
														<button
															onClick={() => handleEdit(map.id)}
															class="p-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition opacity-0 group-hover:opacity-100"
															title={t("common.edit")}
															aria-label={`${t("common.edit")} ${map.name}`}
														>
															<Edit2 class="h-4 w-4" />
														</button>
														<button
															onClick={(e) => handleDelete(e, map.id)}
															class="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition opacity-0 group-hover:opacity-100"
															title={t("common.delete")}
															aria-label={`${t("common.delete")} ${map.name}`}
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
			</>
		</Show>
	);
}
