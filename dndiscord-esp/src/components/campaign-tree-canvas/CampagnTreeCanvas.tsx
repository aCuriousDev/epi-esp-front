import { onMount, onCleanup, createSignal, Show } from "solid-js";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-solid";
import draw2d from "draw2d";
import { CampaignNode } from "./nodes/CampaignNode";
import { CombatNode } from "./nodes/CombatNode";
import { safeConfirm } from "../../services/ui/confirm";
import { tokens } from "@/styles/design-tokens";
import { ChoicesNode } from "./nodes/ChoicesNode";
import { SceneNode, SceneNodeData } from "./nodes/SceneNode";
import { MapNode } from "./nodes/MapNode";
import { StartNode } from "./nodes/StartNode";

interface CampaignTreeCanvasProps {
  onNodeSelect?: (node: CampaignNode | null) => void;
  onConnectionCreate?: (connection: draw2d.Connection) => void;
  ref?: (methods: CampaignTreeCanvasRef) => void;
  readOnly?: boolean;
  canvasId?: string;
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
  highlightVisited: (
    visitedNodeIds: string[],
    traversedEdges: Array<{ sourceId: string; port: string }>,
  ) => void;
}

interface AddNodeData {
  type: "choices" | "combat" | "scene" | "map" | "condition";
  x?: number;
  y?: number;
  data?: any;
}
(window as any).choices = ChoicesNode;
(window as any).CombatNode = CombatNode;
(window as any).StartNode = StartNode;
(window as any).scene = SceneNode;
(window as any).MapNode = MapNode;
(window as any).draw2d = draw2d;

