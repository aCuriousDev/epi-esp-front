import { onMount, onCleanup } from 'solid-js';
import draw2d from 'draw2d';
import { CampaignNode } from './nodes/CampaignNode';
import { ChoicesNode } from './nodes/ChoicesNode';
import { CombatNode } from './nodes/CombatNode';
import { StartNode } from './nodes/StartNode';
import { SceneNode } from './nodes/SceneNode';
import { MapNode } from './nodes/MapNode';
import { safeConfirm } from '@/services/ui/confirm';

interface CampaignTreeCanvasProps {
  onNodeSelect?: (node: CampaignNode | null) => void;
  onConnectionCreate?: (connection: draw2d.Connection) => void;
  ref?: (methods: CampaignTreeCanvasRef) => void;
  readOnly?: boolean;
}

export interface CampaignTreeCanvasRef {
  addNode: (nodeData: AddNodeData) => CampaignNode;
  exportData: () => string | undefined;
  importData: (data: any) => void;
  clearCanvas: () => void;
  getCanvas: () => draw2d.Canvas | null;
  getViewportCenter: () => { x: number; y: number } | null;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  fitToPage: () => void;
  gotoFigure: (figure: any) => void;
  getTreeBoundingBox: () => any;
  undo: () => void;
  redo: () => void;
  refreshCanvas: () => void;
  highlightVisited?: (visitedNodeIds: string[], traversedEdges: Array<{sourceId: string; port: string}>) => void;
}

interface AddNodeData {
  type: 'choices' | 'combat' | 'scene' | 'map';
  x?: number;
  y?: number;
  data?: any;
}

