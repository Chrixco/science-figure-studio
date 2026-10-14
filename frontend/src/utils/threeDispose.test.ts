import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject3D, disposeGroupChildren } from './threeDispose';

function makeMesh() {
  const geometry = new THREE.CircleGeometry(1, 8);
  const texture = new THREE.CanvasTexture(document.createElement('canvas'));
  const material = new THREE.MeshBasicMaterial({ map: texture });
  return { mesh: new THREE.Mesh(geometry, material), geometry, material, texture };
}

describe('disposeObject3D', () => {
  it('disposes geometry, material and the material textures', () => {
    const { mesh, geometry, material, texture } = makeMesh();
    const geoSpy = vi.spyOn(geometry, 'dispose');
    const matSpy = vi.spyOn(material, 'dispose');
    const texSpy = vi.spyOn(texture, 'dispose');

    disposeObject3D(mesh);

    expect(geoSpy).toHaveBeenCalledOnce();
    expect(matSpy).toHaveBeenCalledOnce();
    expect(texSpy).toHaveBeenCalledOnce();
  });

  it('recurses into descendants', () => {
    const parent = new THREE.Group();
    const { mesh, geometry } = makeMesh();
    const child = new THREE.Group();
    child.add(mesh);
    parent.add(child);
    const geoSpy = vi.spyOn(geometry, 'dispose');

    disposeObject3D(parent);

    expect(geoSpy).toHaveBeenCalledOnce();
  });

  it('handles an array of materials', () => {
    const geometry = new THREE.BufferGeometry();
    const a = new THREE.MeshBasicMaterial();
    const b = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, [a, b]);
    const aSpy = vi.spyOn(a, 'dispose');
    const bSpy = vi.spyOn(b, 'dispose');

    disposeObject3D(mesh);

    expect(aSpy).toHaveBeenCalledOnce();
    expect(bSpy).toHaveBeenCalledOnce();
  });

  it('tolerates objects that own neither geometry nor material', () => {
    expect(() => disposeObject3D(new THREE.Group())).not.toThrow();
  });
});

describe('disposeGroupChildren', () => {
  it('disposes every child and empties the group', () => {
    const group = new THREE.Group();
    const spies = Array.from({ length: 3 }, () => {
      const { mesh, geometry } = makeMesh();
      group.add(mesh);
      return vi.spyOn(geometry, 'dispose');
    });

    disposeGroupChildren(group);

    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    expect(group.children).toHaveLength(0);
  });

  it('leaves the group itself reusable', () => {
    const group = new THREE.Group();
    group.add(makeMesh().mesh);

    disposeGroupChildren(group);
    group.add(makeMesh().mesh);

    expect(group.children).toHaveLength(1);
  });

  // The pre-fix code called group.clear() directly, which detaches children
  // without freeing their GPU buffers. This pins the difference.
  it('frees resources that a bare clear() would leak', () => {
    const leaky = new THREE.Group();
    const { mesh: leakyMesh, geometry: leakyGeometry } = makeMesh();
    leaky.add(leakyMesh);
    const leakySpy = vi.spyOn(leakyGeometry, 'dispose');
    leaky.clear();
    expect(leakySpy).not.toHaveBeenCalled();

    const clean = new THREE.Group();
    const { mesh: cleanMesh, geometry: cleanGeometry } = makeMesh();
    clean.add(cleanMesh);
    const cleanSpy = vi.spyOn(cleanGeometry, 'dispose');
    disposeGroupChildren(clean);
    expect(cleanSpy).toHaveBeenCalledOnce();
  });
});
