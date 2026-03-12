import { onMount, onCleanup } from 'solid-js';
import draw2d from 'draw2d';
import { CampaignNode } from './nodes/CampaignNode';
import { StoryNode } from './nodes/StoryNode';
import { CombatNode } from './nodes/CombatNode';

interface CampaignTreeCanvasProps {
  onNodeSelect?: (node: CampaignNode | null) => void;
  onConnectionCreate?: (connection: draw2d.Connection) => void;
  ref?: (methods: CampaignTreeCanvasRef) => void;
}

export interface CampaignTreeCanvasRef {
  addNode: (nodeData: AddNodeData) => CampaignNode;
  exportData: () => any;
  importData: (data: any) => void;
  clearCanvas: () => void;
  getCanvas: () => draw2d.Canvas | null;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  fitToPage: () => void;
}

interface AddNodeData {
  type: 'story' | 'combat' | 'npc' | 'condition';
  x?: number;
  y?: number;
  data?: any;
}

export function CampaignTreeCanvas(props: CampaignTreeCanvasProps) {
  let canvasRef: HTMLDivElement | undefined;
  let canvas: draw2d.Canvas | null = null;
  let selectedNode: CampaignNode | null = null;
  let currentZoom: number = 1.0;

  /**
   * Créer un node en fonction du type
   */
  const createNode = (nodeData: AddNodeData): CampaignNode => {
    if (!canvas) throw new Error('Canvas not initialized');

    const x = nodeData.x || 100;
    const y = nodeData.y || 100;
    let node: CampaignNode;

    // Créer le node selon son type
    switch (nodeData.type) {
      case 'story':
        node = new StoryNode(x, y, {
          id: generateId('story'),
          type: 'story',
          text: nodeData.data?.text || 'Nouvelle scène...',
          choices: nodeData.data?.choices || [],
          ...nodeData.data
        });
        break;

      case 'combat':
        node = new CombatNode(x, y, {
          id: generateId('combat'),
          type: 'combat',
          enemies: nodeData.data?.enemies || [],
          difficulty: nodeData.data?.difficulty || 'medium',
          ...nodeData.data
        });
        break;

      // TODO: Ajouter NPCNode, ConditionNode, etc.
      default:
        throw new Error(`Unknown node type: ${nodeData.type}`);
    }

    // Ajouter le node au canvas
    canvas.add(node, node.x, node.y);
    
    return node;
  };

  /**
   * Générer un ID unique pour un node
   */
  const generateId = (type: string): string => {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Exporter les données du canvas
   */
  const exportData = () => {
    if (!canvas) return null;
    
    const writer = new draw2d.io.json.Writer();
    const canvasData = writer.marshal(canvas);
    
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      zoom: currentZoom,
      canvas: canvasData
    };
  };

  /**
   * Importer des données dans le canvas
   */
  const importData = (data: any) => {
    if (!canvas) return;
    
    // Effacer le canvas
    canvas.clear();
    
    // Restaurer le zoom si présent
    if (data.zoom) {
      currentZoom = data.zoom;
      canvas.setZoom(currentZoom);
    }
    
    // Charger les données
    const reader = new draw2d.io.json.Reader();
    reader.unmarshal(canvas, data.canvas || data);
  };

  /**
   * Effacer tout le canvas
   */
  const clearCanvas = () => {
    if (!canvas) return;
    
    // Confirmation avant d'effacer
    if (canvas.getFigures().getSize() > 0) {
      if (!confirm('Êtes-vous sûr de vouloir effacer tous les nœuds ?')) {
        return;
      }
    }
    
    canvas.clear();
    selectedNode = null;
    props.onNodeSelect?.(null);
  };

  /**
   * Zoom in
   */
  const zoomIn = () => {
    if (!canvas) return;
    currentZoom = Math.min(currentZoom + 0.1, 3.0);
    canvas.setZoom(currentZoom);
  };

  /**
   * Zoom out
   */
  const zoomOut = () => {
    if (!canvas) return;
    currentZoom = Math.max(currentZoom - 0.1, 0.3);
    canvas.setZoom(currentZoom);
  };

  /**
   * Reset zoom
   */
  const zoomReset = () => {
    if (!canvas) return;
    currentZoom = 1.0;
    canvas.setZoom(currentZoom);
  };

  /**
   * Fit to page
   */
  const fitToPage = () => {
    if (!canvas) return;
    
    const figures = canvas.getFigures();
    if (figures.getSize() === 0) return;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    figures.each((i: number, figure: any) => {
      const bounds = figure.getBoundingBox();
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.w);
      maxY = Math.max(maxY, bounds.y + bounds.h);
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    const canvasWidth = canvasRef?.clientWidth || 800;
    const canvasHeight = canvasRef?.clientHeight || 600;
    
    const zoomX = canvasWidth / width;
    const zoomY = canvasHeight / height;
    currentZoom = Math.min(zoomX, zoomY, 1.0) * 0.9; // 90% pour laisser de la marge
    
    canvas.setZoom(currentZoom);
  };

  /**
   * Initialisation du canvas
   */
  onMount(() => {
    if (!canvasRef) return;

    // Créer le canvas draw2d
    canvas = new draw2d.Canvas(canvasRef.id);
    if (canvas.paper && canvas.paper.canvas) {
        canvas.paper.canvas.style.backgroundColor = 'transparent';
      }
    // Installer les politiques
    canvas.installEditPolicy(new draw2d.policy.canvas.SnapToGridEditPolicy(20));
    canvas.installEditPolicy(new draw2d.policy.canvas.WheelZoomPolicy());
    canvas.installEditPolicy(new draw2d.policy.canvas.PanningSelectionPolicy());

    // Événement : Sélection d'un node
    canvas.on('select', (emitter: any, event: any) => {
      if (event.figure instanceof CampaignNode) {
        selectedNode = event.figure;
        props.onNodeSelect?.(event.figure);
      }
    });

    // Événement : Désélection d'un node
    canvas.on('unselect', (emitter: any, event: any) => {
      if (event.figure instanceof CampaignNode) {
        selectedNode = null;
        props.onNodeSelect?.(null);
      }
    });

    // Événement : Création d'une connexion
    canvas.on('connect', (emitter: any, event: any) => {
      const connection = event.connection;
      
      // Personnaliser l'apparence de la connexion
      connection.setColor('#888888');
      connection.setStroke(2);
      
      // Ajouter une flèche
      connection.setTargetDecorator(new draw2d.decoration.connection.ArrowDecorator());
      
      // Utiliser un routeur Manhattan (angles droits)
      connection.setRouter(new draw2d.layout.connection.ManhattanConnectionRouter());
      
      props.onConnectionCreate?.(connection);
    });


    // Exposer les méthodes via ref
    if (props.ref) {
      props.ref({
        addNode: createNode,
        exportData,
        importData,
        clearCanvas,
        getCanvas: () => canvas,
        zoomIn,
        zoomOut,
        zoomReset,
        fitToPage
      });
    }
  });

  /**
   * Nettoyage
   */
  onCleanup(() => {
    if (canvas) {
      canvas.clear();
      canvas = null;
    }
  });

  return (
    <div 
      class="campaign-tree-canvas-container" 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Canvas draw2d */}
      <div
      class='campaign-view-page'
        ref={canvasRef}
        id="campaign-tree-canvas"
         style={{
          width: '100%',
          height: '100%',
          'background-image': `
            linear-gradient(#151d39 1px, transparent 1px),
            linear-gradient(90deg, #151d39 1px, transparent 1px)
          `,
          'background-size': '20px 20px'
        }}
      />

      {/* Contrôles du canvas (en bas à droite) */}
      <div style={{
        position: 'absolute',
        bottom: '1rem',
        right: '1rem',
        display: 'flex',
        'flex-direction': 'column',
        gap: '0.5rem',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '0.5rem',
        'border-radius': '8px',
        border: '1px solid #444'
      }}>
        {/* Zoom controls */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          'align-items': 'center'
        }}>
          <button
            onClick={zoomOut}
            style={{
              padding: '0.5rem',
              background: '#3c3c3f',
              border: '1px solid #555',
              'border-radius': '4px',
              color: '#d4d4d4',
              cursor: 'pointer',
              'font-size': '1rem',
              'line-height': 1,
              width: '32px',
              height: '32px'
            }}
            title="Zoom arrière"
          >
            −
          </button>
          
          <button
            onClick={zoomReset}
            style={{
              padding: '0.5rem',
              background: '#3c3c3f',
              border: '1px solid #555',
              'border-radius': '4px',
              color: '#d4d4d4',
              cursor: 'pointer',
              'font-size': '0.75rem',
              'line-height': 1,
              'min-width': '40px'
            }}
            title="Réinitialiser le zoom"
          >
            {Math.round(currentZoom * 100)}%
          </button>
          
          <button
            onClick={zoomIn}
            class="p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50 transition-colors"
            style={{
              padding: '0.5rem',
              background: '#3c3c3f',
              border: '1px solid #555',
              'border-radius': '4px',
              color: '#d4d4d4',
              cursor: 'pointer',
              'font-size': '1rem',
              'line-height': 1,
              width: '32px',
              height: '32px'
            }}
            title="Zoom avant"
          >
            +
          </button>
        </div>
        
        {/* Fit to page */}
        <button
          onClick={fitToPage}
          style={{
            padding: '0.5rem 0.75rem',
            background: '#3c3c3f',
            border: '1px solid #555',
            'border-radius': '4px',
            color: '#d4d4d4',
            cursor: 'pointer',
            'font-size': '0.85rem',
            'font-weight': '500',
            'white-space': 'nowrap'
          }}
          title="Adapter à la page"
        >
          📐 Adapter
        </button>
        
        {/* Clear all */}
        <button
          onClick={clearCanvas}
          style={{
            padding: '0.5rem 0.75rem',
            background: '#5a1d1d',
            border: '1px solid #8b0000',
            'border-radius': '4px',
            color: '#f48771',
            cursor: 'pointer',
            'font-size': '0.85rem',
            'font-weight': '500',
            'white-space': 'nowrap'
          }}
          title="Effacer tous les nœuds"
        >
          🗑️ Effacer
        </button>
      </div>

      {/* Légende des types de nodes (en haut à gauche) */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '0.75rem',
        'border-radius': '8px',
        border: '1px solid #444',
        'font-size': '0.85rem'
      }}>
        <div style={{ 'margin-bottom': '0.5rem', 'font-weight': 'bold', color: '#d4d4d4' }}>
          Types de nœuds
        </div>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '16px', 
              height: '16px', 
              background: '#2d2d30', 
              border: '2px solid #3c3c3f',
              'border-radius': '3px'
            }} />
            <span style={{ color: '#d4d4d4' }}>Story (Scène)</span>
          </div>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '16px', 
              height: '16px', 
              background: '#4a1a1a', 
              border: '2px solid #8b0000',
              'border-radius': '3px'
            }} />
            <span style={{ color: '#d4d4d4' }}>Combat</span>
          </div>
        </div>
      </div>
    </div>
  );
}