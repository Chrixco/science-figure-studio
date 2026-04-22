import * as THREE from 'three';

/**
 * 3D Interaction System
 * Raycasting-based hover and click detection for interactive 3D objects
 */

export interface InteractionManager {
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  hoveredCellId: string | null;

  updateMousePosition(x: number, y: number, canvas: HTMLCanvasElement): void;
  detectHover(cellGroup: THREE.Group, camera: THREE.Camera): string | null;
  detectClick(cellGroup: THREE.Group, camera: THREE.Camera): string | null;
}

/**
 * Create a new interaction manager for 3D raycasting
 */
export function createInteractionManager(): InteractionManager {
  return {
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    hoveredCellId: null,

    updateMousePosition(x: number, y: number, canvas: HTMLCanvasElement): void {
      // Convert screen coordinates to normalized device coordinates (-1 to 1)
      const rect = canvas.getBoundingClientRect();
      const normalizedX = ((x - rect.left) / rect.width) * 2 - 1;
      const normalizedY = -((y - rect.top) / rect.height) * 2 + 1;

      this.mouse.x = normalizedX;
      this.mouse.y = normalizedY;
    },

    detectHover(cellGroup: THREE.Group, camera: THREE.Camera): string | null {
      // Update raycaster with current mouse position
      this.raycaster.setFromCamera(this.mouse, camera);

      // Get all meshes in the cell group
      const allChildren: THREE.Object3D[] = [];
      cellGroup.traverse((obj) => {
        allChildren.push(obj);
      });

      // Filter to only include living cell meshes (the main sphere)
      const interactableMeshes = allChildren.filter(
        (obj) =>
          obj instanceof THREE.Mesh &&
          obj.name === 'living' &&
          obj.userData.cellId
      );

      // Perform raycasting
      const intersects = this.raycaster.intersectObjects(interactableMeshes);

      if (intersects.length > 0) {
        const firstIntersect = intersects[0];
        const cellId = (firstIntersect.object.userData.cellId as string) || null;
        this.hoveredCellId = cellId;
        return cellId;
      }

      this.hoveredCellId = null;
      return null;
    },

    detectClick(cellGroup: THREE.Group, camera: THREE.Camera): string | null {
      // Similar to detectHover, but performed at click time
      // This allows consistent detection logic
      return this.detectHover(cellGroup, camera);
    }
  };
}
