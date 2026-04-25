import { Component, createSignal, For, Show } from 'solid-js';
import { CombatNode, CombatNodeData } from './nodes/CombatNode';
import { CampaignNode } from './nodes/CampaignNode';
import { HARDCODED_MAPS } from './constants/gameData';

interface CombatNodeEditorProps {
  node: CombatNode;
  handleUpdateNode: (node: CampaignNode) => void;
}

const fieldStyle = {
  width: '100%',
  background: '#1e1e1e',
  border: '1px solid #3c3c3f',
  'border-radius': '4px',
  color: '#d4d4d4',
  padding: '0.5rem 0.75rem',
  'font-family': 'inherit',
  'font-size': '0.9rem',
};

const labelStyle = {
  display: 'block',
  'margin-bottom': '0.5rem',
  'font-weight': '500',
  'font-size': '0.9rem',
};

const CombatNodeEditor: Component<CombatNodeEditorProps> = (props) => {
  const data = props.node.getData() as CombatNodeData;

  const [title, setTitle] = createSignal<string>(data.title ?? '');
  const [selectedMap, setSelectedMap] = createSignal<string>(data.selectedMap ?? '');
  const [difficulty, setDifficulty] = createSignal<'easy' | 'medium' | 'hard'>(data.difficulty ?? 'medium');

  const handleUpdateTitle = (newTitle: string) => {
    setTitle(newTitle);
    props.node.updateTitle(newTitle);
  };

  const handleUpdateMap = (mapId: string) => {
    setSelectedMap(mapId);
    props.node.updateMap(mapId);
    props.handleUpdateNode(props.node);
  };

  const handleUpdateDifficulty = (diff: 'easy' | 'medium' | 'hard') => {
    setDifficulty(diff);
    props.node.updateDifficulty(diff);
    props.handleUpdateNode(props.node);
  };

  const currentMap = () => HARDCODED_MAPS.find(m => m.id === selectedMap());

  return (
    <div>
      {/* Titre */}
      <div style={{ 'margin-bottom': '1.25rem' }}>
        <label style={labelStyle}>🏷️ Titre du bloc :</label>
        <input
          type="text"
          value={title()}
          onInput={(e) => handleUpdateTitle(e.currentTarget.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onBlur={() => props.handleUpdateNode(props.node)}
          placeholder="Nom affiché sur le canvas..."
          style={fieldStyle}
        />
      </div>

      {/* Carte */}
      <div style={{ 'margin-bottom': '1.25rem' }}>
        <label style={labelStyle}>🗺️ Carte :</label>
        <select
          value={selectedMap()}
          onChange={(e) => handleUpdateMap(e.currentTarget.value)}
          style={{ ...fieldStyle, cursor: 'pointer' }}
        >
          <option value="">— Sélectionner une carte —</option>
          <For each={HARDCODED_MAPS}>
            {(map) => (
              <option value={map.id}>
                {map.label} ({map.dimension.width}×{map.dimension.height})
              </option>
            )}
          </For>
        </select>
        <Show when={currentMap()}>
          <p style={{ 'font-size': '0.8rem', color: '#888', 'margin-top': '0.25rem' }}>
            Dimensions : {currentMap()!.dimension.width} × {currentMap()!.dimension.height} cases
          </p>
        </Show>
      </div>

      {/* Difficulté */}
      <div style={{ 'margin-bottom': '1.5rem' }}>
        <label style={labelStyle}>Difficulté :</label>
        <select
          value={difficulty()}
          onChange={(e) => handleUpdateDifficulty(e.currentTarget.value as 'easy' | 'medium' | 'hard')}
          style={{ ...fieldStyle, cursor: 'pointer' }}
        >
          <option value="easy">★☆☆ Facile</option>
          <option value="medium">★★☆ Moyen</option>
          <option value="hard">★★★ Difficile</option>
        </select>
      </div>
    </div>
  );
};

export default CombatNodeEditor;
