import { Component, createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ArrowLeft } from "lucide-solid";
import {
	generateMapId,
	generateDungeonId,
	saveDungeon,
	saveMap,
	type DungeonData,
	type SavedMapData,
} from "../services/mapStorage";

interface DungeonCreationWizardProps {
	onBack: () => void;
}

export const DungeonCreationWizard: Component<DungeonCreationWizardProps> = (props) => {
	const navigate = useNavigate();
	const [dungeonName, setDungeonName] = createSignal("Nouveau Donjon");
	const [roomCount, setRoomCount] = createSignal(3);
	const [isCreating, setIsCreating] = createSignal(false);

	const handleCreate = () => {
		const name = dungeonName().trim();
		if (!name) {
			alert("Veuillez entrer un nom pour le donjon");
			return;
		}
		if (roomCount() < 2 || roomCount() > 20) {
			alert("The number of rooms must be between 2 and 20");
			return;
		}

		setIsCreating(true);

		try {
			const dungeonId = generateDungeonId();
			const roomIds: string[] = [];

			for (let i = 0; i < roomCount(); i++) {
				const roomMapId = generateMapId();
				roomIds.push(roomMapId);

				const roomMap: SavedMapData = {
					id: roomMapId,
					name: `${name} - Salle ${i + 1}`,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					cells: [],
					mapType: "dungeon-room",
					dungeonId,
					roomIndex: i,
				};
				saveMap(roomMap);
			}

			const dungeon: DungeonData = {
				id: dungeonId,
				name,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				roomIds,
				totalRooms: roomCount(),
			};
			saveDungeon(dungeon);

			navigate(`/map-editor/${roomIds[0]}?dungeon=${dungeonId}&room=0`);
		} catch (error) {
			console.error("Error creating dungeon:", error);
			alert("Error creating dungeon");
			setIsCreating(false);
		}
	};

	return (
		<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
			<div class="vignette absolute inset-0 pointer-events-none"></div>

			<button onClick={props.onBack} class="in-game-back-btn" aria-label="Back">
				<ArrowLeft class="in-game-back-icon h-5 w-5" />
			</button>

			<div class="flex flex-col items-center justify-center min-h-screen p-8">
				<div class="w-full max-w-lg">
					<div class="mb-8 text-center">
						<h1 class="text-4xl font-display text-white mb-2">Create a Dungeon</h1>
						<p class="text-slate-300">
							A dungeon is a series of rooms connected by teleportation portals
						</p>
					</div>

					<div class="bg-black/60 backdrop-blur-sm rounded-xl p-6 border border-white/10 space-y-6">
						<div>
							<label class="block text-sm text-slate-300 mb-2">Nom du donjon</label>
							<input
								type="text"
								value={dungeonName()}
								onInput={(e) => setDungeonName(e.currentTarget.value)}
								class="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500 transition"
								placeholder="Ex: Crypte des Ombres"
							/>
						</div>

						<div>
							<label class="block text-sm text-slate-300 mb-2">
								Nombre de salles : <strong class="text-purple-400">{roomCount()}</strong>
							</label>
							<input
								type="range"
								min="2"
								max="10"
								value={roomCount()}
								onInput={(e) => setRoomCount(parseInt(e.currentTarget.value))}
								class="w-full accent-purple-500"
							/>
							<div class="flex justify-between text-xs text-slate-500 mt-1">
								<span>2</span>
								<span>10</span>
							</div>
						</div>

						<div class="bg-purple-900/20 rounded-lg p-4 border border-purple-500/20">
							<h3 class="text-purple-300 font-medium text-sm mb-2">How it works</h3>
							<ul class="text-xs text-slate-400 space-y-1.5">
								<li>1. You will create {roomCount()} rooms one by one in the editor</li>
								<li>2. On each room (except the last), place <span class="text-purple-400">teleportation</span> cells (purple)</li>
								<li>3. Teleportation cells lead to the next room</li>
								<li>4. In the last room, kill all enemies or reach a portal to win the dungeon</li>
							</ul>
						</div>

						<button
							onClick={handleCreate}
							disabled={isCreating()}
							class="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-medium rounded-xl transition shadow-lg disabled:opacity-50"
						>
							<Show when={!isCreating()} fallback="Creating...">
								Create dungeon and start editing
							</Show>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
