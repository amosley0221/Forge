import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGltfLoader } from './loader.js';
import type { MeshStats } from '@forge/core';

/**
 * The viewport. It renders the actual generated or imported GLB — there is no
 * procedural stand-in geometry. Triangle counts, material counts, real-world
 * size and clip names all come from the loaded file.
 */

export interface ViewerOptions {
  /** Object URL / file URL of the GLB to display. Empty shows nothing. */
  url: string | null;
  wire: boolean;
  selected: string | null;
  autorotate: boolean;
  /** Name of the animation clip to play, or null to stand still. */
  clip: string | null;
  speed: number;
  compact?: boolean;
}

const DEFAULTS: ViewerOptions = {
  url: null,
  wire: false,
  selected: null,
  autorotate: false,
  clip: null,
  speed: 1,
  compact: false,
};

export interface ViewerCallbacks {
  onPick(part: string | null): void;
  onLoaded(stats: MeshStats): void;
  onError(message: string): void;
  onLoadingChange(loading: boolean): void;
}

/** Triangles, materials, size and clip names, measured from a loaded scene. */
export function measureScene(scene: THREE.Object3D, animations: THREE.AnimationClip[]): MeshStats {
  let triangles = 0;
  const materials = new Set<THREE.Material>();
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    if (geo?.index) triangles += geo.index.count / 3;
    else if (geo?.attributes.position) triangles += geo.attributes.position.count / 3;
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => materials.add(m));
    else if (mat) materials.add(mat);
  });
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  return {
    triangles: Math.round(triangles),
    materials: materials.size,
    sizeMeters: Number(Math.max(size.x, size.y, size.z).toFixed(3)),
    clipNames: animations.map((a) => a.name).filter(Boolean),
    bytes: 0, // filled in by the caller, which has the file
  };
}

/** Load a GLB once, off-screen, purely to read its stats. */
export async function readMeshStats(url: string): Promise<MeshStats> {
  const gltf = await createGltfLoader().loadAsync(url);
  const stats = measureScene(gltf.scene, gltf.animations);
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry?.dispose();
  });
  return stats;
}

