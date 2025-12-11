import { onCleanup, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Animation } from '@babylonjs/core/Animations/animation';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
// Hover outline implemented via a thin overlay plane (no EffectLayer required)

export default function Play() {
	let canvasRef!: HTMLCanvasElement;
    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let camera: ArcRotateCamera | null = null;
    let orthoScale = 0.7; // board uses most of the screen
    let pawn: import('@babylonjs/core').Nullable<import('@babylonjs/core').Mesh> = null;
    let hoverTile: Mesh | null = null;
    let hoverPrevMat: StandardMaterial | null = null;
    let debugEl: HTMLDivElement | null = null;
    let pawnGX = 5; // grid x
    let pawnGY = 5; // grid y

	const createScene = () => {
		if (!canvasRef) return;
		engine = new Engine(canvasRef, true, { preserveDrawingBuffer: true, stencil: true });
		scene = new Scene(engine);

		// Orthographic isometric camera
		const rad = (deg: number) => (deg * Math.PI) / 180;
        camera = new ArcRotateCamera('isoCam', rad(45), rad(35.264), 20, new Vector3(0, 0, 0), scene);
        camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
        scene.activeCamera = camera;
        camera.attachControl(canvasRef, true);
        // Grille statique: aucun contrôle souris/clavier (mais on garde l'attachement pour pointerX/Y)
        camera.inputs.clear();

        const resizeOrtho = () => {
            const hw = (engine!.getRenderWidth() / 100) * orthoScale;
            const hh = (engine!.getRenderHeight() / 100) * orthoScale;
            camera!.orthoLeft = -hw;
            camera!.orthoRight = hw;
            camera!.orthoTop = hh;
            camera!.orthoBottom = -hh;
        };
		resizeOrtho();

        new HemisphericLight('light', new Vector3(0.5, 1, -0.5), scene);

        // Materials
		const matA = new StandardMaterial('matA', scene); matA.diffuseColor = new Color3(0.34, 0.18, 0.36);
        const matB = new StandardMaterial('matB', scene); matB.diffuseColor = new Color3(0.11, 0.22, 0.36);
        matA.backFaceCulling = false; matB.backFaceCulling = false;
        const matPawn = new StandardMaterial('matPawn', scene); matPawn.diffuseColor = new Color3(0.95, 0.86, 0.4); matPawn.emissiveColor = new Color3(0.4, 0.35, 0.1);

        // Build 10x10 isometric tiles (diamonds)
        const size = 1;
        const step = size * Math.SQRT2; // spacing in world X/Z between tile centers
        for (let x = 0; x < 10; x++) {
			for (let y = 0; y < 10; y++) {
                const plane = MeshBuilder.CreatePlane(`t-${x}-${y}`, { size, sideOrientation: Mesh.DOUBLESIDE }, scene);
				plane.rotation.x = Math.PI / 2; // lay flat
				plane.rotation.z = Math.PI / 4; // diamond
                plane.position.x = (x - 5) * step;
                plane.position.z = (y - 5) * step;
				plane.material = (x + y) % 2 === 0 ? matA : matB;
                plane.isPickable = true;
                (plane as any).metadata = { x, y };
			}
		}

        // Create a pawn on the center tile
        pawn = MeshBuilder.CreateSphere('pawn', { diameter: 0.55 }, scene);
        pawn.position = new Vector3(0, 0.3, 0);
        pawn.material = matPawn;
        pawn.isPickable = false; // let clicks pass through to tiles

        // Invisible pick ground covering the board (used to compute gx/gy under cursor)
        const pickGround = MeshBuilder.CreateGround('pick', { width: step * 10, height: step * 10 }, scene);
        pickGround.position.y = 0.0005; // slightly above 0
        pickGround.isVisible = false;
        pickGround.isPickable = true;

        // Hover plane & pick ground (pour convertir la souris en coord. grille)
        const hoverMat = new StandardMaterial('hoverMat', scene);
        hoverMat.diffuseColor = new Color3(1, 0.9, 0.3);
        hoverMat.emissiveColor = new Color3(0.7, 0.6, 0.2);
        hoverMat.alpha = 0.35;

        // Convert world X/Z to grid indices and back
        const worldToGrid = (x: number, z: number) => {
            const gx = Math.round(x / step + 5);
            const gy = Math.round(z / step + 5);
            return { gx: Math.min(9, Math.max(0, gx)), gy: Math.min(9, Math.max(0, gy)) };
        };
        const gridToWorld = (gx: number, gy: number) => ({ x: (gx - 5) * step, z: (gy - 5) * step });

        // Try to deduce grid coords from a tile hit first; otherwise from the invisible ground
        const pickGridAt = (cx: number, cy: number): { gx: number; gy: number } | null => {
            const pickTile = scene!.pick(cx, cy, m => (m as any).metadata?.x !== undefined && (m as any).metadata?.y !== undefined);
            if (pickTile?.hit && pickTile.pickedMesh && (pickTile.pickedMesh as any).metadata) {
                const md = (pickTile.pickedMesh as any).metadata as { x: number; y: number };
                return { gx: md.x, gy: md.y };
            }
            const pickGround = scene!.pick(cx, cy, m => m.name === 'pick');
            if (pickGround?.hit && pickGround.pickedPoint) {
                return worldToGrid(pickGround.pickedPoint.x, pickGround.pickedPoint.z);
            }
            return null;
        };

        const handleHover = (cx: number, cy: number) => {
            const grid = pickGridAt(cx, cy);
            if (!grid) { if (debugEl) debugEl.textContent = 'no hit'; return; }
            const { gx, gy } = grid;
            const p = gridToWorld(gx, gy);
            if (!hoverTile) {
                hoverTile = MeshBuilder.CreatePlane('hoverPlane', { size, sideOrientation: Mesh.DOUBLESIDE }, scene) as Mesh;
                hoverTile.rotation.x = Math.PI / 2;
                hoverTile.rotation.z = Math.PI / 4;
                hoverTile.position.y = 0.01;
                hoverTile.isPickable = false;
                hoverTile.material = hoverMat;
            }
            hoverTile.position.x = p.x;
            hoverTile.position.z = p.z;
            if (debugEl) debugEl.textContent = `hover gx=${gx} gy=${gy} | pawn gx=${pawnGX} gy=${pawnGY}`;
        };

        // Click-to-move (adjacent cells only) using pointer observable for consistent picking
        const handleClick = (cx: number, cy: number) => {
            const grid = pickGridAt(cx, cy);
            if (!grid) { if (debugEl) debugEl.textContent = 'no hit'; return; }
            const { gx, gy } = grid;
            const dx = gx - pawnGX;
            const dy = gy - pawnGY;
            if (Math.abs(dx) + Math.abs(dy) !== 1) return;

            const gpos = gridToWorld(gx, gy);
            const target = new Vector3(gpos.x, pawn!.position.y, gpos.z);
            const dur = 12; // frames
            const k = (prop: 'x' | 'z') => {
                const anim = new Animation(`a_${prop}_${Date.now()}`, `position.${prop}`, 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
                anim.setKeys([
                    { frame: 0, value: pawn!.position[prop] },
                    { frame: dur, value: target[prop] }
                ]);
                return anim;
            };
            pawn!.animations = [k('x'), k('z')];
            scene!.beginAnimation(pawn!, 0, dur, false);
            pawnGX = gx;
            pawnGY = gy;
            if (debugEl) debugEl.textContent = `click gx=${gx} gy=${gy} | pawn gx=${pawnGX} gy=${pawnGY}`;
        };

        // Canvas listeners with conversion to render-space using hardware scaling level
        const handleCanvasMove = (ev: PointerEvent) => {
            const rect = canvasRef.getBoundingClientRect();
            const scale = engine!.getHardwareScalingLevel();
            const x = (ev.clientX - rect.left) * scale;
            const y = (ev.clientY - rect.top) * scale;
            handleHover(x, y);
        };
        const handleCanvasClick = (ev: PointerEvent) => {
            const rect = canvasRef.getBoundingClientRect();
            const scale = engine!.getHardwareScalingLevel();
            const x = (ev.clientX - rect.left) * scale;
            const y = (ev.clientY - rect.top) * scale;
            handleClick(x, y);
        };
        canvasRef.addEventListener('pointermove', handleCanvasMove);
        canvasRef.addEventListener('pointerdown', handleCanvasClick);

        engine.runRenderLoop(() => scene!.render());
		window.addEventListener('resize', () => { engine!.resize(); resizeOrtho(); });
	};

	onMount(createScene);
    onCleanup(() => { engine?.dispose(); engine = null; scene = null; camera = null; });

    const zoom = (dir: 'in' | 'out') => {
        // smaller orthoScale -> zoom in; clamp to avoid extremes
        const step = 0.1;
        if (dir === 'in') orthoScale = Math.max(0.4, orthoScale - step);
        else orthoScale = Math.min(1.2, orthoScale + step);
        if (engine) {
            const event = new Event('resize');
            window.dispatchEvent(event);
        }
    };

		return (
			<div class="relative min-h-screen w-full overflow-hidden bg-brand-gradient">
				<div class="vignette absolute inset-0" />
        <main class="relative z-10 mx-auto min-h-screen max-w-none p-0">
					<header class="pointer-events-none absolute left-4 top-4 z-20">
						<h2 class="pointer-events-auto font-display text-3xl sm:text-4xl bg-clip-text text-transparent title-gradient title-shine">Partie</h2>
					</header>
					<A href="/" class="settings-btn" aria-label="Retour">←</A>
                <div class="absolute inset-0">
						<canvas ref={el => (canvasRef = el)} class="block h-full w-full" />
					</div>
                {/* Zoom controls */}
                <div class="absolute right-3 top-1/2 -translate-y-1/2 z-20 grid gap-2">
                    <button class="menu-button px-2 py-1 w-8 h-8 text-sm" onClick={() => zoom('in')}>+</button>
                    <button class="menu-button px-2 py-1 w-8 h-8 text-sm" onClick={() => zoom('out')}>−</button>
                </div>
                <div ref={el => (debugEl = el)} class="absolute left-3 bottom-3 z-20 text-xs text-slate-200/90 bg-black/40 px-2 py-1 rounded">
                    debug
                </div>
				</main>
			</div>
		);
}


