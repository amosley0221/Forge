import * as THREE from 'three';
import type { ClipName, Kind } from '@forge/core';

/**
 * Viewport engine. Meshes are procedural stand-ins for generated geometry —
 * swap `build()` for a GLTFLoader once assets carry a real `fileUrl`; the
 * camera, lighting, picking and clip playback around it stay as they are.
 * Parts are named so raycast picking can scope a prompt to one of them.
 */

const C = {
  rust: 0x9a6a3a,
  dark: 0x2b2b2b,
  metal: 0x6d6f75,
  accent: 0xf59e3b,
  skin: 0xd9b48a,
  cloth: 0x4a5a3a,
  leather: 0x5a3d24,
  stone: 0xb59a72,
  steel: 0x8e97a3,
  ember: 0xd9642b,
  belly: 0xf1d9a8,
  teal: 0x3f9a8c,
};

export interface ViewerOptions {
  kind: Kind;
  version: number;
  variant: number;
  wire: boolean;
  selected: string | null;
  autorotate: boolean;
  anim: ClipName;
  speed: number;
  compact?: boolean;
}

const DEFAULTS: ViewerOptions = {
  kind: 'prop',
  version: 1,
  variant: 0,
  wire: false,
  selected: null,
  autorotate: false,
  anim: 'idle',
  speed: 1,
  compact: false,
};

