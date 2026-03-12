declare module 'draw2d' {
  // ============================================================================
  // CANVAS
  // ============================================================================
  
  export class Canvas {
    constructor(id: string);
    
    paper: any; // Raphael.js paper instance
    
    // Add/Remove figures
    add(figure: any, x?: number, y?: number): void;
    remove(figure: any): void;
    clear(): void;
    
    // Policies
    installEditPolicy(policy: any): void;
    uninstallEditPolicy(policy: any): void;
    
    // Events
    on(event: string, callback: (emitter: any, event: any) => void): void;
    off(event: string): void;
    
    // Getters
    getLines(): any;
    getFigures(): any;
    getFigure(id: string): any;
    
    // Selection
    getSelection(): any;
    setCurrentSelection(figure: any): void;
    
    // Zoom
    setZoom(zoomFactor: number): void;
    getZoom(): number;
    
    // Commands (Undo/Redo)
    getCommandStack(): any;
  }

  // ============================================================================
  // FIGURES - BASE
  // ============================================================================
  
  export namespace shape {
    // ------------------------------------------------------------------------
    // NODES
    // ------------------------------------------------------------------------
    export namespace node {
      export class Node {
        // Properties
        canvas: Canvas;
        shape: any;
        repaintBlocked: boolean;
        
        constructor(attr?: {
          width?: number;
          height?: number;
          bgColor?: string;
          color?: string;
          stroke?: number;
          radius?: number;
          x?: number;
          y?: number;
          resizeable?: boolean;
          selectable?: boolean;
        });
        
        // Abstract method - MUST implement
        createShapeElement(): any;
        
        // Dimensions
        getWidth(): number;
        getHeight(): number;
        setDimension(width: number, height: number): void;
        setWidth(width: number): void;
        setHeight(height: number): void;
        
        // Position
        getPosition(): { x: number; y: number };
        setPosition(x: number, y: number): void;
        getX(): number;
        getY(): number;
        setX(x: number): void;
        setY(y: number): void;
        
        // Ports
        createPort(type: string, locator?: any): Port;
        addPort(port: Port, locator?: any): void;
        removePort(port: Port): void;
        getPort(name: string): Port;
        getPorts(): any;
        getInputPorts(): any;
        getOutputPorts(): any;
        getInputPort(index: number): Port;
        getOutputPort(index: number): Port;
        
        // Children
        add(figure: any, locator?: any): void;
        remove(figure: any): void;
        getChildren(): any;
        
        // Data
        setUserData(data: any): void;
        getUserData(): any;
        
        // Canvas
        setCanvas(canvas: Canvas): void;
        getCanvas(): Canvas;
        
        // ID
        getId(): string;
        setId(id: string): void;
        
        // Visibility
        setVisible(visible: boolean): void;
        isVisible(): boolean;
        
        // Repaint
        repaint(attributes?: any): void;
        
        // Policies
        installEditPolicy(policy: any): void;
        uninstallEditPolicy(policy: any): void;
        
        // Persistence
        getPersistentAttributes(): any;
        setPersistentAttributes(memento: any): void;
        
        // Selection
        select(flag?: boolean): void;
        unselect(): void;
        isSelected(): boolean;
        
        // Drag & Drop
        onDrag(dx: number, dy: number): void;
        onDragStart(x: number, y: number): void;
        onDragEnd(): void;
      }
      
      // Specific node types
      export class Start extends Node {}
      export class End extends Node {}
      export class Between extends Node {}
      export class Hub extends Node {}
    }

    // ------------------------------------------------------------------------
    // BASIC SHAPES
    // ------------------------------------------------------------------------
    export namespace basic {
      export class Label {
        constructor(attr?: {
          text?: string;
          fontSize?: number;
          fontColor?: string;
          color?: string;
          bold?: boolean;
          stroke?: number;
        });
        
        setText(text: string): void;
        getText(): string;
        setFontSize(size: number): void;
        setFontColor(color: string): void;
        setColor(color: string): void;
        setBold(bold: boolean): void;
      }
      
      export class Text extends Label {}
      
      export class Rectangle {
        constructor(attr?: {
          width?: number;
          height?: number;
          bgColor?: string;
          color?: string;
          stroke?: number;
          radius?: number;
        });
        
        setDimension(width: number, height: number): void;
        setBackgroundColor(color: string): void;
        setColor(color: string): void;
      }
      
      export class Circle {
        constructor(attr?: {
          diameter?: number;
          bgColor?: string;
          color?: string;
          stroke?: number;
        });
        
        setDiameter(diameter: number): void;
        setRadius(radius: number): void;
      }
      
      export class Oval extends Circle {}
      
      export class Line {
        constructor(attr?: {
          stroke?: number;
          color?: string;
          outlineStroke?: number;
          outlineColor?: string;
        });
        
        setSource(port: Port): void;
        setTarget(port: Port): void;
        getSource(): Port;
        getTarget(): Port;
      }
      
      export class Image {
        constructor(attr?: {
          path?: string;
          width?: number;
          height?: number;
        });
        
        setPath(path: string): void;
      }
    }

    // ------------------------------------------------------------------------
    // COMPOSITE (GROUPS)
    // ------------------------------------------------------------------------
    export namespace composite {
      export class Group {
        constructor();
        
        // Add/Remove children
        add(figure: any, locator?: any): void;
        remove(figure: any): void;
        getChildren(): any;
        
        // Dimensions
        setDimension(width: number, height: number): void;
        getWidth(): number;
        getHeight(): number;
        
        // Position
        setPosition(x: number, y: number): void;
        getPosition(): { x: number; y: number };
        getX(): number;
        getY(): number;
        
        // Appearance
        setBackgroundColor(color: string): void;
        setColor(color: string): void;
        setBorder(border: any): void;
        
        // Canvas
        setCanvas(canvas: Canvas): void;
        getCanvas(): Canvas;
        
        // Ports (Groups can have ports too!)
        createPort(type: string, locator?: any): Port;
        addPort(port: Port, locator?: any): void;
        removePort(port: Port): void;
        getPorts(): any;
        getInputPorts(): any;
        getOutputPorts(): any;
        
        // Data
        setUserData(data: any): void;
        getUserData(): any;
        
        // Policies
        installEditPolicy(policy: any): void;
        uninstallEditPolicy(policy: any): void;
        
        // ID
        getId(): string;
        setId(id: string): void;
        
        // Repaint
        repaint(attributes?: any): void;
        
        // Persistence
        getPersistentAttributes(): any;
        setPersistentAttributes(memento: any): void;
      }
      
      // Group variants
      export class Jailhouse extends Group {
        constructor();
      }
      
      export class Strong extends Group {
        constructor();
      }
      
      export class Raft extends Group {
        constructor();
      }
    }

    // ------------------------------------------------------------------------
    // LAYOUT
    // ------------------------------------------------------------------------
    export namespace layout {
      export class VerticalLayout {
        constructor();
      }
      
      export class HorizontalLayout {
        constructor();
      }
      
      export class StackLayout {
        constructor();
      }
    }
  }

  // ============================================================================
  // CONNECTIONS
  // ============================================================================
  
  export class Connection {
    constructor(attr?: {
      stroke?: number;
      color?: string;
      outlineStroke?: number;
      outlineColor?: string;
      router?: any;
    });
    
    setSource(port: Port): void;
    setTarget(port: Port): void;
    getSource(): Port;
    getTarget(): Port;
    
    setRouter(router: any): void;
    getRouter(): any;
    
    setColor(color: string): void;
    getColor(): string;
  }

  // ============================================================================
  // PORTS
  // ============================================================================
  
  export class Port {
    constructor(attr?: {
      name?: string;
    });
    
    setName(name: string): void;
    getName(): string;
    
    getConnections(): any;
    getParent(): any;
    
    setMaxFanOut(max: number): void;
    getMaxFanOut(): number;
  }
  
  export class InputPort extends Port {}
  export class OutputPort extends Port {}
  export class HybridPort extends Port {}

  // ============================================================================
  // LOCATORS
  // ============================================================================
  
  export namespace layout {
    export namespace locator {
      // Relative locators
      export class TopLocator {
        constructor();
      }
      
      export class BottomLocator {
        constructor();
      }
      
      export class LeftLocator {
        constructor();
      }
      
      export class RightLocator {
        constructor();
      }
      
      export class CenterLocator {
        constructor();
      }
      
      // Absolute locators
      export class XYAbsPortLocator {
        constructor(x: number, y: number);
      }
      
      // Relative locators (percentage)
      export class XYRelPortLocator {
        constructor(x: number, y: number);
      }
      
      // Input/Output locators
      export class InputPortLocator {
        constructor();
      }
      
      export class OutputPortLocator {
        constructor();
      }
      
      // Port locators
      export class PortLocator {
        constructor();
      }
      
      export class ConnectionLocator {
        constructor();
      }
    }
  }

  // ============================================================================
  // POLICIES
  // ============================================================================
  
  export namespace policy {
    // Canvas policies
    export namespace canvas {
      export class SnapToGridEditPolicy {
        constructor(grid?: number);
      }
      
      export class WheelZoomPolicy {
        constructor();
      }
      
      export class PanningSelectionPolicy {
        constructor();
      }
      
      export class SingleSelectionPolicy {
        constructor();
      }
      
      export class BoundingboxSelectionPolicy {
        constructor();
      }
      
      export class SnapToGeometryEditPolicy {
        constructor();
      }
      
      export class SnapToInBetweenEditPolicy {
        constructor();
      }
    }
    
    // Figure policies
    export namespace figure {
      export class RectangleSelectionFeedbackPolicy {
        constructor();
      }
      
      export class GlowSelectionFeedbackPolicy {
        constructor();
      }
      
      export class SelectionFeedbackPolicy {
        constructor();
      }
      
      export class DragDropEditPolicy {
        constructor();
      }
      
      export class RegionEditPolicy {
        constructor();
      }
      
      export class ResizeEditPolicy {
        constructor();
      }
    }
    
    // Connection policies
    export namespace connection {
      export class ComposedConnectionCreatePolicy {
        constructor();
      }
      
      export class ConnectionCreatePolicy {
        constructor();
      }
      
      export class DragConnectionCreatePolicy {
        constructor();
      }
    }
    
    // Port policies
    export namespace port {
      export class IntrusivePortsFeedbackPolicy {
        constructor();
      }
      
      export class ElasticStrapFeedbackPolicy {
        constructor();
      }
    }
  }

  // ============================================================================
  // IO (Save/Load)
  // ============================================================================
  
  export namespace io {
    export namespace json {
      export class Writer {
        constructor();
        marshal(canvas: Canvas): any;
      }
      
      export class Reader {
        constructor();
        unmarshal(canvas: Canvas, data: any): void;
      }
    }
    
    export namespace png {
      export class Writer {
        constructor();
        marshal(canvas: Canvas): string;
      }
    }
    
    export namespace svg {
      export class Writer {
        constructor();
        marshal(canvas: Canvas): string;
      }
    }
  }

  // ============================================================================
  // COMMANDS (Undo/Redo)
  // ============================================================================
  
  export class Command {
    execute(): void;
    undo(): void;
    redo(): void;
    canExecute(): boolean;
    getLabel(): string;
  }
  
  export class CommandStack {
    execute(command: Command): void;
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    getUndoCommands(): Command[];
    getRedoCommands(): Command[];
  }

  // ============================================================================
  // DECORATION
  // ============================================================================
  
  export namespace decoration {
    export namespace connection {
      export class Decorator {
        constructor();
      }
      
      export class ArrowDecorator extends Decorator {
        constructor();
      }
      
      export class CircleDecorator extends Decorator {
        constructor();
      }
      
      export class DiamondDecorator extends Decorator {
        constructor();
      }
    }
  }

  // ============================================================================
  // ROUTER (Connection routing)
  // ============================================================================
  
  export namespace layout {
    export namespace connection {
      export class ConnectionRouter {
        constructor();
      }
      
      export class DirectRouter extends ConnectionRouter {
        constructor();
      }
      
      export class ManhattanConnectionRouter extends ConnectionRouter {
        constructor();
      }
      
      export class SplineConnectionRouter extends ConnectionRouter {
        constructor();
      }
      
      export class ManhattanBridgedConnectionRouter extends ConnectionRouter {
        constructor();
      }
      
      export class FanConnectionRouter extends ConnectionRouter {
        constructor();
      }
    }
  }

  // ============================================================================
  // UTIL
  // ============================================================================
  
  export namespace util {
    export class Color {
      constructor(r: number, g: number, b: number);
      static fromHex(hex: string): Color;
      toHex(): string;
      toRGB(): string;
    }
    
    export class UUID {
      static create(): string;
    }
  }

  // ============================================================================
  // GEO (Geometry)
  // ============================================================================
  
  export namespace geo {
    export class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }
    
    export class Rectangle {
      constructor(x: number, y: number, width: number, height: number);
      x: number;
      y: number;
      w: number;
      h: number;
    }
  }
}