import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';

/**
 * The small number of mesh operations that keep sending people to Blender.
 *
 * This is not a modelling tool and does not try to be one. It does three
 * things a generated model routinely needs and nothing else: drop the floating
 * shells that single-image reconstruction leaves behind, pull a part out as its
 * own asset, and reduce triangles. Everything here works on the geometry that
 * is already loaded, so none of it costs provider credits.
 */

export interface MeshPart {
  id: string;
  /** Which mesh in the scene it came from, and which component within it. */
  meshName: string;
  triangles: number;
  /** Share of the whole model, 0–1. Tiny parts are the usual strays. */
  fraction: number;
  /** Metres, longest edge — an eyebrow shell is a couple of centimetres. */
  size: number;
  centre: [number, number, number];
}

interface Component {
  part: MeshPart;
  mesh: THREE.Mesh;
  /** Triangle indices belonging to this component. */
  faces: number[];
}

const triangleCount = (geo: THREE.BufferGeometry) =>
  (geo.index ? geo.index.count : geo.attributes.position?.count ?? 0) / 3;

/** Vertex indices of triangle `f`, whether or not the geometry is indexed. */
function face(geo: THREE.BufferGeometry, f: number): [number, number, number] {
  const i = f * 3;
  if (geo.index) return [geo.index.getX(i), geo.index.getX(i + 1), geo.index.getX(i + 2)];
  return [i, i + 1, i + 2];
}

/**
 * Group triangles into connected components.
 *
 * Vertices are welded by position first: an exported GLB usually splits them
 * per-corner for normals and UVs, so matching on index alone would report
 * every triangle as its own island.
 */
function componentsOf(mesh: THREE.Mesh, meshIndex: number): Component[] {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos) return [];
  const faces = triangleCount(geo);

  // Weld by rounded position so shared corners join up.
  const weld = new Map<string, number>();
  const canonical = new Int32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const key = `${pos.getX(v).toFixed(4)},${pos.getY(v).toFixed(4)},${pos.getZ(v).toFixed(4)}`;
    const seen = weld.get(key);
    if (seen === undefined) {
      weld.set(key, v);
      canonical[v] = v;
    } else {
      canonical[v] = seen;
    }
  }

  const parent = new Int32Array(pos.count);
  for (let v = 0; v < pos.count; v++) parent[v] = canonical[v];
  const find = (v: number): number => {
    let root = v;
    while (parent[root] !== root) root = parent[root];
    while (parent[v] !== root) {
      const next = parent[v];
      parent[v] = root;
      v = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let f = 0; f < faces; f++) {
    const [a, b, c] = face(geo, f);
    union(canonical[a], canonical[b]);
    union(canonical[b], canonical[c]);
  }

  const groups = new Map<number, number[]>();
  for (let f = 0; f < faces; f++) {
    const root = find(canonical[face(geo, f)[0]]);
    const list = groups.get(root);
    if (list) list.push(f);
    else groups.set(root, [f]);
  }

  mesh.updateWorldMatrix(true, false);
  const out: Component[] = [];
  for (const [, list] of groups) {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const f of list) {
      for (const idx of face(geo, f)) {
        v.fromBufferAttribute(pos, idx).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(v);
      }
    }
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    out.push({
      mesh,
      faces: list,
      part: {
        // Deliberately not the mesh uuid: every edit runs on a clone of the
        // scene, and cloning assigns fresh uuids, so an id built from one would
        // never match again. Position in the traversal and the component's
        // lowest face index are the same before and after a clone.
        id: `${meshIndex}:${Math.min(...list)}`,
        meshName: mesh.name || 'mesh',
        triangles: list.length,
        fraction: list.length / Math.max(1, faces),
        size: Number(Math.max(size.x, size.y, size.z).toFixed(3)),
        centre: [centre.x, centre.y, centre.z],
      },
    });
  }
  return out;
}

function allComponents(root: THREE.Object3D): Component[] {
  const out: Component[] = [];
  let meshIndex = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry?.attributes.position) {
      out.push(...componentsOf(mesh, meshIndex++));
    }
  });
  // Largest first, and ties broken by id so the order cannot shuffle between
  // listing the parts and acting on the one that was picked.
  return out.sort(
    (a, b) => b.part.triangles - a.part.triangles || a.part.id.localeCompare(b.part.id),
  );
}

/** Every separate piece of the model, largest first. */
export const listParts = (root: THREE.Object3D): MeshPart[] =>
  allComponents(root).map((c) => c.part);