export function CampaignTreeCanvas(props: CampaignTreeCanvasProps) {
  let canvasRef: HTMLDivElement | undefined;
  let canvas: draw2d.Canvas | null = null;
  let selectedNode: CampaignNode | null = null;
  let currentZoom: number = 1.0;

  const addStartNode = () => {
    if (!canvas) return;
    const startNode = new StartNode(
      100, // centré horizontalement
      300  // en haut du canvas
    );
    canvas.add(startNode, startNode.x, startNode.y);
    return startNode;
  };

  /**
   * Créer un node en fonction du type
   */
  const createNode = (nodeData: AddNodeData): CampaignNode => {
    if (!canvas) throw new Error("Canvas not initialized");

    const x = nodeData.x || 100;
    const y = nodeData.y || 100;
    let node: CampaignNode;

    // Créer le node selon son type
    switch (nodeData.type) {
      case 'choices': {
        const existingId = nodeData.data?.id as string | undefined;
        node = new ChoicesNode(x, y, {
          id: existingId ?? generateId('choices'),
          type: 'choices',
          title: nodeData.data?.title ?? '',
          text: nodeData.data?.text ?? "",
          choices: nodeData.data?.choices ?? [],
        });
        break;
      }
      case 'scene': {
        const existingId = nodeData.data?.id as string | undefined;
        node = new SceneNode(x, y, {
          id: existingId ?? generateId('scene'),
          type: 'scene',
          title: nodeData.data?.title ?? "",
          text: nodeData.data?.text ?? "",
        });
        break;
      }

      case 'combat': {
        const existingId = nodeData.data?.id as string | undefined;
        node = new CombatNode(x, y, {
          id: existingId ?? generateId('combat'),
          type: 'combat',
          title: nodeData.data?.title ?? '',
          selectedMap: nodeData.data?.selectedMap ?? '',
          difficulty: nodeData.data?.difficulty ?? 'medium',
          villains: nodeData.data?.villains ?? [],
        });
        break;
      }

      case 'map': {
        const existingId = nodeData.data?.id as string | undefined;
        node = new MapNode(x, y, {
          id: existingId ?? generateId('map'),
          type: 'map',
          title: nodeData.data?.title ?? '',
          selectedMap: nodeData.data?.selectedMap ?? '',
        });
        break;
      }

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
  // Export — ton format custom
  const exportData = () => {
    if (!canvas) return;

    const figures = canvas
      .getFigures()
      .asArray()
      .filter((fig: any) => !(fig instanceof StartNode));

    const lines = canvas.getLines().asArray();

    const result = {
      nodes: figures.map((fig: any) => ({
        type: fig.nodeData.type,
        x: fig.x,
        y: fig.y,
        data: fig.nodeData,
      })),
      connections: lines.map((conn: any) => {
        const sourceParent = conn.getSource().getParent();
        const targetParent = conn.getTarget().getParent();
        const sourceId = sourceParent.nodeData?.id ?? sourceParent.getId();
        const targetId = targetParent.nodeData?.id ?? targetParent.getId();

        return {
          source: {
            node: sourceId,
            port: conn.getSource().getName(),
          },
          target: {
            node: targetId,
            port: conn.getTarget().getName(),
          },
        };
      }),
    };

    return JSON.stringify(result);
  };

  // Import — reconstruction manuelle
  const importData = (data: any) => {
    if (!canvas) return;

    canvas.clear();

    if (!data) {
      // Aucun JSON fourni → on garde juste le StartNode
      addStartNode();
      return;
    }

    let json = data;
    if (typeof data === "string") {
      try {
        json = JSON.parse(data);
      } catch (e) {
        console.error("Invalid campaign tree JSON:", e);
        return;
      }
    }

    if (!json.nodes || !Array.isArray(json.nodes)) return;

    // D'abord, recréer le StartNode et construire une map id → figure
    const nodeMap: Record<string, CampaignNode> = {};

    const startNode = addStartNode();
    if (startNode) {
      const startId = (startNode as any).getData?.().id ?? "start-node";
      nodeMap[startId] = startNode;
    }

    json.nodes.forEach((item: any) => {
      if (item.type === "start" || item.data?.type === "start") {
        return;
      }
      const node = createNode({
        type: item.type,
        x: item.x,
        y: item.y,
        data: item.data,
      });

      const dataId = node.getData()?.id;
      if (dataId) {
        nodeMap[dataId] = node;
      }
    });

    // Puis, recréer les connexions si présentes
    if (Array.isArray(json.connections)) {
      const currentCanvas = canvas;
      if (!currentCanvas) return;

      json.connections.forEach((conn: any) => {
        const sourceNodeId = conn.source?.node ?? conn.source?.nodeId;
        const targetNodeId = conn.target?.node ?? conn.target?.nodeId;
        if (!sourceNodeId || !targetNodeId) return;

        const sourceNode = nodeMap[sourceNodeId];
        const targetNode = nodeMap[targetNodeId];
        if (!sourceNode || !targetNode) return;

        const sourcePortName = conn.source.port;
        const targetPortName = conn.target.port;

        const sourcePort =
          sourceNode.getPort(sourcePortName) ??
          sourceNode.getOutputPort?.(sourcePortName);
        const targetPort =
          targetNode.getPort(targetPortName) ??
          targetNode.getInputPort?.(targetPortName);

        if (!sourcePort || !targetPort) {
          console.warn(`[importData] Skipping connection: port not found (source="${sourcePortName}" on "${sourceNodeId}", target="${targetPortName}" on "${targetNodeId}")`);
          return;
        }

        const connection = new draw2d.Connection();
        connection.setSource(sourcePort);
        connection.setTarget(targetPort);

        connection.setColor("#888888");
        connection.setStroke(2);
        connection.setTargetDecorator(
          new draw2d.decoration.connection.ArrowDecorator()
        );
        connection.setRouter(
          new draw2d.layout.connection.ManhattanConnectionRouter()
        );

        currentCanvas.add(connection);
      });
    }
  };

  // Naviguer vers un node
  const gotoFigure = (figure: any) => {
    if (!canvas || !canvasRef) return;
    canvas.setCurrentSelection(figure);
    const bb = figure.getBoundingBox();
    const x = (bb.x + bb.w / 2) * (1 / currentZoom);
    const y = (bb.y + bb.h / 2) * (1 / currentZoom);
    canvasRef.scrollLeft = x - canvasRef.offsetWidth / 2;
    canvasRef.scrollTop = y - canvasRef.offsetHeight / 2;
  };

  // Bounding box de tout le canvas
  const getTreeBoundingBox = () => {
    const figures = canvas?.getFigures();
    if (!figures || figures.getSize() === 0) return null;
    const box = figures.first().getBoundingBox();
    figures.each((_: number, figure: any) => box.merge(figure.getBoundingBox()));
    return box;
  };

  // Centre de la zone visible du canvas dans les coordonnées draw2d
  const getViewportCenter = (): { x: number; y: number } | null => {
    if (!canvas) return null;
    // Utiliser le centre de la fenêtre visible plutôt que celui du div 5000x5000
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const point = canvas.fromDocumentToCanvasCoordinate(centerX, centerY);
    return { x: point.x, y: point.y };
  };

  // Undo / Redo
  const undo = () => canvas?.getCommandStack().undo();
  const redo = () => canvas?.getCommandStack().redo();

  // Export JSON propre
  const exportJson = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!canvas) return reject('Canvas not initialized');
      const writer = new draw2d.io.json.Writer();
      writer.marshal(canvas, (json: any) => {
        resolve(JSON.stringify(json, null, 2));
      });
    });
  };

  // Zoom vers la position de la souris
  const handleWheelZoom = (event: WheelEvent) => {
    if (!canvas || !event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY * 0.001;
    const newZoom = Math.min(Math.max(currentZoom + delta, 0.3), 3);
    const pos = canvas.fromDocumentToCanvasCoordinate(event.clientX, event.clientY);
    currentZoom = newZoom;
    canvas.setZoom(newZoom);
  };

  /**
   * Effacer tout le canvas
   */
  const clearCanvas = () => {
    if (!canvas) return;

    // Confirmation avant d'effacer
    if (canvas.getFigures().getSize() > 0) {
      if (!safeConfirm("Êtes-vous sûr de vouloir effacer tous les nœuds ?")) {
        return;
      }
    }

    canvas.clear();
    addStartNode();
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

  const refreshCanvas = () => {
    if (!canvas) return;

    canvas.getFigures().each((_: number, figure: any) => {
      figure.getChildren().each((_: number, child: any) => child.repaint());
      figure.repaint();
    });

    canvas.getLines().each((_: number, line: any) => line.repaint());
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

  const highlightVisited = (
    visitedNodeIds: string[],
    traversedEdges: Array<{ sourceId: string; port: string }>
  ) => {
    if (!canvas) return;

    const visitedSet = new Set(visitedNodeIds);
    const traversedSet = new Set(traversedEdges.map(e => `${e.sourceId}::${e.port}`));

    // Highlight visited nodes — change border color to green
    canvas.getFigures().each((_: number, fig: any) => {
      const nodeId = fig.nodeData?.id;
      if (!nodeId) return;
      if (visitedSet.has(nodeId)) {
        // Change the figure's background border color to green
        fig.getChildren().each((_: number, child: any) => {
          if (child.setColor) child.setColor('#22c55e'); // green-500
          if (child.setBgColor && child.bgColor && child.bgColor !== 'none') {
            // lighten slightly — add green tint
          }
        });
        // Also try direct color change on the figure itself
        if (fig.background?.setColor) fig.background.setColor('#22c55e');
        fig.repaint();
      }
    });

    // Highlight traversed connections — change stroke color to green
    canvas.getLines().each((_: number, conn: any) => {
      const sourceParent = conn.getSource()?.getParent?.();
      const sourceId = sourceParent?.nodeData?.id ?? sourceParent?.getId?.();
      const portName = conn.getSource()?.getName?.();
      if (sourceId && portName && traversedSet.has(`${sourceId}::${portName}`)) {
        conn.setColor('#22c55e');
        conn.setStroke(3);
        conn.repaint();
      }
    });
  };

  onMount(() => {
    if (!canvasRef) return;

    // Créer le canvas draw2d
    canvas = new draw2d.Canvas(canvasRef.id);
    if (canvas.paper && canvas.paper.canvas) {
      canvas.paper.canvas.style.backgroundColor = 'transparent';
    }
    // Installer les politiques
    canvas.installEditPolicy(new draw2d.policy.canvas.SnapToGridEditPolicy(20));
    // WheelZoomPolicy retiré : le zoom Ctrl+Wheel est géré par handleWheelZoom pour éviter le double-zoom
    canvas.installEditPolicy(new draw2d.policy.canvas.PanningSelectionPolicy());
    canvas.installEditPolicy(new draw2d.policy.canvas.KeyboardPolicy());

    //Listener
    canvasRef.addEventListener('wheel', handleWheelZoom, { passive: false });

    addStartNode();

    // Apply read-only policies if needed
    if (props.readOnly) {
      canvas.installEditPolicy(new draw2d.policy.canvas.ReadOnlySelectionPolicy());
    }

    // Bloquer explicitement la suppression via commande
    canvas.on('contextmenu', (emitter: any, event: any) => {
      if (event.figure instanceof StartNode) {
        event.preventDefault?.();
        return false;
      }
    });
    // Événement : Sélection d'un node
    canvas.on("select", (emitter: any, event: any) => {
      if (event.figure instanceof CampaignNode) {
        selectedNode = event.figure;
        props.onNodeSelect?.(event.figure);
      }
    });

    // Événement : Désélection d'un node
    canvas.on("unselect", (emitter: any, event: any) => {
      if (event.figure instanceof CampaignNode) {
        selectedNode = null;
        props.onNodeSelect?.(null);
      }
    });

    // Événement : Création d'une connexion
    canvas.on("connect", (emitter: any, event: any) => {
      const connection = event.connection;

      // Personnaliser l'apparence de la connexion
      connection.setColor("#888888");
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
        getViewportCenter,
        zoomIn,
        zoomOut,
        zoomReset,
        fitToPage,
        gotoFigure,
        getTreeBoundingBox,
        undo,
        redo,
        refreshCanvas,
        highlightVisited,
      });
    }
  });

  /**
   * Nettoyage
   */
  onCleanup(() => {
    canvasRef?.removeEventListener('wheel', handleWheelZoom);
    canvas?.clear();
    canvas = null;
  });

  return (
    <div
      class="campaign-tree-canvas-container"
      style={{
        position: 'relative',
      }}
    >
      {/* Canvas draw2d */}
      <div
        class='campaign-view-page'
        ref={canvasRef}
        id="campaign-tree-canvas"
        style={{
          width: '5000px',
          height: '5000px',
          'background-image': `
            linear-gradient(#151d39 1px, transparent 1px),
            linear-gradient(90deg, #151d39 1px, transparent 1px)
          `,
          "background-size": "20px 20px",
        }}
      />

      {/* Contrôles du canvas (en bas à droite) */}
      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          right: "1rem",
          display: "flex",
          "flex-direction": "column",
          gap: "0.5rem",
          background: "rgba(0, 0, 0, 0.7)",
          padding: "0.5rem",
          "border-radius": "8px",
          border: "1px solid #444",
        }}
      >
        {/* Zoom controls */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            "align-items": "center",
          }}
        >
          <button
            onClick={zoomOut}
            style={{
              padding: "0.5rem",
              background: "#3c3c3f",
              border: "1px solid #555",
              "border-radius": "4px",
              color: "#d4d4d4",
              cursor: "pointer",
              "font-size": "1rem",
              "line-height": 1,
              width: "32px",
              height: "32px",
            }}
            title="Zoom arrière"
          >
            −
          </button>

          <button
            onClick={zoomReset}
            style={{
              padding: "0.5rem",
              background: "#3c3c3f",
              border: "1px solid #555",
              "border-radius": "4px",
              color: "#d4d4d4",
              cursor: "pointer",
              "font-size": "0.75rem",
              "line-height": 1,
              "min-width": "40px",
            }}
            title="Réinitialiser le zoom"
          >
            {Math.round(currentZoom * 100)}%
          </button>

          <button
            onClick={zoomIn}
            class="p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50 transition-colors"
            style={{
              padding: "0.5rem",
              background: "#3c3c3f",
              border: "1px solid #555",
              "border-radius": "4px",
              color: "#d4d4d4",
              cursor: "pointer",
              "font-size": "1rem",
              "line-height": 1,
              width: "32px",
              height: "32px",
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
            padding: "0.5rem 0.75rem",
            background: "#3c3c3f",
            border: "1px solid #555",
            "border-radius": "4px",
            color: "#d4d4d4",
            cursor: "pointer",
            "font-size": "0.85rem",
            "font-weight": "500",
            "white-space": "nowrap",
          }}
          title="Adapter à la page"
        >
          📐 Adapter
        </button>

        {/* Clear all */}
        <button
          onClick={clearCanvas}
          style={{
            padding: "0.5rem 0.75rem",
            background: "#5a1d1d",
            border: "1px solid #8b0000",
            "border-radius": "4px",
            color: "#f48771",
            cursor: "pointer",
            "font-size": "0.85rem",
            "font-weight": "500",
            "white-space": "nowrap",
          }}
          title="Effacer tous les nœuds"
        >
          🗑️ Effacer
        </button>
      </div>

      {/* Légende des types de nodes (en haut à gauche) */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          background: "rgba(0, 0, 0, 0.7)",
          padding: "0.75rem",
          "border-radius": "8px",
          border: "1px solid #444",
          "font-size": "0.85rem",
        }}
      >
        <div
          style={{
            "margin-bottom": "0.5rem",
            "font-weight": "bold",
            color: "#d4d4d4",
          }}
        >
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
            <span style={{ color: '#d4d4d4' }}>Choices (Scène)</span>
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
