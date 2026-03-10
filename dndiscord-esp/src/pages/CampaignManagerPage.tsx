import { useNavigate, useParams } from '@solidjs/router';
import { CampaignTreeCanvas, CampaignTreeCanvasRef } from '../components/campaign-tree-canvas/CampagnTreeCanvas';
import { CampaignNode } from '../components/campaign-tree-canvas/nodes/CampaignNode';
import { CombatNode } from '../components/campaign-tree-canvas/nodes/CombatNode';
import { ChoicesNode } from '../components/campaign-tree-canvas/nodes/ChoicesNode';
import { Component, createSignal, createEffect, Show, For, onMount } from 'solid-js';
import { ArrowLeft, Book, Edit, GripHorizontal, Map as MapIcon, Plus, Save, Sword } from 'lucide-solid';
import ButtonMenu from '@/components/common/ButtonMenu';
import { CampaignService, mapCampaignResponse } from '@/services/campaign.service';
import { Campaign } from '@/types/campaign';
import { StartNode } from '@/components/campaign-tree-canvas/nodes/StartNode';
import ChoicesNodeEditor from '@/components/campaign-tree-canvas/ChoicesNodeEditor';
import { SceneNode, SceneNodeData } from '@/components/campaign-tree-canvas/nodes/SceneNode';
import SceneNodeEditor from '@/components/campaign-tree-canvas/SceneNodeEditor';
import ExportImportModal from '@/components/campaign-tree-canvas/modals/ExportImportModal';

