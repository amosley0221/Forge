import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
  /**
   * Drag a limb to bend it instead of orbiting the camera. Needs a rigged
   * model — without a skeleton there is nothing to bend.
   */
  pose?: boolean;
}

const DEFAULTS: ViewerOptions = {
  url: null,
  wire: false,
  selected: null,
  autorotate: false,
  clip: null,
  speed: 1,
  compact: false,
  pose: false,
};

export interface ViewerCallbacks {
  onPick(part: string | null): void;
  /** Whether the loaded file has a skeleton, i.e. whether posing is possible. */
  onSkeleton?(rigged: boolean): void;
  /** The bone currently being dragged, for a label in the UI. */
  onPoseBone?(name: string | null): void;
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
  private pmrem: THREE.PMREMGenerator;
  private envMap: THREE.Texture;
  private skinned: THREE.SkinnedMesh[] = [];
  /** Every bone's transform as the file authored it, so a pose can be undone. */
  private restPose: { bone: THREE.Bone; quaternion: THREE.Quaternion }[] = [];
  private drag: {
    /** The joint being rotated — the parent of the bone that was grabbed. */
    pivot: THREE.Object3D;
    pivotWorld: THREE.Vector3;
    /** Direction from the joint to the grab point when the drag started. */
    fromDir: THREE.Vector3;
    startWorldQuat: THREE.Quaternion;
    plane: THREE.Plane;
  } | null = null;

