import { useNavigate, useParams } from '@solidjs/router';
import { CampaignTreeCanvas, CampaignTreeCanvasRef } from '../components/campaign-tree-canvas/CampagnTreeCanvas';
import { CampaignNode } from '../components/campaign-tree-canvas/nodes/CampaignNode';
import { CombatNode } from '../components/campaign-tree-canvas/nodes/CombatNode';
import { ChoicesNode } from '../components/campaign-tree-canvas/nodes/ChoicesNode';
import { MapNode } from '../components/campaign-tree-canvas/nodes/MapNode';
import { Component, createSignal, createEffect, Show, For, onMount, onCleanup } from 'solid-js';
import { ArrowLeft, Book, CheckCircle, Edit, GripHorizontal, Loader2, Map as MapIcon, Save, Sword, XCircle } from 'lucide-solid';
import ButtonMenu from '@/components/common/ButtonMenu';
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
    { label: 'Scène',   icon: <Book />,          blockName: 'scene'   },
    { label: 'Choix',   icon: <GripHorizontal />, blockName: 'choices' },
    { label: 'Combat',  icon: <Sword />,          blockName: 'combat'  },
    { label: 'Carte',   icon: <MapIcon />,         blockName: 'map'     },
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
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign()?.title ?? 'campaign'}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
            <h3 class="font-display text-xl text-white tracking-wide mb-2">Blocs disponibles</h3>
            <For each={blocs}>
              {(item) => (
                <ButtonMenu
                  label={item.label}
                  icon={item.icon}
                  className="m-4"
                  onClick={() => handleAddNode(item.blockName)}
                />
              )}
            </For>
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
