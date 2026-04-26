import { createSignal } from 'solid-js';

export interface Character {
	id: string;
	name: string;
	race: string;
	class: string;
	classKey: string;
	createdAt: number;
}

// Load from localStorage on init
function loadCharacters(): Character[] {
	try {
		const stored = localStorage.getItem('dndiscord_characters');
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (error) {
		console.error('Failed to load characters from localStorage:', error);
	}
	return [];
}

// Save to localStorage
function saveCharacters(characters: Character[]): void {
	try {
		localStorage.setItem('dndiscord_characters', JSON.stringify(characters));
	} catch (error) {
		console.error('Failed to save characters to localStorage:', error);
	}
}

// Create store with initial data from localStorage
const [characters, setCharacters] = createSignal<Character[]>(loadCharacters());

// Export reactive signal
export { characters };

// Add a new character
export function addCharacter(character: Omit<Character, 'id' | 'createdAt'>): void {
	const newCharacter: Character = {
		...character,
		id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		createdAt: Date.now(),
	};
	
	const updated = [...characters(), newCharacter];
	setCharacters(updated);
	saveCharacters(updated);
}

// Remove a character
export function removeCharacter(id: string): void {
	const updated = characters().filter(c => c.id !== id);
	setCharacters(updated);
	saveCharacters(updated);
}

// Get a character by ID
export function getCharacter(id: string): Character | undefined {
	return characters().find(c => c.id === id);
}