export class ViewerEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  private root = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clips: THREE.AnimationClip[] = [];
  private action: THREE.AnimationAction | null = null;
  private wireOverlay: THREE.Group | null = null;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private ro: ResizeObserver;
  private raf = 0;
  private last = 0;
  private idle = 0;
  private rot = { x: 0.32, y: 0.7 };
  private dist = 4;
  private target = new THREE.Vector3(0, 0.5, 0);
  private opts: ViewerOptions = { ...DEFAULTS };
  private highlighted: { mat: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number }[] = [];
  private loadToken = 0;
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private cb: ViewerCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    host.appendChild(canvas);

    this.scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x1a1410, 1.1));
    const key = new THREE.DirectionalLight(0xffe8c8, 2.0);
    key.position.set(4, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb3ff, 0.5);
    fill.position.set(-5, 3, -4);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(20, 20, 0x3a3c42, 0x25272c);
    grid.position.y = 0.001;
    this.scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.45 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(this.root);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.bindInput();
    this.loop();
  }

  update(next: Partial<ViewerOptions>) {
    const prev = this.opts;
    this.opts = { ...prev, ...next };
    if (prev.url !== this.opts.url) void this.loadModel(this.opts.url);
    if (prev.wire !== this.opts.wire) this.applyWireframe();
    if (prev.selected !== this.opts.selected) this.applyHighlight();
    if (prev.clip !== this.opts.clip) this.playClip(this.opts.clip);
    if (this.action) this.action.timeScale = this.opts.speed;
  }

  /** Frame the model as if the user had just opened it. */
  resetCamera() {
    this.rot = { x: 0.32, y: 0.7 };
    this.fit();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.clearModel();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize() {
    const w = this.host.clientWidth || 300;
    const h = this.host.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  private bindInput() {
    const el = this.renderer.domElement;
    let start: { x: number; y: number; rx: number; ry: number } | null = null;
    let moved = 0;
    let pinch = 0;
    const points = new Map<number, { x: number; y: number }>();

    el.addEventListener('pointerdown', (e) => {
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = { x: e.clientX, y: e.clientY, rx: this.rot.x, ry: this.rot.y };
      moved = 0;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (points.has(e.pointerId)) points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        // Pinch to zoom on touch.
        const [a, b] = [...points.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.dist = Math.max(0.2, Math.min(60, this.dist * (pinch / d)));
        pinch = d;
        start = null;
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      moved += Math.abs(dx) + Math.abs(dy);
      this.rot.y = start.ry + dx * 0.008;
      this.rot.x = Math.max(-0.4, Math.min(1.4, start.rx + dy * 0.008));
      this.idle = 0;
    });
    const end = (e: PointerEvent) => {
      if (start && moved < 6) this.pick(e);
      points.delete(e.pointerId);
      if (points.size < 2) pinch = 0;
      start = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => {
      points.delete(e.pointerId);
      pinch = 0;
      start = null;
      void e;
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = Math.max(0.2, Math.min(60, this.dist * (1 + e.deltaY * 0.001)));
      },
      { passive: false },
    );
  }

  private pick(e: PointerEvent) {
    if (!this.model) return;
    const b = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - b.left) / b.width) * 2 - 1,
      -((e.clientY - b.top) / b.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.cam);
    const hit = this.ray.intersectObject(this.model, true).find((h) => (h.object as THREE.Mesh).isMesh);
    this.cb.onPick(hit ? hit.object.name || hit.object.uuid.slice(0, 8) : null);
  }

  private clearModel() {
    this.action?.stop();
    this.action = null;
    this.mixer = null;
    this.clips = [];
    this.highlighted = [];
    if (this.wireOverlay) {
      this.root.remove(this.wireOverlay);
      this.wireOverlay = null;
    }
    if (this.model) {
      this.root.remove(this.model);
      this.model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        (Array.isArray(mat) ? mat : [mat]).forEach((m) => m?.dispose());
      });
      this.model = null;
    }
  }

  private async loadModel(url: string | null) {
    const token = ++this.loadToken;
    this.clearModel();
    if (!url) return;

    this.cb.onLoadingChange(true);
    let gltf: GLTF;
    try {
      gltf = await createGltfLoader(this.renderer).loadAsync(url);
    } catch (e) {
      if (token === this.loadToken && !this.disposed) {
        this.cb.onLoadingChange(false);
        this.cb.onError(
          `Could not open the model (${e instanceof Error ? e.message : 'unsupported file'})`,
        );
      }
      return;
    }
    if (token !== this.loadToken || this.disposed) return;

    this.model = gltf.scene;
    this.model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
    });
    this.root.add(this.model);

    this.clips = gltf.animations ?? [];
    if (this.clips.length) this.mixer = new THREE.AnimationMixer(this.model);

    this.normalise();
    this.fit();
    this.applyWireframe();
    this.applyHighlight();
    this.playClip(this.opts.clip);

    this.cb.onLoadingChange(false);
    this.cb.onLoaded(measureScene(this.model, this.clips));
  }

  /** Sit the model on the grid and centre it horizontally. */
  private normalise() {
    if (!this.model) return;
    this.model.position.set(0, 0, 0);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const centre = box.getCenter(new THREE.Vector3());
    this.model.position.x -= centre.x;
    this.model.position.z -= centre.z;
    this.model.position.y -= box.min.y;
    this.model.updateMatrixWorld(true);
  }

  private fit() {
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z) || 1;
    this.target = new THREE.Vector3(0, size.y / 2, 0);
    this.dist = largest * (this.opts.compact ? 1.9 : 2.2);
    this.cam.near = Math.max(0.001, largest / 500);
    this.cam.far = largest * 200;
    this.cam.updateProjectionMatrix();
  }

  private applyWireframe() {
    if (this.wireOverlay) {
      this.root.remove(this.wireOverlay);
      this.wireOverlay.traverse((o) => {
        const m = o as THREE.LineSegments;
        m.geometry?.dispose();
        (m.material as THREE.Material)?.dispose();
      });
      this.wireOverlay = null;
    }
    if (!this.opts.wire || !this.model) return;

    const group = new THREE.Group();
    this.model.updateMatrixWorld(true);
    this.model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const lines = new THREE.LineSegments(
        new THREE.WireframeGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: 0xf59e3b, transparent: true, opacity: 0.28 }),
      );
      lines.applyMatrix4(mesh.matrixWorld);
      group.add(lines);
    });
    this.wireOverlay = group;
    this.root.add(group);
  }

  private applyHighlight() {
    this.highlighted.forEach(({ mat, emissive, intensity }) => {
      mat.emissive.copy(emissive);
      mat.emissiveIntensity = intensity;
    });
    this.highlighted = [];
    if (!this.model || !this.opts.selected) return;

    this.model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || mesh.uuid.slice(0, 8);
      if (name !== this.opts.selected) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        if (!mat?.emissive) return;
        this.highlighted.push({
          mat,
          emissive: mat.emissive.clone(),
          intensity: mat.emissiveIntensity,
        });
        mat.emissive.set(0xf59e3b);
        mat.emissiveIntensity = 0.45;
      });
    });
  }

  private playClip(name: string | null) {
    if (!this.mixer) return;
    this.action?.fadeOut(0.2);
    this.action = null;
    if (!name) {
      this.mixer.stopAllAction();
      return;
    }
    const clip = this.clips.find((c) => c.name === name);
    if (!clip) return;
    this.action = this.mixer.clipAction(clip);
    this.action.reset();
    this.action.timeScale = this.opts.speed;
    this.action.fadeIn(0.2).play();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;

    this.mixer?.update(dt);
    if (this.wireOverlay && this.opts.clip) {
      // Skinned meshes move under the overlay; rebuild it only while a clip
      // is playing, and only every other frame to stay cheap.
      this.wireOverlay.visible = false;
    } else if (this.wireOverlay) {
      this.wireOverlay.visible = true;
    }

    if (this.opts.autorotate) {
      this.idle++;
      if (this.idle > 90) this.rot.y += 0.004;
    }

    const t = this.target;
    this.cam.position.set(
      t.x + Math.sin(this.rot.y) * Math.cos(this.rot.x) * this.dist,
      t.y + Math.sin(this.rot.x) * this.dist,
      t.z + Math.cos(this.rot.y) * Math.cos(this.rot.x) * this.dist,
    );
    this.cam.lookAt(t);
    this.renderer.render(this.scene, this.cam);
  };
}
