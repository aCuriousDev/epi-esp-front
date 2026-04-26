import { Component, createSignal, onMount, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Map, ChevronRight, Trash2 } from "lucide-solid";
import { getAllMaps, deleteMap, getAllDungeons, deleteDungeon } from "../services/mapStorage";
import { DungeonCreationWizard } from "../components/DungeonCreationWizard";
import { safeConfirm } from "../services/ui/confirm";
import PageMeta from "../layouts/PageMeta";
import { SectionHeader } from "../components/common/SectionHeader";
import { t } from "../i18n";

// House+door icon for dungeons
const DungeonIcon: Component<{ size?: number; class?: string }> = (props) => (
	<svg
		width={props.size ?? 20}
		height={props.size ?? 20}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={props.class}
		aria-hidden="true"
	>
		<path d="M3 21V8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v13" />
		<circle cx="12" cy="13" r="3" />
		<path d="M9 21v-4M15 21v-4" />
	</svg>
);

function formatDate(ts: number): string {
	if (!ts) return "—";
	return new Date(ts).toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
}

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
		const standaloneMaps = allMaps.filter((m) => {
			try {
				const data = localStorage.getItem(`dndiscord_maps_${m.id}`);
				if (!data) return true;
				const parsed = JSON.parse(data);
				return parsed.mapType !== "dungeon-room";
			} catch {
				return true;
			}
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

	return (
		<Show
			when={!showDungeonWizard()}
			fallback={
				<DungeonCreationWizard onBack={() => { setShowDungeonWizard(false); loadData(); }} />
			}
		>
			<>
				<PageMeta title={t("page.mapEditor.title")} />

				<div class="max-w-[760px] mx-auto px-4 py-8">

					{/* Action grid: two big buttons */}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-9">
						<button
							type="button"
							onClick={handleCreateNew}
							class="menu-card menu-card-ghost flex items-center justify-center gap-2.5 !py-[18px] !px-6"
						>
							<Map size={18} class="text-gold-300" aria-hidden="true" />
							<span class="font-display font-semibold tracking-wide text-[14px]">
								{t("page.mapEditor.actions.newMap")}
							</span>
						</button>

						<button
							type="button"
							onClick={() => setShowDungeonWizard(true)}
							class="menu-card flex items-center justify-center gap-2.5 !py-[18px] !px-6"
							style={{
								background: "linear-gradient(135deg, rgba(75,30,78,0.55) 0%, rgba(22,44,68,0.6) 100%)",
								"border-color": "rgba(244,197,66,0.4)",
							}}
						>
							<DungeonIcon size={18} class="text-gold-300" />
							<span class="font-display font-semibold tracking-wide text-[14px] text-gold-300">
								{t("page.mapEditor.actions.newDungeon")}
							</span>
						</button>
					</div>

					{/* Dungeons section */}
					<Show when={dungeons().length > 0}>
						<div class="mb-9">
							<SectionHeader
								eyebrow={t("page.mapEditor.section.dungeons")}
								counter={String(dungeons().length)}
							/>
							<div class="flex flex-col gap-3">
								<For each={dungeons()}>
									{(d) => (
										<div class="menu-card !p-[18px] relative group">
											<div
												class="grid items-center gap-4"
												style={{ "grid-template-columns": "auto 1fr auto" }}
											>
												{/* Icon */}
												<span
													class="inline-flex items-center justify-center w-[42px] h-[42px] rounded-[var(--radius-md,8px)] text-gold-300 shrink-0"
													style={{
														background: "linear-gradient(135deg, rgba(75,30,78,0.5) 0%, rgba(22,44,68,0.5) 100%)",
														border: "1px solid rgba(244,197,66,0.25)",
													}}
												>
													<DungeonIcon size={20} />
												</span>

												{/* Info — clickable area */}
												<button
													type="button"
													onClick={() => navigate(`/dungeon-edit/${d.id}`)}
													class="min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
												>
													<h3 class="font-display font-semibold text-[16px] text-high tracking-wide mb-1">
														{d.name}
													</h3>
													<div class="flex items-center gap-2.5 font-mono text-[12px] text-low mb-2">
														<span>{t("page.mapEditor.dungeon.rooms", { n: d.totalRooms })}</span>
														<span
															class="w-[3px] h-[3px] rounded-full bg-[var(--text-mute)]"
															aria-hidden="true"
														/>
														<span>{t("page.mapEditor.dungeon.editedAt", { when: formatDate(d.updatedAt) })}</span>
													</div>
													<div class="flex flex-wrap gap-1.5">
														<For each={Array.from({ length: Math.min(d.totalRooms, 6) }, (_, i) => i + 1)}>
															{(n) => (
																<span
																	class="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[11px]"
																	style={{
																		background: "rgba(75,30,78,0.5)",
																		border: "1px solid rgba(244,197,66,0.25)",
																		color: "var(--gold-200)",
																	}}
																>
																	{t("page.mapEditor.dungeon.roomLabel", { n })}
																</span>
															)}
														</For>
													</div>
												</button>

												{/* Actions: chevron + delete */}
												<div class="flex items-center gap-2 shrink-0">
													<ChevronRight
														size={18}
														class="text-mid cursor-pointer"
														onClick={() => navigate(`/dungeon-edit/${d.id}`)}
														aria-hidden="true"
													/>
													<button
														type="button"
														onClick={(e) => handleDeleteDungeon(e, d.id)}
														class="p-1.5 rounded text-mute hover:text-danger transition"
														title={t("common.delete")}
														aria-label={`${t("common.delete")} ${d.name}`}
														disabled={deletingId() === d.id}
													>
														<Trash2 size={14} />
													</button>
												</div>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* Classic maps section */}
					<Show when={maps().length > 0}>
						<div>
							<SectionHeader
								eyebrow={t("page.mapEditor.section.maps")}
								counter={String(maps().length)}
							/>
							<div class="flex flex-col gap-2">
								<For each={maps()}>
									{(m) => (
										<div class="menu-card !p-[14px_18px] relative group">
											<div
												class="grid items-center gap-4"
												style={{ "grid-template-columns": "auto 1fr auto" }}
											>
												{/* Icon */}
												<span
													class="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-md,8px)] text-gold-300 shrink-0"
													style={{
														background: "linear-gradient(135deg, rgba(75,30,78,0.5) 0%, rgba(22,44,68,0.5) 100%)",
														border: "1px solid rgba(244,197,66,0.25)",
													}}
												>
													<Map size={16} />
												</span>

												{/* Info — clickable area */}
												<button
													type="button"
													onClick={() => handleEdit(m.id)}
													class="min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
												>
													<h3 class="font-display font-semibold text-[15px] text-high tracking-wide mb-0.5 truncate">
														{m.name}
													</h3>
													<div class="flex items-center gap-2.5 font-mono text-[11px] text-low">
														<span>{t("page.mapEditor.map.createdAt", { when: formatDate(m.createdAt) })}</span>
														<span class="text-[var(--text-mute)]" aria-hidden="true">·</span>
														<span>{t("page.mapEditor.map.editedAt", { when: formatDate(m.updatedAt) })}</span>
													</div>
												</button>

												{/* Actions: chevron + delete */}
												<div class="flex items-center gap-2 shrink-0">
													<ChevronRight
														size={16}
														class="text-mid cursor-pointer"
														onClick={() => handleEdit(m.id)}
														aria-hidden="true"
													/>
													<button
														type="button"
														onClick={(e) => handleDelete(e, m.id)}
														class="p-1.5 rounded text-mute hover:text-danger transition"
														title={t("common.delete")}
														aria-label={`${t("common.delete")} ${m.name}`}
														disabled={deletingId() === m.id}
													>
														<Trash2 size={14} />
													</button>
												</div>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* Empty state */}
					<Show when={maps().length === 0 && dungeons().length === 0}>
						<p class="text-low text-center py-8 font-old italic">
							{t("page.mapSelection.empty")}
						</p>
					</Show>

				</div>
			</>
		</Show>
	);
}