export class ViewerEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private group = new THREE.Group();
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private ro: ResizeObserver;
  private raf = 0;
  private last = 0;
  private t = 0;
  private idle = 0;
  private rot = { x: 0.42, y: 0.7 };
  private dist = 7;
  private target = new THREE.Vector3(0, 1, 0);
  private parts: Record<string, THREE.Mesh[]> = {};
  private opts: ViewerOptions = { ...DEFAULTS };
  private disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  constructor(
    private host: HTMLElement,
    private onPick: (part: string | null) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
    host.appendChild(canvas);

    this.scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x1a1410, 0.9));
    const key = new THREE.DirectionalLight(0xffe8c8, 1.6);
    key.position.set(4, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb3ff, 0.4);
    fill.position.set(-5, 3, -4);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(20, 20, 0x3a3c42, 0x25272c);
    grid.position.y = 0.001;
    this.scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.45 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(this.group);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.bindInput();
    this.build();
    this.loop();
  }

  update(next: Partial<ViewerOptions>) {
    const prev = this.opts;
    this.opts = { ...prev, ...next };
    const rebuild =
      prev.kind !== this.opts.kind ||
      prev.version !== this.opts.version ||
      prev.variant !== this.opts.variant ||
      prev.wire !== this.opts.wire ||
      prev.selected !== this.opts.selected;
    if (rebuild) this.build();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.clearGroup();
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
    el.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY, rx: this.rot.x, ry: this.rot.y };
      moved = 0;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      moved += Math.abs(dx) + Math.abs(dy);
      this.rot.y = start.ry + dx * 0.008;
      this.rot.x = Math.max(-0.2, Math.min(1.3, start.rx + dy * 0.008));
      this.idle = 0;
    });
    el.addEventListener('pointerup', (e) => {
      if (start && moved < 6) this.pick(e);
      start = null;
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = Math.max(2.5, Math.min(16, this.dist * (1 + e.deltaY * 0.001)));
      },
      { passive: false },
    );
  }

  private pick(e: PointerEvent) {
    const b = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - b.left) / b.width) * 2 - 1,
      -((e.clientY - b.top) / b.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.cam);
    const hit = this.ray
      .intersectObjects(this.group.children, true)
      .find((h) => (h.object as THREE.Mesh).userData.part);
    this.onPick(hit ? ((hit.object as THREE.Mesh).userData.part as string) : null);
  }

  private clearGroup() {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.parts = {};
  }

  private mesh(
    geo: THREE.BufferGeometry,
    color: number,
    part: string,
    x = 0,
    y = 0,
    z = 0,
  ): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      metalness: 0.1,
      flatShading: true,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    m.userData.part = part;
    m.userData.base = { x, y, z };
    this.group.add(m);
    (this.parts[part] = this.parts[part] || []).push(m);
    this.disposables.push(geo, mat);
    return m;
  }

  private build() {
    this.clearGroup();
    const { kind, wire, selected } = this.opts;
    const v = Math.max(1, this.opts.version);
    const variant = this.opts.variant;
    const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
    const Cy = (r: number, h: number, n = 12) => new THREE.CylinderGeometry(r, r, h, n);
    const Sp = (r: number) => new THREE.SphereGeometry(r, 12, 8);
    const Co = (r: number, h: number, n: number) => new THREE.ConeGeometry(r, h, n);

    if (kind === 'vehicle') {
      const ws = 1 + (v - 1) * 0.12;
      this.mesh(B(3.2, 0.7, 1.6), C.rust, 'body', 0, 0.9, 0);
      this.mesh(B(1.2, 0.6, 1.3), C.dark, 'cabin', 0.6, 1.55, 0);
      (
        [
          [-1.1, 0.7],
          [0, 0.7],
          [1.1, 0.7],
          [-1.1, -0.7],
          [0, -0.7],
          [1.1, -0.7],
        ] as [number, number][]
      ).forEach(([x, z], i) => {
        const m = this.mesh(Cy(0.42 * (x > 0.5 ? ws : 1), 0.35, 14), C.dark, 'wheel_' + i, x, 0.45, z);
        m.rotation.x = Math.PI / 2;
        m.userData.wheel = true;
      });
      this.mesh(Cy(0.03, 1.4, 6), C.metal, 'antenna', -1.3, 2.0, -0.5);
      if (v >= 2) {
        this.mesh(Cy(0.35, 0.3, 10), C.metal, 'turret', -0.6, 1.4, 0);
        this.mesh(B(0.9, 0.12, 0.12), C.dark, 'turret', -0.2, 1.5, 0);
      }
    } else if (kind === 'character') {
      this.mesh(B(0.9, 1.1, 0.5), C.cloth, 'torso', 0, 1.75, 0);
      this.mesh(Sp(0.32), C.skin, 'head', 0, 2.65, 0);
      this.mesh(B(0.3, 1.0, 0.3), C.leather, 'leg_L', -0.25, 0.6, 0);
      this.mesh(B(0.3, 1.0, 0.3), C.leather, 'leg_R', 0.25, 0.6, 0);
      this.mesh(B(0.26, 1.0, 0.26), C.skin, 'arm_L', -0.62, 1.75, 0);
      this.mesh(B(0.26, 1.0, 0.26), C.skin, 'arm_R', 0.62, 1.75, 0);
      if (v >= 2) {
        this.mesh(Sp(0.3), C.steel, 'shoulder_L', -0.6, 2.3, 0);
        this.mesh(B(0.95, 0.2, 0.55), C.steel, 'torso', 0, 2.25, 0);
      }
    } else if (kind === 'creature') {
      const hue = [C.ember, C.teal, 0x8a6bd6, 0x6da34d, 0xd6b13f][variant % 5];
      this.mesh(Sp(0.62), hue, 'body', 0, 0.95, 0).scale.set(1.35, 1, 1);
      this.mesh(Sp(0.45), C.belly, 'belly', 0.1, 0.8, 0).scale.set(1, 0.8, 0.9);
      this.mesh(Sp(0.42), hue, 'head', 0.95, 1.35, 0);
      this.mesh(Sp(0.08), C.dark, 'eye', 1.25, 1.45, 0.2);
      this.mesh(Sp(0.08), C.dark, 'eye', 1.25, 1.45, -0.2);
      this.mesh(Co(0.14, 0.4, 6), hue, 'ear_L', 0.95, 1.8, 0.22);
      this.mesh(Co(0.14, 0.4, 6), hue, 'ear_R', 0.95, 1.8, -0.22);
      (
        [
          [0.5, 0.3, 'leg_FL'],
          [0.5, -0.3, 'leg_FR'],
          [-0.5, 0.3, 'leg_BL'],
          [-0.5, -0.3, 'leg_BR'],
        ] as [number, number, string][]
      ).forEach(([x, z, n]) => this.mesh(Cy(0.13, 0.6, 8), hue, n, x, 0.3, z));
      const tail = this.mesh(Co(0.16, 1.1, 6), v >= 2 ? C.accent : hue, 'tail', -1.0, 1.25, 0);
      tail.rotation.z = -1.0;
      if (v >= 2) this.mesh(Co(0.12, 0.35, 5), C.accent, 'flame', -1.35, 1.75, 0);
    } else if (kind === 'prop') {
      this.mesh(Cy(0.55, 1.4, 16), v >= 2 ? C.rust : C.steel, 'body', 0, 0.7, 0);
      [0.25, 0.7, 1.15].forEach((y) => {
        const r = this.mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 20), C.dark, 'ring', 0, y, 0);
        r.rotation.x = Math.PI / 2;
      });
    } else if (kind === 'environment') {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++)
          this.mesh(
            B(1.0, 0.5, 0.5),
            i % 2 ? C.stone : 0xa88a62,
            'block_' + i + j,
            i - 1.5 + (j % 2) * 0.5,
            0.25 + j * 0.5,
            0,
          );
      if (v >= 2) this.mesh(B(4.4, 0.3, 0.7), C.dark, 'cap', 0, 1.65, 0);
    } else if (kind === 'weapon') {
      this.mesh(B(2.4, 0.18, 0.12), C.dark, 'barrel', 0.6, 1.2, 0);
      this.mesh(B(0.9, 0.45, 0.18), C.rust, 'body', -0.4, 1.15, 0);
      this.mesh(B(0.25, 0.6, 0.15), C.leather, 'grip', -0.5, 0.7, 0);
      if (v >= 2) this.mesh(Cy(0.09, 0.8, 8), C.metal, 'scope', 0.2, 1.5, 0).rotation.z = Math.PI / 2;
    } else {
      [-1.6, -0.4, 0.8, 2.0].forEach((x, i) =>
        this.mesh(B(1.0, 0.6 + i * 0.3, 0.6), i % 2 ? C.stone : C.rust, 'piece_' + i, x, 0.3 + i * 0.15, 0),
      );
    }

    this.group.children.slice().forEach((obj) => {
      const m = obj as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (selected && m.userData.part === selected && mat.emissive) {
        mat.emissive = new THREE.Color(C.accent);
        mat.emissiveIntensity = 0.35;
      }
      if (wire) {
        const wm = new THREE.MeshBasicMaterial({
          color: C.accent,
          wireframe: true,
          transparent: true,
          opacity: 0.28,
        });
        const w = new THREE.Mesh(m.geometry, wm);
        w.position.copy(m.position);
        w.rotation.copy(m.rotation);
        w.scale.copy(m.scale);
        m.userData.wire = w;
        this.group.add(w);
        this.disposables.push(wm);
      }
    });

    this.group.rotation.set(0, 0, 0);
    this.group.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(this.group);
    const size = box.getSize(new THREE.Vector3());
    this.target = box.getCenter(new THREE.Vector3());
    this.dist =
      Math.max(size.x, size.y, size.z) * (this.opts.compact ? 2.0 : 2.3) + 1;
  }

  private animate(dt: number) {
    const { anim, speed } = this.opts;
    const g = this.group;
    this.t += dt * speed;
    const t = this.t;
    const P = this.parts;
    const set = (n: string, fn: (m: THREE.Mesh) => void) => (P[n] || []).forEach(fn);
    const swing = (n: string, phase: number, amp: number, freq: number) =>
      set(n, (m) => {
        m.rotation.x = Math.sin(t * freq + phase) * amp;
      });

    g.position.set(0, 0, 0);
    g.rotation.z = 0;
    g.rotation.x = 0;

    const gait =
      anim === 'walk'
        ? { f: 6, a: 0.55, b: 0.05 }
        : anim === 'run'
          ? { f: 11, a: 0.95, b: 0.12 }
          : null;

    if (gait) {
      swing('leg_L', 0, gait.a, gait.f);
      swing('leg_R', Math.PI, gait.a, gait.f);
      swing('arm_L', Math.PI, gait.a * 0.8, gait.f);
      swing('arm_R', 0, gait.a * 0.8, gait.f);
      swing('leg_FL', 0, gait.a, gait.f);
      swing('leg_BR', 0, gait.a, gait.f);
      swing('leg_FR', Math.PI, gait.a, gait.f);
      swing('leg_BL', Math.PI, gait.a, gait.f);
      set('tail', (m) => {
        m.rotation.x = Math.sin(t * gait.f * 0.5) * 0.4;
      });
      set('head', (m) => {
        m.position.y = m.userData.base.y + Math.abs(Math.sin(t * gait.f)) * gait.b;
      });
      g.position.y = Math.abs(Math.sin(t * gait.f)) * gait.b;
      if (anim === 'run') g.rotation.z = 0.08;
    } else if (anim === 'drive') {
      for (let i = 0; i < 6; i++)
        set('wheel_' + i, (m) => {
          m.rotation.z += dt * speed * 8;
        });
      g.position.y = Math.sin(t * 18) * 0.015;
      g.rotation.x = Math.sin(t * 9) * 0.012;
      set('antenna', (m) => {
        m.rotation.x = Math.sin(t * 7) * 0.12;
      });
    } else if (anim === 'attack') {
      const k = Math.max(0, Math.sin(t * 4));
      set('head', (m) => {
        m.position.x = m.userData.base.x + k * 0.35;
      });
      set('arm_R', (m) => {
        m.rotation.x = -k * 1.6;
      });
      set('body', (m) => {
        m.rotation.z = -k * 0.15;
      });
      g.position.x = k * 0.3;
    } else if (anim === 'hurt') {
      const k = Math.max(0, Math.sin(t * 5));
      g.rotation.z = k * 0.2;
      g.position.x = -k * 0.25;
      set('head', (m) => {
        m.rotation.z = k * 0.4;
      });
    } else if (anim === 'spin') {
      g.rotation.y += dt * 2;
    } else {
      set('head', (m) => {
        m.position.y = m.userData.base.y + Math.sin(t * 2) * 0.02;
      });
      set('tail', (m) => {
        m.rotation.x = Math.sin(t * 2.2) * 0.25;
      });
      set('ear_L', (m) => {
        m.rotation.z = Math.sin(t * 3) * 0.05;
      });
      ['arm_L', 'arm_R', 'leg_L', 'leg_R', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR'].forEach((n) =>
        set(n, (m) => {
          m.rotation.x = 0;
        }),
      );
    }

    g.children.forEach((obj) => {
      const w = (obj as THREE.Mesh).userData.wire as THREE.Mesh | undefined;
      if (w) {
        w.position.copy((obj as THREE.Mesh).position);
        w.rotation.copy((obj as THREE.Mesh).rotation);
      }
    });
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.animate(dt);
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
