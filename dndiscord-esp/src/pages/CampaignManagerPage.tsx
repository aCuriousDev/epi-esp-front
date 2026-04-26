import { useNavigate, useParams } from '@solidjs/router';
import { CampaignTreeCanvas, CampaignTreeCanvasRef } from '../components/campaign-tree-canvas/CampagnTreeCanvas';
import { CampaignNode } from '../components/campaign-tree-canvas/nodes/CampaignNode';
import { CombatNode } from '../components/campaign-tree-canvas/nodes/CombatNode';
import { ChoicesNode } from '../components/campaign-tree-canvas/nodes/ChoicesNode';
import { MapNode } from '../components/campaign-tree-canvas/nodes/MapNode';
import { Component, createSignal, createEffect, Show, For, onMount, onCleanup } from 'solid-js';
import { Book, CheckCircle, Edit, GripHorizontal, Loader2, Map as MapIcon, Save, Sword, XCircle } from 'lucide-solid';
import { CampaignService, mapCampaignResponse } from '@/services/campaign.service';
import { Campaign } from '@/types/campaign';
import { getApiUrl } from '@/services/config';
import { AuthService } from '@/services/auth.service';
import { StartNode } from '@/components/campaign-tree-canvas/nodes/StartNode';
import ChoicesNodeEditor from '@/components/campaign-tree-canvas/ChoicesNodeEditor';
import { SceneNode } from '@/components/campaign-tree-canvas/nodes/SceneNode';
import SceneNodeEditor from '@/components/campaign-tree-canvas/SceneNodeEditor';
import CombatNodeEditor from '@/components/campaign-tree-canvas/CombatNodeEditor';
import MapNodeEditor from '@/components/campaign-tree-canvas/MapNodeEditor';
import ExportImportModal from '@/components/campaign-tree-canvas/modals/ExportImportModal';
import PageMeta from '../layouts/PageMeta';
import { t } from '../i18n';

