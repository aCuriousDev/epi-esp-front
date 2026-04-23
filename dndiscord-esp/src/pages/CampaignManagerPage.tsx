import { useNavigate, useParams } from '@solidjs/router';
import { CampaignTreeCanvas, CampaignTreeCanvasRef } from '../components/campaign-tree-canvas/CampagnTreeCanvas';
import { CampaignNode } from '../components/campaign-tree-canvas/nodes/CampaignNode';
import { CombatNode } from '../components/campaign-tree-canvas/nodes/CombatNode';
import { ChoicesNode } from '../components/campaign-tree-canvas/nodes/ChoicesNode';
import { MapNode } from '../components/campaign-tree-canvas/nodes/MapNode';
import { Component, createSignal, createEffect, Show, For, onMount, onCleanup } from 'solid-js';
import { ArrowLeft, Book, CheckCircle, Edit, GripHorizontal, Loader2, Map as MapIcon, Save, Sword, XCircle } from 'lucide-solid';
import { CampaignService, mapCampaignResponse } from '@/services/campaign.service';
import { Campaign } from '@/types/campaign';
import { StartNode } from '@/components/campaign-tree-canvas/nodes/StartNode';
import ChoicesNodeEditor from '@/components/campaign-tree-canvas/ChoicesNodeEditor';
import { SceneNode } from '@/components/campaign-tree-canvas/nodes/SceneNode';
import SceneNodeEditor from '@/components/campaign-tree-canvas/SceneNodeEditor';
import CombatNodeEditor from '@/components/campaign-tree-canvas/CombatNodeEditor';
import MapNodeEditor from '@/components/campaign-tree-canvas/MapNodeEditor';
import ExportImportModal from '@/components/campaign-tree-canvas/modals/ExportImportModal';

