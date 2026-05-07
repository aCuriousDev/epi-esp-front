import { Component, createSignal, For, Show } from 'solid-js';
import { CombatNode, CombatNodeData, type VillainPlacement } from './nodes/CombatNode';
import { CampaignNode } from './nodes/CampaignNode';
import { HARDCODED_MAPS, HARDCODED_VILLAINS } from './constants/gameData';

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
  const [villains, setVillains] = createSignal<VillainPlacement[]>(data.villains ?? []);

  const persistVillains = (next: VillainPlacement[]) => {
    setVillains(next);
    props.node.updateVillains(next);
    props.handleUpdateNode(props.node);
  };

  const handleAddVillain = () => {
    const first = HARDCODED_VILLAINS[0];
    if (!first) return;
    persistVillains([
      ...villains(),
      { characterId: first.id, position: { x: 0, y: 0 } },
    ]);
  };

  const handleRemoveVillain = (index: number) => {
    persistVillains(villains().filter((_, i) => i !== index));
  };

  const handleVillainChange = (
    index: number,
    field: "characterId" | "x" | "y",
    value: string,
  ) => {
    const v = [...villains()];
    const row = v[index];
    if (!row) return;
    if (field === "characterId") {
      v[index] = { ...row, characterId: value };
    } else {
      const n = parseInt(value, 10);
      v[index] = {
        ...row,
        position: {
          ...row.position,
          [field]: Number.isNaN(n) ? 0 : n,
        },
      };
    }
    persistVillains(v);
  };

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
        <label style={labelStyle}>🏷️ Block title:</label>
        <input
          type="text"
          value={title()}
          onInput={(e) => handleUpdateTitle(e.currentTarget.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onBlur={() => props.handleUpdateNode(props.node)}
          placeholder="Name shown on canvas..."
          style={fieldStyle}
        />
      </div>

      {/* Carte */}
      <div style={{ 'margin-bottom': '1.25rem' }}>
        <label style={labelStyle}>🗺️ Map:</label>
        <select
          value={selectedMap()}
          onChange={(e) => handleUpdateMap(e.currentTarget.value)}
          style={{ ...fieldStyle, cursor: 'pointer' }}
        >
          <option value="">— Select a map —</option>
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
            Dimensions: {currentMap()!.dimension.width} × {currentMap()!.dimension.height} tiles
          </p>
        </Show>
      </div>

      {/* Difficulté */}
      <div style={{ 'margin-bottom': '1.5rem' }}>
        <label style={labelStyle}>Difficulty:</label>
        <select
          value={difficulty()}
          onChange={(e) => handleUpdateDifficulty(e.currentTarget.value as 'easy' | 'medium' | 'hard')}
          style={{ ...fieldStyle, cursor: 'pointer' }}
        >
          <option value="easy">★☆☆ Easy</option>
          <option value="medium">★★☆ Medium</option>
          <option value="hard">★★★ Hard</option>
        </select>
      </div>

      {/* Villains */}
      <div>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '0.5rem' }}>
          <label style={{ 'font-weight': '500', 'font-size': '0.9rem' }}>⚔️ Enemies:</label>
          <button
            onClick={handleAddVillain}
            style={{ padding: '0.25rem 0.5rem', background: '#8b0000', border: 'none', 'border-radius': '3px', color: 'white', cursor: 'pointer', 'font-size': '0.85rem' }}
          >
            + Add
          </button>
        </div>

        <Show
          when={villains().length > 0}
          fallback={<p style={{ color: '#888', 'font-size': '0.9rem', 'font-style': 'italic' }}>No enemies defined</p>}
        >
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
            <For each={villains()}>
              {(villain, index) => (
                <div style={{ background: '#1a1a2a', border: '1px solid #3c3c3f', 'border-radius': '6px', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '0.5rem' }}>
                    <span style={{ 'font-size': '0.8rem', color: '#888' }}>Enemy {index() + 1}</span>
                    <button
                      onClick={() => handleRemoveVillain(index())}
                      style={{ padding: '0.2rem 0.4rem', background: '#5a1d1d', border: 'none', 'border-radius': '3px', color: '#f48771', cursor: 'pointer', 'font-size': '0.8rem' }}
                    >✕</button>
                  </div>

                  {/* Personnage */}
                  <div style={{ 'margin-bottom': '0.5rem' }}>
                    <label style={{ 'font-size': '0.8rem', color: '#aaa', display: 'block', 'margin-bottom': '0.25rem' }}>Character:</label>
                    <select
                      value={villain.characterId}
                      onChange={(e) => handleVillainChange(index(), 'characterId', e.currentTarget.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{ ...fieldStyle, 'font-size': '0.85rem', cursor: 'pointer' }}
                    >
                      <For each={HARDCODED_VILLAINS}>
                        {(char) => <option value={char.id}>{char.label}</option>}
                      </For>
                    </select>
                  </div>

                  {/* Position */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ 'font-size': '0.8rem', color: '#aaa', display: 'block', 'margin-bottom': '0.25rem' }}>Position X:</label>
                      <input
                        type="number"
                        value={villain.position.x}
                        min={0}
                        max={currentMap()?.dimension.width ?? 99}
                        onInput={(e) => handleVillainChange(index(), 'x', e.currentTarget.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{ ...fieldStyle, 'font-size': '0.85rem' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ 'font-size': '0.8rem', color: '#aaa', display: 'block', 'margin-bottom': '0.25rem' }}>Position Y:</label>
                      <input
                        type="number"
                        value={villain.position.y}
                        min={0}
                        max={currentMap()?.dimension.height ?? 99}
                        onInput={(e) => handleVillainChange(index(), 'y', e.currentTarget.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{ ...fieldStyle, 'font-size': '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default CombatNodeEditor;
