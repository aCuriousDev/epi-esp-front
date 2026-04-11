import { useNavigate } from '@solidjs/router';
import { CampaignTreeCanvas, CampaignTreeCanvasRef } from '../components/campaign-tree-canvas/CampagnTreeCanvas';
import { CampaignNode } from '../components/campaign-tree-canvas/nodes/CampaignNode';
import { CombatNode, CombatNodeData } from '../components/campaign-tree-canvas/nodes/CombatNode';
import { StoryNode, StoryNodeData } from '../components/campaign-tree-canvas/nodes/StoryNode';
import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { ArrowLeft, Book, Map, Plus, Save, Sword } from 'lucide-solid';
import ButtonMenu from '@/components/common/ButtonMenu';

const CampaignManager: Component = () => {
  // Canvas reference
  const [canvasRef, setCanvasRef] = createSignal<CampaignTreeCanvasRef | undefined>();

  // Selected node
  const [selectedNode, setSelectedNode] = createSignal<CampaignNode | null>(null);
  const [nodeType, setNodeType] = createSignal<string>('');

  // Story node data
  const [storyText, setStoryText] = createSignal<string>('');
  const [storyChoices, setStoryChoices] = createSignal<string[]>([]);

  // Combat node data
  const [combatEnemies, setCombatEnemies] = createSignal<string[]>([]);
  const [combatDifficulty, setCombatDifficulty] = createSignal<'easy' | 'medium' | 'hard'>('medium');


  //Existing Node
  const [defaultNodes,setDefaultNodes] = createSignal<string[]>(['Histoire','Combat'])

  // Node type selector
  const navigate = useNavigate();

  /**
   * Update form when node is selected
   */
  createEffect(() => {
    const node = selectedNode();
    if (!node) {
      setNodeType('');
      return;
    }

    const data = node.getData();
    setNodeType(data.type);

    // Load data based on node type
    if (data.type === 'story') {
      const storyData = data as StoryNodeData;
      setStoryText(storyData.text || '');
      setStoryChoices(storyData.choices || []);
    } else if (data.type === 'combat') {
      const combatData = data as CombatNodeData;
      setCombatEnemies(combatData.enemies || []);
      setCombatDifficulty(combatData.difficulty || 'medium');
    }
  });

  /**
   * Handle node selection
   */
  const handleNodeSelect = (node: CampaignNode | null) => {
    setSelectedNode(node);
  };

  /**
   * Handle connection creation
   */
  const handleConnectionCreate = (connection: any) => {
    console.log('Connection created:', {
      source: connection.getSource().getParent().getId(),
      target: connection.getTarget().getParent().getId()
    });
  };

  /**
   * Add a new node
   */
  const handleAddNode = (type:string) => {
    const canvas = canvasRef();
    if (!canvas) return;

    // const type = selectedNodeType();

    try {
      if (type === 'story') {
        canvas.addNode({
          type: 'story',
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
          data: {
            text: 'Nouvelle scène...',
            choices: []
          }
        });
      } else if (type === 'combat') {
        canvas.addNode({
          type: 'combat',
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
          data: {
            enemies: [],
            difficulty: 'medium'
          }
        });
      }
    } catch (error) {
      console.error('Error adding node:', error);
      alert('Erreur lors de l\'ajout du nœud');
    }
  };

  /**
   * Update the selected node
   */
  const handleUpdateNode = () => {
    const node = selectedNode();
    if (!node) return;

    const type = nodeType();

    if (type === 'story' && node instanceof StoryNode) {
      node.updateText(storyText());
      node.updateChoices(storyChoices());
    } else if (type === 'combat' && node instanceof CombatNode) {
      node.updateEnemies(combatEnemies());
      node.updateDifficulty(combatDifficulty());
    }
  };

  /**
   * Story Node: Add choice
   */
  const handleAddChoice = () => {
    setStoryChoices([...storyChoices(), 'Nouveau choix']);
  };

  /**
   * Story Node: Update choice
   */
  const handleUpdateChoice = (index: number, value: string) => {
    const choices = [...storyChoices()];
    choices[index] = value;
    setStoryChoices(choices);
  };

  /**
   * Story Node: Remove choice
   */
  const handleRemoveChoice = (index: number) => {
    setStoryChoices(storyChoices().filter((_, i) => i !== index));
  };

  /**
   * Combat Node: Add enemy
   */
  const handleAddEnemy = () => {
    setCombatEnemies([...combatEnemies(), 'Nouvel ennemi']);
  };

  /**
   * Combat Node: Update enemy
   */
  const handleUpdateEnemy = (index: number, value: string) => {
    const enemies = [...combatEnemies()];
    enemies[index] = value;
    setCombatEnemies(enemies);
  };

  /**
   * Combat Node: Remove enemy
   */
  const handleRemoveEnemy = (index: number) => {
    setCombatEnemies(combatEnemies().filter((_, i) => i !== index));
  };

  /**
   * Save campaign
   */
  const handleSaveCampaign = () => {
    const canvas = canvasRef();
    if (!canvas) return;

    const data = canvas.exportData();
    console.log('Campaign data:', data);

    localStorage.setItem('dnd-campaign', JSON.stringify(data));
    alert('Campagne sauvegardée ! ✓');
  };

  /**
   * Load campaign
   */
  const handleLoadCampaign = () => {
    const canvas = canvasRef();
    const saved = localStorage.getItem('dnd-campaign');

    if (saved && canvas) {
      try {
        canvas.importData(JSON.parse(saved));
        alert('Campagne chargée ! ✓');
      } catch (error) {
        console.error('Error loading campaign:', error);
        alert('Erreur lors du chargement');
      }
    } else {
      alert('Aucune campagne sauvegardée trouvée');
    }
  };

  return (
    <div class='bg-brand-gradient' style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      'flex-direction': 'column',
      background: 'linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%)',
      color: 'var(--text-high)',
      'font-family': 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header class="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/70 backdrop-blur-md">
              <button
                onClick={() => navigate("/campaigns")}
                class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft class="w-5 h-5" />
                <span class="hidden sm:inline">Retour au menu</span>
              </button>
      
              <h1 class="font-display text-xl text-white tracking-wide">Campagnes</h1>
      
              <button
                onClick={() => navigate("/campaigns/create")}
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20"
              >
                <Save class="w-4 h-4" />
                <span class="hidden sm:inline">Sauvegarder</span>
              </button>
      </header>
        

      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* Sidebar for selected node details */}
        <aside
         style={{
          background:'var(--ink-900)',
          width: '320px',
          'border-right': '1px solid var(--ink-600)',
          padding: '1.5rem',
          'overflow-y': 'auto',
        }}>
          <Show when={selectedNode()}>
            <h2 style={{
              'margin-top': 0,
              'font-size': '1.25rem',
              'margin-bottom': '1.5rem'
            }}>
              Détails du nœud
            </h2>


            {/* Story Node Editor */}
            <Show when={nodeType() === 'story'}>
              <div>
                <div style={{ 'margin-bottom': '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    'margin-bottom': '0.5rem',
                    'font-weight': '500',
                    'font-size': '0.9rem'
                  }}>
                    Texte narratif :
                  </label>
                  <textarea
                    value={storyText()}
                    onInput={(e) => setStoryText(e.currentTarget.value)}
                    onBlur={handleUpdateNode}
                    placeholder="Décrivez la scène..."
                    style={{
                      width: '100%',
                      'min-height': '120px',
                      background: 'var(--ink-700)',
                      border: '1px solid var(--ink-500)',
                      'border-radius': '4px',
                      color: 'var(--text-high)',
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
                        background: 'var(--arcindigo-500)',
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

                  <Show when={storyChoices().length > 0} fallback={
                    <p style={{
                      color: 'var(--text-low)',
                      'font-size': '0.9rem',
                      'font-style': 'italic'
                    }}>
                      Aucun choix défini
                    </p>
                  }>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
                      <For each={storyChoices()}>
                        {(choice, index) => (
                          <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            'align-items': 'center'
                          }}>
                            <span style={{
                              'min-width': '24px',
                              color: 'var(--text-low)',
                              'font-weight': '500'
                            }}>
                              {index() + 1}.
                            </span>
                            <input
                              type="text"
                              value={choice}
                              onInput={(e) => handleUpdateChoice(index(), e.currentTarget.value)}
                              onBlur={handleUpdateNode}
                              style={{
                                flex: 1,
                                background: 'var(--ink-700)',
                                border: '1px solid var(--ink-500)',
                                'border-radius': '4px',
                                color: 'var(--text-high)',
                                padding: '0.5rem',
                                'font-size': '0.9rem'
                              }}
                            />
                            <button
                              onClick={() => {
                                handleRemoveChoice(index());
                                handleUpdateNode();
                              }}
                              style={{
                                padding: '0.5rem',
                                background: 'rgba(239,68,68,0.22)',
                                border: 'none',
                                'border-radius': '3px',
                                color: 'var(--status-danger)',
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
            </Show>

            {/* Combat Node Editor */}
            <Show when={nodeType() === 'combat'}>
              <div>
                <div style={{ 'margin-bottom': '1.5rem' }}>
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
                      Ennemis :
                    </label>
                    <button
                      onClick={handleAddEnemy}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: 'var(--status-danger)',
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

                  <Show when={combatEnemies().length > 0} fallback={
                    <p style={{
                      color: 'var(--text-low)',
                      'font-size': '0.9rem',
                      'font-style': 'italic'
                    }}>
                      Aucun ennemi défini
                    </p>
                  }>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
                      <For each={combatEnemies()}>
                        {(enemy, index) => (
                          <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            'align-items': 'center'
                          }}>
                            <input
                              type="text"
                              value={enemy}
                              onInput={(e) => handleUpdateEnemy(index(), e.currentTarget.value)}
                              onBlur={handleUpdateNode}
                              placeholder="Nom de l'ennemi"
                              style={{
                                flex: 1,
                                background: 'var(--ink-700)',
                                border: '1px solid var(--ink-500)',
                                'border-radius': '4px',
                                color: 'var(--text-high)',
                                padding: '0.5rem',
                                'font-size': '0.9rem'
                              }}
                            />
                            <button
                              onClick={() => {
                                handleRemoveEnemy(index());
                                handleUpdateNode();
                              }}
                              style={{
                                padding: '0.5rem',
                                background: 'rgba(239,68,68,0.22)',
                                border: 'none',
                                'border-radius': '3px',
                                color: 'var(--status-danger)',
                                cursor: 'pointer',
                                'line-height': 1
                              }}
                              title="Supprimer cet ennemi"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    'margin-bottom': '0.5rem',
                    'font-weight': '500',
                    'font-size': '0.9rem'
                  }}>
                    Difficulté :
                  </label>
                  <select
                    value={combatDifficulty()}
                    onChange={(e) => {
                      setCombatDifficulty(e.currentTarget.value as 'easy' | 'medium' | 'hard');
                      handleUpdateNode();
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'var(--ink-700)',
                      border: '1px solid var(--ink-500)',
                      'border-radius': '4px',
                      color: 'var(--text-high)',
                      'font-size': '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="easy">★☆☆ Facile</option>
                    <option value="medium">★★☆ Moyen</option>
                    <option value="hard">★★★ Difficile</option>
                  </select>
                </div>
              </div>
            </Show>
          </Show>
          <Show when={!selectedNode()}>
            <h3 class='font-display text-xl text-white tracking-wide mb-2'>Bloc disponibles</h3>
            <For each={[{label:"Histoire",icon:<Book/>,blockName:'story'},{label:"Combat",icon:<Sword/>,blockName:'combat'},{label:"Map",icon:<Map/>}]} fallback={<div>Loading...</div>}>
              {(item) => 
              <ButtonMenu
              label={item.label}
              icon={item.icon}
              className='m-4'
              onClick={()=>{item.blockName ? handleAddNode(item.blockName): undefined}}
              />}
            </For>
          </Show>
        </aside>

        {/* Canvas */}
        <main style={{ flex: 1, position: 'relative' }}>
          <CampaignTreeCanvas
            ref={setCanvasRef}
            onNodeSelect={handleNodeSelect}
            onConnectionCreate={handleConnectionCreate}
          />
        </main>
      </div>
    </div>
  );
};

export default CampaignManager;