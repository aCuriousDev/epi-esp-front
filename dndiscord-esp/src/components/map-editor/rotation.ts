import type { AbstractMesh } from '@babylonjs/core';

/**
 * Apply an additive Y-axis rotation (in degrees) to a mesh. glTF roots
 * arrive with `rotationQuaternion` set, which silently ignores writes to
 * `rotation.y` — so we convert to Euler first.
 *
 * This replaces three duplicated quaternion-unwrap blocks that lived in
 * MapEditor.tsx.
 */
export function applyRotationYDegrees(mesh: AbstractMesh, degrees: number): void {
  const radians = (degrees * Math.PI) / 180;
  if (mesh.rotationQuaternion) {
    const euler = mesh.rotationQuaternion.toEulerAngles();
    mesh.rotationQuaternion = null;
    mesh.rotation.y = euler.y + radians;
  } else {
    mesh.rotation.y = radians;
  }
}

/**
 * Set the mesh's Y rotation directly (in radians) regardless of whether
 * it was authored with a quaternion.
 */
export function setRotationYRadians(mesh: AbstractMesh, radians: number): void {
  if (mesh.rotationQuaternion) {
    mesh.rotationQuaternion = null;
  }
  mesh.rotation.y = radians;
}