const CampaignManager: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  // NOTE: bloc labels (Scène, Choix, Combat, Carte) are used as node-type
  // display names throughout the deep canvas editor — flagged for Task 25.
  const blocs = [
    {
      label: t('campaignManager.block.scene'), icon: <Book class="w-5 h-5" />, blockName: 'scene',
      bgColor: '#1c1333', borderColor: '#7c3aed', accentColor: '#a78bfa',
    },
    {
      label: t('campaignManager.block.choices'), icon: <GripHorizontal class="w-5 h-5" />, blockName: 'choices',
      bgColor: '#0a2a24', borderColor: '#059669', accentColor: '#34d399',
    },
    {
      label: t('campaignManager.block.combat'), icon: <Sword class="w-5 h-5" />, blockName: 'combat',
      bgColor: '#2a0909', borderColor: '#dc2626', accentColor: '#f87171',
    },
    {
      label: t('campaignManager.block.map'), icon: <MapIcon class="w-5 h-5" />, blockName: 'map',
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

  // ─── Mount: load campaign + migration auto des maps localStorage ────────────
  onMount(async () => {
    try {
      setLoading(true);
      const response = await CampaignService.getCampaign(params.id);
      const mappedCampaign = mapCampaignResponse(response);
      setCampaign(mappedCampaign);
      handleImport(mappedCampaign.campaignTreeDefinition ?? undefined);

      // Phase 4 — migration idempotente des nœuds carte ayant un selectedMap
      // au format localStorage ("map_timestamp_..."). On les upload en DB et on
      // remplace l'ID dans le tree. Si au moins un nœud est mis à jour, on
      // sauvegarde silencieusement le tree mis à jour.
      await migrateMapNodes(params.id);
    } catch (err: any) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  });

  /**
   * Parcourt les nœuds de type 'map' du canvas.
   * Pour chaque nœud dont selectedMap est un ID localStorage (/^map_/),
   * charge le blob depuis localStorage, l'uploade dans la campagne en DB,
   * et remplace l'ID par l'UUID retourné.
   * Idempotent : si l'ID est déjà un UUID, le nœud est ignoré.
   * Si un nœud référence une map introuvable en localStorage, un warning
   * est affiché dans la console (la map était déjà supprimée).
   */
  const migrateMapNodes = async (campaignId: string): Promise<void> => {
    const cvs = canvasRef()?.getCanvas();
    if (!cvs) return;

    const token = AuthService.getToken();
    if (!token) return;

    // Collecter les nœuds carte avec un ID legacy (sync — draw2d est synchrone)
    const toMigrate: Array<{ fig: any; ud: any }> = [];
    (cvs as any).getFigures().each((_i: number, fig: any) => {
      const ud = fig.getUserData?.();
      if (!ud || ud.type !== 'map') return;
      if (ud.selectedMap && /^map_/.test(String(ud.selectedMap))) {
        toMigrate.push({ fig, ud });
      }
    });

    if (toMigrate.length === 0) return;

    let migrated = 0;
    for (const { fig, ud } of toMigrate) {
      const localKey = `dndiscord_maps_${ud.selectedMap}`;
      const localData = localStorage.getItem(localKey);

      if (!localData) {
        console.warn(`[CampaignManager] migration: map "${ud.selectedMap}" not found in localStorage — node "${ud.id}" left unchanged`);
        continue;
      }

      try {
        const parsedMap = JSON.parse(localData) as { name?: string };
        const res = await fetch(`${getApiUrl()}/api/campaigns/${campaignId}/maps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: parsedMap.name ?? 'Carte', data: localData }),
        });

        if (!res.ok) {
          console.warn(`[CampaignManager] migration: upload failed for "${ud.selectedMap}" (HTTP ${res.status})`);
          continue;
        }

        const created = await res.json() as { id: string };
        fig.setUserData({ ...ud, selectedMap: created.id });
        migrated++;
      } catch (err) {
        console.warn(`[CampaignManager] migration: unexpected error for "${ud.selectedMap}":`, err);
      }
    }

    if (migrated === 0) return;

    // Sauvegarder silencieusement le tree avec les nouveaux UUIDs
    try {
      const canvas = canvasRef();
      if (!canvas) return;
      await CampaignService.editCampaignManager(campaignId, {
        campaignTreeDefinition: canvas.exportData() ?? '',
      });
      const treeData = buildSessionTreeFormat();
      if (treeData) {
        localStorage.setItem(`dnd-campaign-tree-${campaignId}`, JSON.stringify(treeData));
      }
      showToast(`${migrated} carte${migrated > 1 ? 's' : ''} migrée${migrated > 1 ? 's' : ''} vers la base de données`, 'success');
    } catch (err) {
      console.warn('[CampaignManager] migration: auto-save after migration failed:', err);
    }
  };

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
          data: { title: 'New scene', text: '' },
        });
      } else if (type === 'choices') {
        newNode = canvas.addNode({
          type: 'choices', x: baseX, y: baseY,
          data: { title: 'New choice', text: '', choices: ['Choice 1', 'Choice 2'] },
        });
      } else if (type === 'combat') {
        newNode = canvas.addNode({
          type: 'combat', x: baseX, y: baseY,
          data: { title: 'New combat', difficulty: 'medium', villains: [] },
        });
      } else if (type === 'map') {
        newNode = canvas.addNode({
          type: 'map', x: baseX, y: baseY,
          data: { title: 'New map' },
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
  // Editors call node methods directly — this callback is an optional hook
  // for additional actions if needed.
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

    // Refuser une sauvegarde avec un canvas vide — évite d'écraser la
    // définition serveur si le canvas n'est pas encore initialisé.
    const exported = canvas.exportData();
    if (!exported) {
      showToast('Impossible de sauvegarder : le canvas n\'est pas prêt.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await CampaignService.editCampaignManager(campaign()!.id, {
        campaignTreeDefinition: exported,
      });
      const mappedCampaign = mapCampaignResponse(response);
      setCampaign(mappedCampaign);

      // Also persist the session-player format locally for session + replay views
      const treeData = buildSessionTreeFormat();
      if (treeData) {
        localStorage.setItem(`dnd-campaign-tree-${params.id}`, JSON.stringify(treeData));
      }

      showToast(t('campaignManager.toast.saved'), 'success');
    } catch (err: any) {
      console.error('Failed to save campaign:', err);
      showToast(t('campaignManager.toast.saveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div class="w-screen h-screen flex flex-col text-[var(--text-mid,#d4d4d4)]" style={{
      'font-family': 'system-ui, -apple-system, sans-serif',
    }}>
      <PageMeta title={t('page.campaignManager.title')} />

      {/* Toolbar — pl-16 sm:pl-20 pour laisser la place au bouton retour du GameShell */}
      <div class="relative z-20 flex items-center justify-between pl-28 pr-6 py-4 border-b border-white/10 bg-game-dark/70 backdrop-blur-md">
        <div class="flex flex-row gap-2">
          <button
            onClick={() => setModalOpen(true)}
            class="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all shadow-lg shadow-gray-500/20"
          >
            <Edit class="w-4 h-4" />
            <span class="hidden sm:inline">{t('campaignManager.toolbar.exportImport')}</span>
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
              <Show when={isSaving()} fallback={t('campaignManager.toolbar.save')}>{t('campaignManager.toolbar.saving')}</Show>
            </span>
          </button>
        </div>
      </div>

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
              {t('campaignManager.sidebar.nodeDetails')}
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
            <h3 class="font-display text-xl text-white tracking-wide mb-4">{t('campaignManager.sidebar.availableBlocks')}</h3>
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
                    {/* Coloured icon */}
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
          <button onClick={() => setToast(null)} class="ml-1 text-white/60 hover:text-white transition-colors" aria-label={t('common.close')}>✕</button>
        </div>
      </Show>
    </div>
  );
};

export default CampaignManager;