const CampaignManager: Component = () => {
  const params = useParams();
  const blocs = [
    {label:"Scene",icon:<Book/>,blockName:'scene'},
    {label:"Choix",icon:<GripHorizontal/>,blockName:'choices'},
    {label:"Combat",icon:<Sword/>,blockName:'combat'}]
    // {label:"Map",icon:<MapIcon/>}]
  // Canvas reference
  const [canvasRef, setCanvasRef] = createSignal<CampaignTreeCanvasRef | undefined>();
  const [loading, setLoading] = createSignal(true);
  const [campaign,setCampaign] = createSignal<Campaign>();
  

  // Selected node
  const [selectedNode, setSelectedNode] = createSignal<CampaignNode | null>(null);
  const [nodeType, setNodeType] = createSignal<string>('');

  // Choices node data
  const [storyText, setChoicesText] = createSignal<string>('');
  const [storyChoices, setChoicesChoices] = createSignal<string[]>([]);

  // Combat node data
  const [combatEnemies, setCombatEnemies] = createSignal<string[]>([]);
  const [combatDifficulty, setCombatDifficulty] = createSignal<'easy' | 'medium' | 'hard'>('medium');

  // Node type selector
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = createSignal(false);

  const handleExport = async () => {
    const data = await canvasRef()?.exportData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign()?.title ?? 'campaign'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (json: string|undefined) => {
    canvasRef()?.importData(json);
  };

  onMount(async ()=>{
     try {
          setLoading(true);

          const response = await CampaignService.getCampaign(params.id);
          const mappedCampaign = mapCampaignResponse(response);
          setCampaign(mappedCampaign);
          handleImport(mappedCampaign.campaignTreeDefinition??undefined)
        } catch (err: any) {
          console.error("Failed to load campaign:", err);
        } finally {
          setLoading(false);
        }
  })

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
    if (data.type === 'combat') {
      const combatData = data as any;
      setCombatEnemies(combatData.enemies || []);
      setCombatDifficulty(combatData.difficulty || 'medium');
    }
  });

  const handleDel = ()=>{

  }

  /**
   * Handle node selection
   */
  const handleNodeSelect = (node: CampaignNode | null) => {
    if (node instanceof StartNode) {
      setSelectedNode(null); // Pas de panel pour le StartNode
      return;
    }
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

    // Calculer le centre visible du canvas pour positionner le nouveau bloc
    const viewportCenter = canvas.getViewportCenter
      ? canvas.getViewportCenter()
      : null;

    const baseX = viewportCenter?.x ?? Math.random() * 400 + 100;
    const baseY = viewportCenter?.y ?? Math.random() * 300 + 100;

    try {
      let newNode: CampaignNode | undefined;
      if (type === 'choices') {
        newNode = canvas.addNode({
          type: 'choices',
          x: baseX,
          y: baseY,
          data: {
            text: 'Nouvelle scène...',
            choices: ["Choix 1","Choix 2"]
          }
        });
      } else if (type === 'combat') {
        newNode = canvas.addNode({
          type: 'combat',
          x: baseX,
          y: baseY,
          data: {
            enemies: [],
            difficulty: 'medium'
          }
        });
      }else if (type === 'scene') {
        newNode = canvas.addNode({
          type: 'scene',
          x: baseX,
          y: baseY,
          data: {
            title: "Entrez un titre de bloc",
            text: "Entrez un texte à afficher"
          }
        });
      }

      if (newNode && canvas.gotoFigure) {
        canvas.gotoFigure(newNode);
      }
    } catch (error) {
      console.error('Error adding node:', error);
      alert('Erreur lors de l\'ajout du nœud');
    }
  };

  /**
   * Update the selected node
   */
  const handleUpdateNode = (node?: CampaignNode) => {
    const currentSelected = selectedNode();
    if (!currentSelected) return;

    const type = nodeType();

    if (type === 'choices' && currentSelected instanceof ChoicesNode && node instanceof ChoicesNode) {
      currentSelected.updateText(node.getData()?.text);
      currentSelected.updateChoices(node.getData()?.choices);
    } else if (type === 'combat' && currentSelected instanceof CombatNode) {
      currentSelected.updateEnemies(combatEnemies());
      currentSelected.updateDifficulty(combatDifficulty());
    } else if (type === 'scene' && currentSelected instanceof SceneNode && node instanceof SceneNode) {
      currentSelected.updateTitle(node.getData()?.title);
      currentSelected.updateText(node.getData()?.text);
    }
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
  const handleSaveCampaign = async () => {
    const canvas = canvasRef();
    if (!canvas) return;

    try {
        const response = await CampaignService.editCampaignManager(campaign()!.id,{
          campaignTreeDefinition :  canvas.exportData() ?? ""
        });
        var mappedCampaign = mapCampaignResponse(response);
        setCampaign(mappedCampaign);

        alert("Save !")
      } catch (err: any) {
        console.error("Failed to create campaign:", err);
      }
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
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
      color: '#d4d4d4',
      'font-family': 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header class="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/70 backdrop-blur-md">
              <button
                onClick={() => navigate(`/campaigns/${campaign()?.id}`)}
                class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft class="w-5 h-5" />
                <span class="hidden sm:inline">Retour au menu</span>
              </button>
      
              <h1 class="font-display text-xl text-white tracking-wide">Campagnes</h1>
      
              <div class='flex flex-row'>
                <button
                      onClick={()=>setModalOpen(true)}
                      class="mr-1 flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-white-500 hover:text-gray-100 rounded-xl transition-all shadow-lg shadow-gray-500/20"
                    >
                      <Edit class="w-4 h-4" />
                      <span class="hidden sm:inline">Export / Import</span>
                </button>
                <button
                      onClick={()=>handleSaveCampaign()}
                      class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20"
                    >
                      <Save class="w-4 h-4" />
                      <span class="hidden sm:inline">Sauvegarder</span>
                </button>
              </div>
             
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
          background:'#0f0f1a',
          width: '320px',
          'border-right': '1px solid #333',
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


            {/* Choices Node Editor */}
            <Show when={nodeType() === 'choices'}>
              <ChoicesNodeEditor node={selectedNode() as ChoicesNode} handleUpdateNode={handleUpdateNode} />
            </Show>
            {/* Scene Node Editor */}
            <Show when={nodeType() === 'scene'}>
              <SceneNodeEditor node={selectedNode() as SceneNode} handleUpdateNode={handleUpdateNode} />
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
                      ⚔️ Ennemis :
                    </label>
                    <button
                      onClick={handleAddEnemy}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#8b0000',
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
                      color: '#888',
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
                              onKeyDown={(e) => e.stopPropagation()}
                              onBlur={() => handleUpdateNode()}
                              placeholder="Nom de l'ennemi"
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
                                handleRemoveEnemy(index());
                                handleUpdateNode();
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
                      background: '#1e1e1e',
                      border: '1px solid #3c3c3f',
                      'border-radius': '4px',
                      color: '#d4d4d4',
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
            <For each={blocs} fallback={<div>Loading...</div>}>
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
        <main style={{ flex: 1, position: 'relative',overflow:'auto' }}>
          <CampaignTreeCanvas
            ref={setCanvasRef}
            onNodeSelect={handleNodeSelect}
            onConnectionCreate={handleConnectionCreate}
          />
        </main>
      </div>
      <ExportImportModal
        isOpen={modalOpen()}
        canvasRef={canvasRef}
        onClose={() => setModalOpen(false)}
        onExport={handleExport}
        onImport={handleImport}
      />
    </div>
  );
};

export default CampaignManager;