/**
 * Rebuild one mesh's geometry from a subset of its triangles, carrying every
 * attribute across — skinning included, so a rigged model survives the edit.
 */
function geometryFromFaces(mesh: THREE.Mesh, faces: number[]): THREE.BufferGeometry {
  const source = mesh.geometry;
  const next = new THREE.BufferGeometry();
  const kept: number[] = [];
  const remap = new Map<number, number>();

  for (const f of faces) {
    for (const idx of face(source, f)) {
      if (!remap.has(idx)) {
        remap.set(idx, kept.length);
        kept.push(idx);
      }
    }
  }

  for (const [name, attr] of Object.entries(source.attributes)) {
    const a = attr as THREE.BufferAttribute;
    const size = a.itemSize;
    const data = new Float32Array(kept.length * size);
    for (let i = 0; i < kept.length; i++) {
      for (let c = 0; c < size; c++) {
        data[i * size + c] = a.array[kept[i] * size + c] as number;
      }
    }
    // Skin indices must stay integers or the skeleton binds to the wrong bones.
    next.setAttribute(
      name,
      name === 'skinIndex'
        ? new THREE.Uint16BufferAttribute(Uint16Array.from(data), size)
        : new THREE.Float32BufferAttribute(data, size),
    );
  }

  const index: number[] = [];
  for (const f of faces) for (const idx of face(source, f)) index.push(remap.get(idx)!);
  next.setIndex(index);
  next.computeVertexNormals();
  return next;
}

const exportGlb = (scene: THREE.Object3D): Promise<Blob> =>
  new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      scene,
      (result) => resolve(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })),
      reject,
      { binary: true },
    );
  });

/** The model with the named parts removed. */
export async function removeParts(root: THREE.Object3D, remove: string[]): Promise<Blob> {
  const drop = new Set(remove);
  const components = allComponents(root);
  const byMesh = new Map<THREE.Mesh, Component[]>();
  for (const c of components) {
    const list = byMesh.get(c.mesh) ?? [];
    list.push(c);
    byMesh.set(c.mesh, list);
  }

  for (const [mesh, list] of byMesh) {
    const keep = list.filter((c) => !drop.has(c.part.id));
    if (keep.length === list.length) continue;
    if (!keep.length) {
      mesh.parent?.remove(mesh);
      continue;
    }
    mesh.geometry = geometryFromFaces(
      mesh,
      keep.flatMap((c) => c.faces),
    );
  }
  return exportGlb(root);
}

/** One part on its own, centred on the ground, as a standalone model. */
export async function extractPart(root: THREE.Object3D, partId: string): Promise<Blob | null> {
  const found = allComponents(root).find((c) => c.part.id === partId);
  if (!found) return null;

  const geo = geometryFromFaces(found.mesh, found.faces);
  const material = Array.isArray(found.mesh.material)
    ? found.mesh.material[0]
    : found.mesh.material;
  const piece = new THREE.Mesh(geo, material);
  piece.applyMatrix4(found.mesh.matrixWorld);
  piece.name = found.part.meshName || 'part';

  // Sit it at the origin so it arrives framed rather than off in space.
  const box = new THREE.Box3().setFromObject(piece);
  const centre = box.getCenter(new THREE.Vector3());
  piece.position.x -= centre.x;
  piece.position.z -= centre.z;
  piece.position.y -= box.min.y;

  const scene = new THREE.Scene();
  scene.add(piece);
  return exportGlb(scene);
}

/**
 * Fewer triangles, same shape.
 *
 * Refuses a skinned mesh on purpose: the simplifier rebuilds vertices without
 * carrying skin weights, so it would quietly unbind a rigged model.
 */
export async function decimate(root: THREE.Object3D, keep: number): Promise<Blob> {
  const ratio = Math.min(0.95, Math.max(0.05, keep));
  const modifier = new SimplifyModifier();
  let skinned = false;

  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) {
      skinned = true;
      return;
    }
    const count = triangleCount(mesh.geometry);
    const drop = Math.floor(mesh.geometry.attributes.position.count * (1 - ratio));
    if (count > 100 && drop > 0) mesh.geometry = modifier.modify(mesh.geometry, drop);
  });

  if (skinned) {
    throw new Error(
      'This model is rigged, and simplifying would drop its skin weights. Reduce triangles before rigging, or in your engine on import.',
    );
  }
  return exportGlb(root);
}
