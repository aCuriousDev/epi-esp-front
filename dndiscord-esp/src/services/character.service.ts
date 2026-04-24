import axios from "axios";
import { getApiUrl } from "./config";

const API_URL = getApiUrl();

/**
 * Character enums matching backend
 */
export enum CharacterClass {
  Barbare = "Barbare",
  Barde = "Barde",
  Clerc = "Clerc",
  Druide = "Druide",
  Guerrier = "Guerrier",
  Moine = "Moine",
  Paladin = "Paladin",
  Rodeur = "Rodeur",
  Voleur = "Voleur",
  Ensorceleur = "Ensorceleur",
  Sorcier = "Sorcier",
  Magicien = "Magicien",
}

export enum CharacterRace {
  Humain = "Humain",
  Elfe = "Elfe",
  Nain = "Nain",
  Halfelin = "Halfelin",
  DemiOrc = "DemiOrc",
  Tieffelin = "Tieffelin",
  Gnome = "Gnome",
}

/**
 * Backend API Types
 */
export interface AbilityScoresDto {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface RaceTraitsDto {
  strengthModifier: number;
  dexterityModifier: number;
  constitutionModifier: number;
  intelligenceModifier: number;
  wisdomModifier: number;
  charismaModifier: number;
  baseSpeed: number;
  specialAbilities: string[];
}

export interface ClassTraitsDto {
  mainCharacteristic: string;
  hitDie: string;
  savingThrows: string[];
  proficiencies: string[];
  isSpellcaster: boolean;
  specialFeatures: string[];
}

export interface CreateCharacterRequest {
  name: string;
  class: CharacterClass;
  race: CharacterRace;
  abilities: AbilityScoresDto;
}

export interface UpdateHitPointsRequest {
  hitPoints: number;
}

export interface CharacterDto {
  id: string;
  name: string;
  level: number;
  experiencePoints: number;
  class: CharacterClass;
  race: CharacterRace;
  currentHitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  initiative: number;
  speed: number;
  abilities: AbilityScoresDto;
  raceTraits: RaceTraitsDto;
  classTraits: ClassTraitsDto;
}

/**
 * Helper to get auth header
 */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Character Service - handles all character API calls
 */
export const CharacterService = {
  /**
   * Create a new character
   */
  async createCharacter(request: CreateCharacterRequest): Promise<CharacterDto> {
    const response = await axios.post<CharacterDto>(
      `${API_URL}/api/games/character`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Get character by ID
   */
  async getCharacter(id: string): Promise<CharacterDto> {
    const response = await axios.get<CharacterDto>(
      `${API_URL}/api/games/character/${id}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Get all characters for the current user
   */
  async getMyCharacters(): Promise<CharacterDto[]> {
    const response = await axios.get<CharacterDto[]>(
      `${API_URL}/api/games/character/my-characters`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Update character hit points
   */
  async updateHitPoints(id: string, hitPoints: number): Promise<CharacterDto> {
    const response = await axios.patch<CharacterDto>(
      `${API_URL}/api/games/character/${id}/hit-points`,
      { hitPoints },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Level up a character
   */
  async levelUp(id: string): Promise<CharacterDto> {
    const response = await axios.post<CharacterDto>(
      `${API_URL}/api/games/character/${id}/level-up`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
};
