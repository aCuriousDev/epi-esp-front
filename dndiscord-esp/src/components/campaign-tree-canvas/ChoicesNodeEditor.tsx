import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { ChoicesNode } from './nodes/ChoicesNode';
import { CampaignNode } from './nodes/CampaignNode';

interface ChoicesNodeEditorProps {
    node: ChoicesNode;
    handleUpdateNode : (node:CampaignNode)=>void
}

const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

const ChoicesNodeEditor: Component<ChoicesNodeEditorProps> = (props : ChoicesNodeEditorProps) => {
    const [choices, setChoices] = createSignal<string[]>(props.node.getData().choices);
    const [text,setText] = createSignal<string>(props.node.getData().text)

    createEffect(() => {
        // setItems(props.node.getItems());
    });

    const save = () => {
        // setItems(newItems);
        // prop
        // 
        
    }
    /**
   * Choices Node: Remove choice
   */
  const handleRemoveChoice = (index: number) => {
    var newChoices = choices().filter((_, i) => i !== index);
    props.node.updateChoices(newChoices)
    setChoices(newChoices);
  };
    /*
   * Choices Node: Add choice
   */
  const handleAddChoice = () => {
     var newChoices = [...choices(), 'Nouveau choix'];
        props.node.updateChoices(newChoices)
        setChoices(newChoices);
    }

  const handleUpdateChoice = (index: number, value: string) => {
    const storyChoices = [...choices()];
    storyChoices[index] = value;
    props.node.updateChoices(storyChoices)
    setChoices(storyChoices);
  };

  const handleUpdateText = (newText: string) => {
    props.node.updateText(newText)
    setText(newText);
  };
    

    // const addItem = (type: 'narrative' | 'choice') =>
        // save([...items(), { id: generateId(), type, content: '' }]);

    // const updateContent = (id: string, content: string) =>
        // setItems(prev => prev.map(item => item.id === id ? { ...item, content } : item));

    // const saveOnBlur = () => props.node.updateItems(items());

    // const removeItem = (id: string) => save(items().filter(item => item.id !== id));

    // const moveItem = (id: string, direction: 'up' | 'down') => {
    //     const list = [...items()];
    //     const index = list.findIndex(i => i.id === id);
    //     if (direction === 'up' && index === 0) return;
    //     if (direction === 'down' && index === list.length - 1) return;
    //     const swapIndex = direction === 'up' ? index - 1 : index + 1;
    //     [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    //     save(list);
    // };

    return (
        <div>
            <div style={{ 'margin-bottom': '1.5rem' }}>
                <label style={{
                    display: 'block',
                    'margin-bottom': '0.5rem',
                    'font-weight': '500',
                    'font-size': '0.9rem'
                }}>
                    📖 Texte narratif :
                </label>
                <textarea
                    value={text()}
                    onInput={(e) => handleUpdateText(e.currentTarget.value)}
                    onBlur={()=>props.handleUpdateNode(props.node)}
                    placeholder="Décrivez la scène..."
                    style={{
                        width: '100%',
                        'min-height': '120px',
                        background: '#1e1e1e',
                        border: '1px solid #3c3c3f',
                        'border-radius': '4px',
                        color: '#d4d4d4',
                        padding: '0.75rem',
                        'font-family': 'inherit',
                        'font-size': '0.9rem',
                        resize: 'vertical'
                    }}
                />
            </div>

            <div>
                <div style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'center',
                    'margin-bottom': '0.5rem'
                }}>
                    <label style={{
                        'font-weight': '500',
                        'font-size': '0.9rem'
                    }}>
                        Choix disponibles :
                    </label>
                    <button
                        onClick={handleAddChoice}
                        style={{
                            padding: '0.25rem 0.5rem',
                            background: '#0e639c',
                            border: 'none',
                            'border-radius': '3px',
                            color: 'white',
                            cursor: 'pointer',
                            'font-size': '0.85rem'
                        }}
                    >
                        + Ajouter
                    </button>
                </div>

                <Show when={choices().length > 0} fallback={
                    <p style={{
                        color: '#888',
                        'font-size': '0.9rem',
                        'font-style': 'italic'
                    }}>
                        Aucun choix défini
                    </p>
                }>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
                        <For each={choices()}>
                            {(choice, index) => (
                                <div style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    'align-items': 'center'
                                }}>
                                    <span style={{
                                        'min-width': '24px',
                                        color: '#888',
                                        'font-weight': '500'
                                    }}>
                                        {index() + 1}.
                                    </span>
                                    <input
                                        type="text"
                                        value={choice}
                                        onInput={(e) => handleUpdateChoice(index(), e.currentTarget.value)}
                                        onBlur={()=>props.handleUpdateNode(props.node)}
                                        style={{
                                            flex: 1,
                                            background: '#1e1e1e',
                                            border: '1px solid #3c3c3f',
                                            'border-radius': '4px',
                                            color: '#d4d4d4',
                                            padding: '0.5rem',
                                            'font-size': '0.9rem'
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            handleRemoveChoice(index());
                                            props.handleUpdateNode(props.node);
                                        }}
                                        style={{
                                            padding: '0.5rem',
                                            background: '#5a1d1d',
                                            border: 'none',
                                            'border-radius': '3px',
                                            color: '#f48771',
                                            cursor: 'pointer',
                                            'line-height': 1
                                        }}
                                        title="Supprimer ce choix"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default ChoicesNodeEditor;