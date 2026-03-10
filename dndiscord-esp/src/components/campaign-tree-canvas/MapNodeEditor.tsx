import { Component, createSignal, For, Show } from 'solid-js';
import { MapNode, MapNodeData } from './nodes/MapNode';
import { CampaignNode } from './nodes/CampaignNode';
import { HARDCODED_MAPS } from './constants/gameData';

interface MapNodeEditorProps {
  node: MapNode;
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

const MapNodeEditor: Component<MapNodeEditorProps> = (props) => {
  const data = props.node.getData() as MapNodeData;

  const [title, setTitle] = createSignal<string>(data.title ?? '');
  const [selectedMap, setSelectedMap] = createSignal<string>(data.selectedMap ?? '');

  const handleUpdateTitle = (newTitle: string) => {
    setTitle(newTitle);
    props.node.updateTitle(newTitle);
  };

  const handleUpdateMap = (mapId: string) => {
    setSelectedMap(mapId);
    props.node.updateMap(mapId);
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
      </div>

      {/* Infos carte sélectionnée */}
      <Show when={currentMap()}>
        <div style={{ background: '#1a2a4a', border: '1px solid #2a4a8a', 'border-radius': '6px', padding: '0.75rem' }}>
          <p style={{ margin: 0, 'font-size': '0.85rem', color: '#8ab4f8', 'font-weight': '500' }}>
            📐 {currentMap()!.label}
          </p>
          <p style={{ margin: '0.25rem 0 0', 'font-size': '0.8rem', color: '#7090b0' }}>
            Dimensions : {currentMap()!.dimension.width} × {currentMap()!.dimension.height} cases
          </p>
        </div>
      </Show>
    </div>
  );
};

export default MapNodeEditor;