  constructor(
    private host: HTMLElement,
    private cb: ViewerCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Generated models are PBR (metal/roughness). Lit by direct lights alone
    // they read as harsh plastic and every normal-map wrinkle turns into hard
    // ribbing, which is not how the file will look in an engine. Filmic tone
    // mapping stops highlights clipping to flat white.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    host.appendChild(canvas);

    // Image-based lighting: a roughness-aware surface needs something to
    // reflect. Without it metals render black and roughness reads wrong.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;

    // Direct lights now shape the model rather than doing all the work, so
    // they are dialled back to sit alongside the environment.
    this.scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x1a1410, 0.5));
    const key = new THREE.DirectionalLight(0xffe8c8, 1.4);
    key.position.set(4, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb3ff, 0.35);
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
    if (prev.pose !== this.opts.pose) {
      // A playing clip writes over every bone each frame, so posing and
      // playback cannot both be on. Leaving pose mode restores the clip.
      if (this.opts.pose) this.playClip(null);
      else if (this.opts.clip) this.playClip(this.opts.clip);
      this.drag = null;
      this.cb.onPoseBone?.(null);
      this.renderer.domElement.style.cursor = this.opts.pose ? 'crosshair' : 'grab';
    }
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
    this.scene.environment = null;
    this.envMap.dispose();
    this.pmrem.dispose();
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
      el.setPointerCapture(e.pointerId);
      moved = 0;
      // In pose mode a press that lands on the model grabs a limb; a press on
      // empty space still orbits, so the camera is never locked away.
      if (this.opts.pose && points.size === 1 && this.beginPose(e)) {
        start = null;
        return;
      }
      start = { x: e.clientX, y: e.clientY, rx: this.rot.x, ry: this.rot.y };
    });
    el.addEventListener('pointermove', (e) => {
      if (points.has(e.pointerId)) points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.drag) {
        this.dragPose(e);
        return;
      }
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
      if (this.drag) {
        this.drag = null;
        this.cb.onPoseBone?.(null);
        this.applyWireframe();
      } else if (start && moved < 6) {
        this.pick(e);
      }
      points.delete(e.pointerId);
      if (points.size < 2) pinch = 0;
      start = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => {
      points.delete(e.pointerId);
      pinch = 0;
      start = null;
      this.drag = null;
      this.cb.onPoseBone?.(null);
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

  /**
   * Which bone the user actually grabbed.
   *
   * A skinned vertex is influenced by up to four bones, so the one that owns
   * the click is the one with the largest weight at the nearest vertex of the
   * hit triangle. Grabbing the hand therefore reports the hand bone.
   */
  private boneAt(hit: THREE.Intersection): THREE.Bone | null {
    const mesh = hit.object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !hit.face || !mesh.skeleton) return null;

    const skinIndex = mesh.geometry.attributes.skinIndex;
    const skinWeight = mesh.geometry.attributes.skinWeight;
    if (!skinIndex || !skinWeight) return null;

    let bestBone: THREE.Bone | null = null;
    let bestWeight = 0;
    for (const vertex of [hit.face.a, hit.face.b, hit.face.c]) {
      for (const slot of ['x', 'y', 'z', 'w'] as const) {
        const weight = skinWeight[`get${slot.toUpperCase()}` as 'getX'](vertex);
        if (weight <= bestWeight) continue;
        const bone = mesh.skeleton.bones[skinIndex[`get${slot.toUpperCase()}` as 'getX'](vertex)];
        if (!bone) continue;
        bestWeight = weight;
        bestBone = bone;
      }
    }
    return bestBone;
  }

  /**
   * Start a pose drag. Returns false when the press missed the model, which
   * lets the same gesture fall through to orbiting.
   */
  private beginPose(e: PointerEvent): boolean {
    if (!this.model || !this.skinned.length) return false;

    const b = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - b.left) / b.width) * 2 - 1,
      -((e.clientY - b.top) / b.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.cam);
    const hit = this.ray.intersectObjects(this.skinned, true)[0];
    if (!hit) return false;

    const grabbed = this.boneAt(hit);
    if (!grabbed) return false;

    // Rotate the joint above what was grabbed: pulling a hand should bend the
    // elbow, not spin the wrist in place. A root bone has nothing above it, so
    // it rotates itself.
    const parent = grabbed.parent;
    const pivot = parent && (parent as THREE.Bone).isBone ? parent : grabbed;

    const pivotWorld = pivot.getWorldPosition(new THREE.Vector3());
    const fromDir = hit.point.clone().sub(pivotWorld);
    if (fromDir.lengthSq() < 1e-8) return false;

    const normal = this.cam.getWorldDirection(new THREE.Vector3());
    this.drag = {
      pivot,
      pivotWorld,
      fromDir: fromDir.normalize(),
      startWorldQuat: pivot.getWorldQuaternion(new THREE.Quaternion()),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point),
    };
    this.cb.onPoseBone?.(grabbed.name || 'limb');
    return true;
  }

  /** Swing the grabbed joint so the limb follows the pointer. */
  private dragPose(e: PointerEvent) {
    const drag = this.drag;
    if (!drag) return;

    const b = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - b.left) / b.width) * 2 - 1,
      -((e.clientY - b.top) / b.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.cam);

    // Drag across the plane facing the camera through the grab point, so the
    // limb tracks the cursor rather than swinging off into depth.
    const target = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(drag.plane, target)) return;

    const toDir = target.sub(drag.pivotWorld);
    if (toDir.lengthSq() < 1e-8) return;
    toDir.normalize();

    // The rotation that takes the limb's original direction to the new one,
    // expressed in world space and then brought back into the joint's parent.
    const swing = new THREE.Quaternion().setFromUnitVectors(drag.fromDir, toDir);
    const world = swing.multiply(drag.startWorldQuat);

    const parentWorld = drag.pivot.parent
      ? drag.pivot.parent.getWorldQuaternion(new THREE.Quaternion())
      : new THREE.Quaternion();
    drag.pivot.quaternion.copy(parentWorld.invert().multiply(world));
    drag.pivot.updateMatrixWorld(true);
    this.idle = 0;
  }

  /** Put every bone back where the file had it. */
  resetPose() {
    this.restPose.forEach(({ bone, quaternion }) => bone.quaternion.copy(quaternion));
    this.model?.updateMatrixWorld(true);
    this.drag = null;
    this.cb.onPoseBone?.(null);
    this.applyWireframe();
  }

  /** Whether the loaded file can be posed at all. */
  get rigged(): boolean {
    return this.skinned.length > 0;
  }

  private clearModel() {
    this.action?.stop();
    this.action = null;
    this.mixer = null;
    this.clips = [];
    this.highlighted = [];
    this.skinned = [];
    this.restPose = [];
    this.drag = null;
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

    this.skinned = [];
    const bones = new Set<THREE.Bone>();
    this.model.traverse((obj) => {
      const skin = obj as THREE.SkinnedMesh;
      if (!skin.isSkinnedMesh || !skin.skeleton) return;
      this.skinned.push(skin);
      skin.skeleton.bones.forEach((bone) => bones.add(bone));
    });
    this.restPose = [...bones].map((bone) => ({ bone, quaternion: bone.quaternion.clone() }));
    this.cb.onSkeleton?.(this.skinned.length > 0);

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
