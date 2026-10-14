import * as THREE from 'three';

/**
 * Release GPU resources held by a Three.js object subtree.
 *
 * Removing an object from a scene (or calling Group.clear()) only detaches it
 * from the graph -- the geometries, materials and textures it owns stay
 * resident on the GPU until disposed explicitly. In a component that rebuilds
 * its scene whenever config changes, skipping this leaks a full scene's worth
 * of buffers on every rebuild.
 */
export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as Partial<THREE.Mesh> & Partial<THREE.Line>;

    mesh.geometry?.dispose();

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

/** Dispose a material along with any textures it references. */
function disposeMaterial(material: THREE.Material): void {
  // Texture-bearing slots vary by material type, so scan the instance rather
  // than hard-coding a list that silently misses newer maps.
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * Dispose every child of a group, then detach them.
 *
 * Use in place of a bare `group.clear()` when rebuilding scene contents.
 */
export function disposeGroupChildren(group: THREE.Object3D): void {
  for (const child of [...group.children]) {
    disposeObject3D(child);
  }
  group.clear();
}
