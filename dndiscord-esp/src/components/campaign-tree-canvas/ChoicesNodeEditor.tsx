import { Component, createSignal, Index, Show } from 'solid-js';
import { ChoicesNode } from './nodes/ChoicesNode';
import { CampaignNode } from './nodes/CampaignNode';

interface ChoicesNodeEditorProps {
  node: ChoicesNode;
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

const ChoicesNodeEditor: Component<ChoicesNodeEditorProps> = (props) => {
  const initialData = props.node.getData();
  const [title, setTitle] = createSignal<string>(initialData.title ?? '');
  const [text, setText] = createSignal<string>(initialData.text ?? '');
  const [choices, setChoices] = createSignal<string[]>(initialData.choices ?? []);

  const handleUpdateTitle = (newTitle: string) => {
    setTitle(newTitle);
    props.node.updateTitle(newTitle);
  };

  const handleUpdateText = (newText: string) => setText(newText);

  const save = () => {
    props.node.updateText(text());
    props.handleUpdateNode(props.node);
  };

  const handleAddChoice = () => {
    const newChoices = [...choices(), 'Nouveau choix'];
    setChoices(newChoices);
    props.node.updateChoices(newChoices);
    props.handleUpdateNode(props.node);
  };

  const handleRemoveChoice = (index: number) => {
    const newChoices = choices().filter((_, i) => i !== index);
    setChoices(newChoices);
    props.node.updateChoices(newChoices);
    props.handleUpdateNode(props.node);
  };

  const handleUpdateChoice = (index: number, value: string) => {
    const updated = [...choices()];
    updated[index] = value;
    setChoices(updated);
  };

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

      {/* Texte narratif */}
      <div style={{ 'margin-bottom': '1.5rem' }}>
        <label style={labelStyle}>📖 Texte narratif :</label>
        <textarea
          value={text()}
          onInput={(e) => handleUpdateText(e.currentTarget.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onBlur={save}
          placeholder="Décrivez la scène..."
          style={{ ...fieldStyle, 'min-height': '100px', resize: 'vertical' }}
        />
      </div>

      {/* Choix */}
      <div>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '0.5rem' }}>
          <label style={{ 'font-weight': '500', 'font-size': '0.9rem' }}>Choix disponibles :</label>
          <button
            onClick={handleAddChoice}
            style={{ padding: '0.25rem 0.5rem', background: '#0e639c', border: 'none', 'border-radius': '3px', color: 'white', cursor: 'pointer', 'font-size': '0.85rem' }}
          >
            + Ajouter
          </button>
        </div>

        <Show
          when={choices().length > 0}
          fallback={<p style={{ color: '#888', 'font-size': '0.9rem', 'font-style': 'italic' }}>Aucun choix défini</p>}
        >
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
            <Index each={choices()}>
              {(choice, index) => (
                <div style={{ display: 'flex', gap: '0.5rem', 'align-items': 'center' }}>
                  <span style={{ 'min-width': '24px', color: '#888', 'font-weight': '500' }}>{index + 1}.</span>
                  <input
                    type="text"
                    value={choice()}
                    onInput={(e) => handleUpdateChoice(index, e.currentTarget.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onBlur={save}
                    style={{ flex: 1, ...fieldStyle }}
                  />
                  <button
                    onClick={() => handleRemoveChoice(index)}
                    style={{ padding: '0.5rem', background: '#5a1d1d', border: 'none', 'border-radius': '3px', color: '#f48771', cursor: 'pointer', 'line-height': 1 }}
                    title="Supprimer ce choix"
                  >✕</button>
                </div>
              )}
            </Index>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ChoicesNodeEditor;