const CampaignManager: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  const blocs = [
    {
      label: 'Scène', icon: <Book class="w-5 h-5" />, blockName: 'scene',
      bgColor: '#1c1333', borderColor: '#7c3aed', accentColor: '#a78bfa',
    },
    {
      label: 'Choix', icon: <GripHorizontal class="w-5 h-5" />, blockName: 'choices',
      bgColor: '#0a2a24', borderColor: '#059669', accentColor: '#34d399',
    },
    {
      label: 'Combat', icon: <Sword class="w-5 h-5" />, blockName: 'combat',
      bgColor: '#2a0909', borderColor: '#dc2626', accentColor: '#f87171',
    },
    {
      label: 'Carte', icon: <MapIcon class="w-5 h-5" />, blockName: 'map',
      bgColor: '#0a1830', borderColor: '#1d4ed8', accentColor: '#60a5fa',
    },
  ];

  // Canvas reference
  const [canvasRef, setCanvasRef] = createSignal<CampaignTreeCanvasRef | undefined>();
  const [loading, setLoading] = createSignal(true);
  const [campaign, setCampaign] = createSignal<Campaign>();

  // Selected node
  const [selectedNode, setSelectedNode] = createSignal<CampaignNode | null>(null);
  const [nodeType, setNodeType] = createSignal<string>('');

  const [modalOpen, setModalOpen] = createSignal(false);

  // Save state & toast
  const [isSaving, setIsSaving] = createSignal(false);
  const [toast, setToast] = createSignal<{ message: string; type: 'success' | 'error' } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout>;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(toastTimer);
    setToast({ message, type });
    toastTimer = setTimeout(() => setToast(null), 3500);
  };

  onCleanup(() => clearTimeout(toastTimer));

  // ─── Export / Import ─────────────────────────────────────────────────────
  const handleExport = async () => {
    const data = await canvasRef()?.exportData();
    if (data == null) return;
    // Use a data: URI — blob: URLs are blocked by the Discord Activity CSP.
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    const a = document.createElement('a');
    a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    a.download = `${campaign()?.title ?? 'campaign'}.json`;
    a.click();
  };

  const handleImport = (json: string | undefined) => {
    canvasRef()?.importData(json);
  };

  // ─── Mount: load campaign ─────────────────────────────────────────────────
  onMount(async () => {
    try {
      setLoading(true);
      const response = await CampaignService.getCampaign(params.id);
      const mappedCampaign = mapCampaignResponse(response);
      setCampaign(mappedCampaign);
      handleImport(mappedCampaign.campaignTreeDefinition ?? undefined);
    } catch (err: any) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  });

  // ─── Node selection ───────────────────────────────────────────────────────
  createEffect(() => {
    const node = selectedNode();
    setNodeType(node ? node.getData().type : '');
  });

  const handleNodeSelect = (node: CampaignNode | null) => {
    if (node instanceof StartNode) {
      setSelectedNode(null);
      return;
    }
    setSelectedNode(node);
  };

  const handleConnectionCreate = (connection: any) => {
    console.log('Connection created:', {
      source: connection.getSource().getParent().getId(),
      target: connection.getTarget().getParent().getId(),
    });
  };

  // ─── Add node ─────────────────────────────────────────────────────────────
  const handleAddNode = (type: string) => {
    const canvas = canvasRef();
    if (!canvas) return;

    const viewportCenter = canvas.getViewportCenter ? canvas.getViewportCenter() : null;
    const baseX = viewportCenter?.x ?? Math.random() * 400 + 100;
    const baseY = viewportCenter?.y ?? Math.random() * 300 + 100;

    try {
      let newNode: CampaignNode | undefined;

      if (type === 'scene') {
        newNode = canvas.addNode({
          type: 'scene', x: baseX, y: baseY,
          data: { title: 'Nouvelle scène', text: '' },
        });
      } else if (type === 'choices') {
        newNode = canvas.addNode({
          type: 'choices', x: baseX, y: baseY,
          data: { title: 'Nouveau choix', text: '', choices: ['Choix 1', 'Choix 2'] },
        });
      } else if (type === 'combat') {
        newNode = canvas.addNode({
          type: 'combat', x: baseX, y: baseY,
          data: { title: 'Nouveau combat', difficulty: 'medium', villains: [] },
        });
      } else if (type === 'map') {
        newNode = canvas.addNode({
          type: 'map', x: baseX, y: baseY,
          data: { title: 'Nouvelle carte' },
        });
      }

      if (newNode && canvas.gotoFigure) {
        canvas.gotoFigure(newNode);
      }
    } catch (error) {
      console.error('Error adding node:', error);
    }
  };

  // ─── Update node (callback from editors) ─────────────────────────────────
  // Les éditeurs appellent directement les méthodes du node — ce callback
  // est un hook optionnel pour des actions supplémentaires si besoin.
  const handleUpdateNode = (_node?: CampaignNode) => {};

  // ─── Build session tree format ────────────────────────────────────────────
  // Converts the live draw2d canvas state into the {nodes, connections} format
  // consumed by the session player and replay view.
  const buildSessionTreeFormat = () => {
    const cvs = canvasRef()?.getCanvas();
    if (!cvs) return null;

    const figIdToData: Record<string, any> = {};
    (cvs as any).getFigures().each((_i: number, fig: any) => {
      const ud = fig.getUserData?.();
      if (ud?.id) figIdToData[fig.getId()] = ud;
    });

    const nodes: any[] = [];
    for (const [figId, userData] of Object.entries(figIdToData)) {
      const fig = (cvs as any).getFigure(figId);
      nodes.push({
        type: userData.type,
        x: fig?.getAbsoluteX?.() ?? 0,
        y: fig?.getAbsoluteY?.() ?? 0,
        data: userData,
      });
    }

    const connections: any[] = [];
    (cvs as any).getLines().each((_i: number, conn: any) => {
      const srcPort = conn.getSource?.();
      const tgtPort = conn.getTarget?.();
      if (!srcPort || !tgtPort) return;
      const srcData = figIdToData[srcPort.getParent?.()?.getId?.()];
      const tgtData = figIdToData[tgtPort.getParent?.()?.getId?.()];
      if (srcData?.id && tgtData?.id) {
        connections.push({
          source: { node: srcData.id, port: srcPort.getName?.() ?? 'output' },
          target: { node: tgtData.id, port: tgtPort.getName?.() ?? 'input' },
        });
      }
    });

    return { nodes, connections };
  };

  // ─── Save campaign ────────────────────────────────────────────────────────
  const handleSaveCampaign = async () => {
    const canvas = canvasRef();
    if (!canvas || isSaving()) return;

    setIsSaving(true);
    try {
      const response = await CampaignService.editCampaignManager(campaign()!.id, {
        campaignTreeDefinition: canvas.exportData() ?? '',
      });
      const mappedCampaign = mapCampaignResponse(response);
      setCampaign(mappedCampaign);

      // Also persist the session-player format locally for session + replay views
      const treeData = buildSessionTreeFormat();
      if (treeData) {
        localStorage.setItem(`dnd-campaign-tree-${params.id}`, JSON.stringify(treeData));
      }

      showToast('Campagne sauvegardée avec succès', 'success');
    } catch (err: any) {
      console.error('Failed to save campaign:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div class="bg-brand-gradient w-screen h-screen flex flex-col text-[var(--text-mid,#d4d4d4)]" style={{
      'font-family': 'system-ui, -apple-system, sans-serif',
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

        <div class="flex flex-row gap-2">
          <button
            onClick={() => setModalOpen(true)}
            class="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all shadow-lg shadow-gray-500/20"
          >
            <Edit class="w-4 h-4" />
            <span class="hidden sm:inline">Export / Import</span>
          </button>
          <button
            onClick={() => handleSaveCampaign()}
            disabled={isSaving()}
            class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Show when={isSaving()} fallback={<Save class="w-4 h-4" />}>
              <Loader2 class="w-4 h-4 animate-spin" />
            </Show>
            <span class="hidden sm:inline">
              <Show when={isSaving()} fallback="Sauvegarder">Sauvegarde...</Show>
            </span>
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
          background:'var(--ink-900)',
          width: '320px',
          'border-right': '1px solid var(--ink-600)',
          padding: '1.5rem',
          'overflow-y': 'auto',
        }}>
          <Show when={selectedNode()}>
            <h2 style={{ 'margin-top': 0, 'font-size': '1.25rem', 'margin-bottom': '1.5rem' }}>
              Détails du nœud
            </h2>

            <Show when={nodeType() === 'choices'}>
              <ChoicesNodeEditor node={selectedNode() as ChoicesNode} handleUpdateNode={handleUpdateNode} />
            </Show>

            <Show when={nodeType() === 'scene'}>
              <SceneNodeEditor node={selectedNode() as SceneNode} handleUpdateNode={handleUpdateNode} />
            </Show>

            <Show when={nodeType() === 'combat'}>
              <CombatNodeEditor node={selectedNode() as CombatNode} handleUpdateNode={handleUpdateNode} />
            </Show>

            <Show when={nodeType() === 'map'}>
              <MapNodeEditor node={selectedNode() as MapNode} handleUpdateNode={handleUpdateNode} />
            </Show>
          </Show>

          <Show when={!selectedNode()}>
            <h3 class="font-display text-xl text-white tracking-wide mb-4">Blocs disponibles</h3>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
              <For each={blocs}>
                {(item) => (
                  <button
                    onClick={() => handleAddNode(item.blockName)}
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      gap: '0.875rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: item.bgColor,
                      border: `2px solid ${item.borderColor}`,
                      'border-radius': '0.75rem',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'filter 0.15s, transform 0.15s',
                      'font-size': '1rem',
                      'font-weight': '600',
                      'letter-spacing': '0.01em',
                      'text-align': 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.18)')}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
                  >
                    {/* Icône colorée */}
                    <span style={{
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      width: '2.25rem',
                      height: '2.25rem',
                      background: `${item.accentColor}28`,
                      border: `1.5px solid ${item.accentColor}80`,
                      'border-radius': '0.5rem',
                      color: item.accentColor,
                      'flex-shrink': '0',
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{ 'font-size': '1.25rem', opacity: '0.5', 'line-height': 1 }}>+</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </aside>

        {/* Canvas */}
        <main style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
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

      {/* Toast notification */}
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(calc(100% + 1.5rem)); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .toast-slide-in {
          animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <Show when={toast()}>
        <div class={`toast-slide-in fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium ${
          toast()!.type === 'success' ? 'bg-emerald-600/95 shadow-emerald-900/40' : 'bg-red-600/95 shadow-red-900/40'
        }`}>
          <Show when={toast()!.type === 'success'} fallback={<XCircle class="w-4 h-4 shrink-0" />}>
            <CheckCircle class="w-4 h-4 shrink-0" />
          </Show>
          <span>{toast()!.message}</span>
          <button onClick={() => setToast(null)} class="ml-1 text-white/60 hover:text-white transition-colors" aria-label="Fermer">✕</button>
        </div>
      </Show>
    </div>
  );
};

export default CampaignManager;
