import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { SceneNode } from './nodes/SceneNode';
import { CampaignNode } from './nodes/CampaignNode';

interface SceneNodeEditorProps {
    node: SceneNode;
    handleUpdateNode : (node:CampaignNode)=>void
}

const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

const SceneNodeEditor: Component<SceneNodeEditorProps> = (props : SceneNodeEditorProps) => {
    const [text,setText] = createSignal<string>(props.node.getData().text ?? '')
    const [title,setTitle] = createSignal<string>(props.node.getData().title ?? '')

    createEffect(() => {
        // setItems(props.node.getItems());
    });

    const save = () => {
        // setItems(newItems);
        // prop
        // 
        
    }


  const handleUpdateText = (newText: string) => {
    props.node.updateText(newText)
    setText(newText);
  };
  const handleUpdateTitle = (newTitle: string) => {
    props.node.updateTitle(newTitle)
    setTitle(newTitle);
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
                    Titre du Bloc
                </label>
                <textarea
                    value={title()}
                    onInput={(e) => handleUpdateTitle(e.currentTarget.value)}
                    onKeyDown={(e) => e.stopPropagation()}
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
                    onKeyDown={(e) => e.stopPropagation()}
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
        </div>
    );
};

export default SceneNodeEditor;