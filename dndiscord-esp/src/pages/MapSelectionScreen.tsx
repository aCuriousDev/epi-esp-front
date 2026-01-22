import { Component, createSignal, onMount, For, Show } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { ArrowLeft, Plus, Trash2, Edit2 } from "lucide-solid";
import { getAllMaps, deleteMap, type SavedMapData } from "../services/mapStorage";

export default function MapSelectionScreen() {
	const navigate = useNavigate();
	const [maps, setMaps] = createSignal<Array<{ id: string; name: string; createdAt: number; updatedAt: number }>>([]);
	const [deletingId, setDeletingId] = createSignal<string | null>(null);

	onMount(() => {
		loadMaps();
	});

	const loadMaps = () => {
		const allMaps = getAllMaps();
		// Trier par date de mise à jour (plus récent en premier)
		allMaps.sort((a, b) => b.updatedAt - a.updatedAt);
		setMaps(allMaps);
	};

	const handleCreateNew = () => {
		navigate("/map-editor/new");
	};

	const handleEdit = (mapId: string) => {
		navigate(`/map-editor/${mapId}`);
	};

	const handleDelete = (e: Event, mapId: string) => {
		e.stopPropagation();
		if (confirm("Êtes-vous sûr de vouloir supprimer cette map ?")) {
			setDeletingId(mapId);
			deleteMap(mapId);
			loadMaps();
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
		<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
			<div class="vignette absolute inset-0 pointer-events-none"></div>

			{/* Back button */}
			<A href="/" class="settings-btn" aria-label="Retour">
				<ArrowLeft class="settings-icon h-5 w-5" />
			</A>

			{/* Main content */}
			<div class="flex flex-col items-center justify-center min-h-screen p-8">
				<div class="w-full max-w-4xl">
					{/* Header */}
					<div class="mb-8 text-center">
						<h1 class="text-4xl font-display text-white mb-2">Mes Maps</h1>
						<p class="text-slate-300">Sélectionnez une map à modifier ou créez-en une nouvelle</p>
					</div>

					{/* Create new button */}
					<button
						onClick={handleCreateNew}
						class="w-full mb-6 px-6 py-4 bg-gradient-to-r from-brandStart to-brandEnd hover:from-brandStart/90 hover:to-brandEnd/90 text-white font-medium rounded-xl transition shadow-lg flex items-center justify-center gap-2"
					>
						<Plus class="h-5 w-5" />
						Créer une nouvelle map
					</button>

					{/* Maps list */}
					<Show
						when={maps().length > 0}
						fallback={
							<div class="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
								<p class="text-slate-300">Aucune map sauvegardée</p>
								<p class="text-slate-400 text-sm mt-2">Créez votre première map pour commencer</p>
							</div>
						}
					>
						<div class="space-y-3">
							<For each={maps()}>
								{(map) => (
									<div
										class="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-white/20 transition cursor-pointer group"
										onClick={() => handleEdit(map.id)}
									>
										<div class="flex items-center justify-between">
											<div class="flex-1">
												<h3 class="text-white font-medium text-lg mb-1">{map.name}</h3>
												<div class="flex gap-4 text-sm text-slate-400">
													<span>Créée le {formatDate(map.createdAt)}</span>
													<span>•</span>
													<span>Modifiée le {formatDate(map.updatedAt)}</span>
												</div>
											</div>
											<div class="flex items-center gap-2">
												<button
													onClick={(e) => handleEdit(map.id)}
													class="p-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition opacity-0 group-hover:opacity-100"
													title="Modifier"
												>
													<Edit2 class="h-4 w-4" />
												</button>
												<button
													onClick={(e) => handleDelete(e, map.id)}
													class="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition opacity-0 group-hover:opacity-100"
													title="Supprimer"
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
	);
}