export function CampaignTreeCanvas(props: CampaignTreeCanvasProps) {
  let canvasRef: HTMLDivElement | undefined;
  let viewportRef: HTMLDivElement | undefined;
  let canvas: draw2d.Canvas | null = null;
  let selectedNode: CampaignNode | null = null;
  const [currentZoom, setCurrentZoom] = createSignal(1.0);

  const panBtnStyle = {
    padding: "0.25rem",
    background: tokens.ink[500],
    border: `1px solid ${tokens.ink[500]}`,
    "border-radius": "4px",
    color: tokens.text.high,
    cursor: "pointer",
    "font-size": "0.75rem",
    width: "28px",
    height: "28px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  } as const;

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
          enemies: nodeData.data?.enemies || [],
          difficulty: nodeData.data?.difficulty || "medium",
          ...nodeData.data,
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
          spawnPoint: nodeData.data?.spawnPoint,
          exitCells:  nodeData.data?.exitCells,
          trapCells:  nodeData.data?.trapCells,
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

        if (!sourcePort || !targetPort) return;

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
    if (!canvas || !viewportRef) return;
    canvas.setCurrentSelection(figure);
    const bb = figure.getBoundingBox();
    const x = (bb.x + bb.w / 2) * (1 / currentZoom());
    const y = (bb.y + bb.h / 2) * (1 / currentZoom());
    viewportRef.scrollLeft = x - viewportRef.offsetWidth / 2;
    viewportRef.scrollTop = y - viewportRef.offsetHeight / 2;
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

  /**
   * Wheel handler — two behaviours:
   *
   *   Ctrl + scroll  (or trackpad pinch)  → zoom in / out.
   *   Two-finger scroll on touchpad       → pan the canvas (no modifier needed).
   *
   * We always call preventDefault() so the browser never attempts to scroll
   * the page while the user is working inside the canvas.
   */
  const handleWheelZoom = (event: WheelEvent) => {
    if (!canvas) return;
    event.preventDefault();

    if (event.ctrlKey) {
      const delta = event.deltaY * 0.001;
      const newZoom = Math.min(Math.max(currentZoom() + delta, 0.3), 3);
      setCurrentZoom(newZoom);
      canvas.setZoom(newZoom);
    } else if (viewportRef) {
      viewportRef.scrollLeft += event.deltaX;
      viewportRef.scrollTop  += event.deltaY;
    }
  };

  /**
   * Effacer tout le canvas
   */
  const clearCanvas = () => {
    if (!canvas) return;

    // Confirmation avant d'effacer
    if (canvas.getFigures().getSize() > 0) {
      if (!safeConfirm("Are you sure you want to clear all nodes?")) {
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
    setCurrentZoom(Math.min(currentZoom() + 0.1, 3.0));
    canvas.setZoom(currentZoom());
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
    setCurrentZoom(Math.max(currentZoom() - 0.1, 0.3));
    canvas.setZoom(currentZoom());
  };

  /**
   * Reset zoom
   */
  const zoomReset = () => {
    if (!canvas) return;
    setCurrentZoom(1.0);
    canvas.setZoom(currentZoom());
  };

  const PAN_STEP = 120;
  const panLeft  = () => { if (viewportRef) viewportRef.scrollLeft -= PAN_STEP; };
  const panRight = () => { if (viewportRef) viewportRef.scrollLeft += PAN_STEP; };
  const panUp    = () => { if (viewportRef) viewportRef.scrollTop  -= PAN_STEP; };
  const panDown  = () => { if (viewportRef) viewportRef.scrollTop  += PAN_STEP; };

  /**
   * Highlight visited nodes and traversed connections in green (for replay view)
   */
  const highlightVisited = (
    visitedNodeIds: string[],
    traversedEdges: Array<{ sourceId: string; port: string }>,
  ) => {
    if (!canvas) return;

    // Highlight visited nodes
    canvas.getFigures().each((_i: number, fig: any) => {
      const userData = fig.getUserData?.();
      if (userData?.id && visitedNodeIds.includes(userData.id)) {
        // Try to colour the background rectangle child
        const children = fig.getChildren?.();
        if (children) {
          children.each((_j: number, child: any) => {
            if (typeof child.setBackgroundColor === 'function') {
              child.setBackgroundColor('#166534');
              child.setColor('#22c55e');
              child.repaint?.();
            }
          });
        }
        fig.repaint?.();
      }
    });

    // Highlight traversed connections
    canvas.getLines().each((_i: number, conn: any) => {
      const sourcePort = conn.getSource?.();
      const sourceNode = sourcePort?.getParent?.();
      const sourceNodeData = sourceNode?.getUserData?.();
      const portName = sourcePort?.getName?.();

      if (sourceNodeData?.id && portName) {
        const isTraversed = traversedEdges.some(
          (e) => e.sourceId === sourceNodeData.id && e.port === portName,
        );
        if (isTraversed) {
          conn.setColor('#22c55e');
          conn.setStroke(3);
          conn.repaint?.();
        }
      }
    });
  };

  /**
   * Fit to page
   */
  const fitToPage = () => {
    if (!canvas) return;

    const figures = canvas.getFigures();
    if (figures.getSize() === 0) return;

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    figures.each((i: number, figure: any) => {
      const bounds = figure.getBoundingBox();
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.w);
      maxY = Math.max(maxY, bounds.y + bounds.h);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const canvasWidth = viewportRef?.clientWidth || 800;
    const canvasHeight = viewportRef?.clientHeight || 600;

    const zoomX = canvasWidth / width;
    const zoomY = canvasHeight / height;
    setCurrentZoom(Math.min(zoomX, zoomY, 1.0) * 0.9); // 90% pour laisser de la marge

    canvas.setZoom(currentZoom());
  };

  onMount(() => {
    if (!canvasRef) return;

    // draw2d host: 5000×5000 virtual canvas. draw2d forces overflow:hidden on
    // this div internally, so the actual scrollable viewport is viewportRef (its
    // parent). Panning is implemented via custom mouse drag on viewportRef so we
    // don't rely on PanningSelectionPolicy (which only works when draw2d owns
    // the scroll container).
    canvas = new (draw2d.Canvas as any)(canvasRef.id, 5000, 5000) as draw2d.Canvas;
    if (canvas.paper && canvas.paper.canvas) {
      canvas.paper.canvas.style.backgroundColor = "transparent";
    }

    canvas.installEditPolicy(new draw2d.policy.canvas.SnapToGridEditPolicy(20));
    // No WheelZoomPolicy — handled by our custom handleWheelZoom.
    // No PanningSelectionPolicy — handled by custom mouse drag below.
    canvas.installEditPolicy(new draw2d.policy.canvas.SingleSelectionPolicy());
    canvas.installEditPolicy(new draw2d.policy.canvas.KeyboardPolicy());

    // ── Custom drag-to-pan ───────────────────────────────────────────────
    {
      let _panActive = false;
      let _startX = 0, _startY = 0;
      let _scrollLeft = 0, _scrollTop = 0;

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as Element;
        // Only pan on background SVG, not on draw2d figures
        if (target.closest('.draw2d_Figure')) return;
        _panActive = true;
        _startX = e.clientX;
        _startY = e.clientY;
        _scrollLeft = viewportRef!.scrollLeft;
        _scrollTop  = viewportRef!.scrollTop;
        viewportRef!.classList.add('is-panning');
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!_panActive || !viewportRef) return;
        viewportRef.scrollLeft = _scrollLeft - (e.clientX - _startX);
        viewportRef.scrollTop  = _scrollTop  - (e.clientY - _startY);
      };
      const onMouseUp = () => {
        if (_panActive) {
          _panActive = false;
          viewportRef?.classList.remove('is-panning');
        }
      };

      // mousedown on the draw2d host so clicks on the SVG background trigger pan
      canvasRef!.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      (canvasRef as any).__panCleanup = () => {
        canvasRef!.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }

    // Read-only mode: replace selection policy so nothing can be moved/edited
    if (props.readOnly) {
      try {
        canvas.installEditPolicy(new (draw2d.policy.canvas as any).ReadOnlySelectionPolicy());
      } catch (e) {
        console.warn('[Canvas] ReadOnlySelectionPolicy not available:', e);
      }
    }

    viewportRef!.addEventListener('wheel', handleWheelZoom, { passive: false });

    addStartNode();

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
      connection.setColor(tokens.text.low);
      connection.setStroke(2);

      // Ajouter une flèche
      connection.setTargetDecorator(
        new draw2d.decoration.connection.ArrowDecorator(),
      );

      // Utiliser un routeur Manhattan (angles droits)
      connection.setRouter(
        new draw2d.layout.connection.ManhattanConnectionRouter(),
      );

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
    viewportRef?.removeEventListener('wheel', handleWheelZoom);
    (canvasRef as any)?.__panCleanup?.();
    canvas?.clear();
    canvas = null;
  });

  return (
    <div
      class="campaign-tree-canvas-container"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Scroll viewport — overflow:auto so we can pan via scrollLeft/scrollTop.
          draw2d forces overflow:hidden on its host div, so this wrapper is
          the actual scroll container. Background grid scrolls with it. */}
      <div
        ref={viewportRef}
        class="campaign-tree-canvas-scroll"
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          cursor: "grab",
          "background-image": `
            linear-gradient(${tokens.ink[800]} 1px, transparent 1px),
            linear-gradient(90deg, ${tokens.ink[800]} 1px, transparent 1px)
          `,
          "background-size": "20px 20px",
          "background-attachment": "local",
        }}
      >
        {/* draw2d host — will be forced to 5000×5000 with overflow:hidden by draw2d */}
        <div
          class="campaign-view-page"
          ref={canvasRef}
          id={props.canvasId ?? "campaign-tree-canvas"}
        />
      </div>

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
          border: `1px solid ${tokens.ink[600]}`,
        }}
      >
        {/* Navigation (pan) — 4 arrow buttons arranged as a D-pad */}
        <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", gap: "2px" }}>
          <button onClick={panUp}    title="Monter"    style={panBtnStyle}><ChevronUp size={14} /></button>
          <div style={{ display: "flex", gap: "2px" }}>
            <button onClick={panLeft}  title="Gauche"    style={panBtnStyle}><ChevronLeft size={14} /></button>
            <button onClick={panDown}  title="Descendre" style={panBtnStyle}><ChevronDown size={14} /></button>
            <button onClick={panRight} title="Droite"    style={panBtnStyle}><ChevronRight size={14} /></button>
          </div>
        </div>

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
              background: tokens.ink[500],
              border: `1px solid ${tokens.ink[500]}`,
              "border-radius": "4px",
              color: tokens.text.high,
              cursor: "pointer",
              "font-size": "1rem",
              "line-height": 1,
              width: "32px",
              height: "32px",
            }}
            title="Zoom out"
          >
            −
          </button>

          <button
            onClick={zoomReset}
            style={{
              padding: "0.5rem",
              background: tokens.ink[500],
              border: `1px solid ${tokens.ink[500]}`,
              "border-radius": "4px",
              color: tokens.text.high,
              cursor: "pointer",
              "font-size": "0.75rem",
              "line-height": 1,
              "min-width": "40px",
            }}
            title="Reset zoom"
          >
            {Math.round(currentZoom() * 100)}%
          </button>

          <button
            onClick={zoomIn}
            class="p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50 transition-colors"
            style={{
              padding: "0.5rem",
              background: tokens.ink[500],
              border: `1px solid ${tokens.ink[500]}`,
              "border-radius": "4px",
              color: tokens.text.high,
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
            background: tokens.ink[500],
            border: `1px solid ${tokens.ink[500]}`,
            "border-radius": "4px",
            color: tokens.text.high,
            cursor: "pointer",
            "font-size": "0.85rem",
            "font-weight": "500",
            "white-space": "nowrap",
          }}
          title="Fit to page"
        >
          📐 Fit
        </button>

        {/* Clear all — hidden in read-only mode */}
        <Show when={!props.readOnly}>
          <button
            onClick={clearCanvas}
            style={{
              padding: "0.5rem 0.75rem",
              background: "rgba(239,68,68,0.22)",
              border: `1px solid ${tokens.status.danger}`,
              "border-radius": "4px",
              color: tokens.status.danger,
              cursor: "pointer",
              "font-size": "0.85rem",
              "font-weight": "500",
              "white-space": "nowrap",
            }}
            title="Clear all nodes"
          >
            Effacer
          </button>
        </Show>
      </div>

      {/* Légende des types de nodes (en haut à gauche) — masquée en lecture seule */}
      <Show when={!props.readOnly}>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          background: "rgba(0, 0, 0, 0.7)",
          padding: "0.75rem",
          "border-radius": "8px",
          border: `1px solid ${tokens.ink[600]}`,
          "font-size": "0.85rem",
        }}
      >
        <div
          style={{
            "margin-bottom": "0.5rem",
            "font-weight": "bold",
            color: tokens.text.high,
          }}
        >
          Node types
        </div>
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            gap: "0.25rem",
          }}
        >
          <div
            style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                background: tokens.ink[600],
                border: `2px solid ${tokens.ink[500]}`,
                "border-radius": "3px",
              }}
            />
            <span style={{ color: tokens.text.high }}>Story (Scene)</span>
          </div>
          <div
            style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                background: "rgba(239,68,68,0.22)",
                border: `2px solid ${tokens.status.danger}`,
                "border-radius": "3px",
              }}
            />
            <span style={{ color: tokens.text.high }}>Combat</span>
          </div>
        </div>
      </div>
      </Show>
    </div>
  );
}
