import { CharacterDto } from "../services/character.service";
import { GetCharacterProfilPic } from "../utils/characterProfilPic";
import { CharacterClass } from "../types/character";

interface CharacterCardProps {
	character: CharacterDto;
	onClick?: () => void;
}

export default function CharacterCard({ character, onClick }: CharacterCardProps) {
	const profilPicUrl = GetCharacterProfilPic.getCharacterProfilPic(
		character.class as CharacterClass
	);

	return (
		<button
			onClick={onClick}
			class="group relative w-full max-w-md mx-auto overflow-hidden rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-sm transition-all duration-300 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
		>
			{/* Background gradient overlay */}
			<div class="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

			<div class="relative p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
				{/* Character Portrait */}
				<div class="flex-shrink-0">
					<div class="w-23 h-23 sm:w-25 sm:h-25 p-1 transition-colors duration-300">
						<img
							src={profilPicUrl}
							alt={`${character.name} portrait`}
							class="w-20 h-23 sm:w-25 sm:h-25 object-contain"
						/>
					</div>
				</div>

				{/* Character Info */}
				<div class="flex-1 text-center sm:text-left min-w-0">
					{/* Name */}
					<h3 class="font-fantasy text-xl sm:text-2xl font-bold text-white mb-3 truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
						{character.name}
					</h3>

					{/* Level, Class, Race */}
					<div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
						{/* Level Badge */}
						<span class="inline-flex items-center px-3 py-1 rounded-full bg-purple-600/40 border border-purple-400/50 text-sm font-semibold text-purple-100 shadow-sm">
							Niveau {character.level}
						</span>

						{/* Class */}
						<span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-600/40 border border-blue-400/50 text-sm font-medium text-blue-100">
							{character.class}
						</span>

						{/* Race */}
						<span class="inline-flex items-center px-3 py-1 rounded-full bg-slate-600/40 border border-slate-400/50 text-sm font-medium text-slate-100">
							{character.race}
						</span>
					</div>
				</div>
			</div>

			{/* Hover effect indicator */}
			<div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
		</button>
	);
}
