export type StoryItemType = 'narrative' | 'choice';

export interface StoryItem {
  id: string;
  type: StoryItemType;
  content: string;
}

export interface StoryNodeData {
  id: string;
  type: 'story';
  items: StoryItem[];
}