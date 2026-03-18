import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type GunState =
  | "draw"
  | "idle"
  | "walk"
  | "run"
  | "fire"
  | "inspect"
  | "reload";

const MAG_SIZE = 30;
const RESERVE_MAX = 90;

export class Gun {
  model!: THREE.Group;
  private mixer!: THREE.AnimationMixer;
  private actions: Partial<Record<GunState, THREE.AnimationAction>> = {};
  private currentState: GunState = "draw";
  private isLoaded = false;
  private playerCamera!: THREE.PerspectiveCamera;
  private debugMode = false;
  private debugEl?: HTMLElement;

  // Ammo
  currentAmmo = MAG_SIZE;
  reserveAmmo = RESERVE_MAX;

  // Semi-auto lock — true while fire animation is playing
  private fireAnimPlaying = false;

  // Callbacks
  onAmmoChanged?: (current: number, reserve: number) => void;
  onShoot?: () => void; // called when a shot is actually fired

  constructor() {}

  async load(camera: THREE.PerspectiveCamera) {
    this.playerCamera = camera;

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync("/p_gun.glb");
    this.model = gltf.scene;

    this.playerCamera.add(this.model);

    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Force gun to always render on top — no clipping through walls or world
        child.renderOrder = 999;
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m.depthTest = false;
            m.depthWrite = false;
          });
        } else {
          child.material.depthTest = false;
          child.material.depthWrite = false;
        }
      }
    });

    this.model.position.set(0.23, -2.19, -0.63);
    this.model.rotation.set(0.05, -9.4, 0.05);
    this.model.scale.setScalar(1.45);

    this.mixer = new THREE.AnimationMixer(this.model);

    const animMap: Record<string, GunState> = {
      Arms_Draw: "draw",
      Arms_Idle: "idle",
      Arms_Walk: "walk",
      Arms_Run: "run",
      Arms_Fire: "fire",
      Arms_Inspect: "inspect",
      Arms_fullreload: "reload",
    };

    for (const clip of gltf.animations) {
      const state = animMap[clip.name];
      if (state) {
        const action = this.mixer.clipAction(clip);
        if (
          state === "draw" ||
          state === "fire" ||
          state === "inspect" ||
          state === "reload"
        ) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        this.actions[state] = action;
      }
    }

    this.mixer.addEventListener("finished", (e) => {
      const finishedAction = e.action;

      if (finishedAction === this.actions["fire"]) {
        this.fireAnimPlaying = false; // unlock semi-auto
        this.transitionTo("idle");
      } else if (finishedAction === this.actions["reload"]) {
        this.finishReload();
        this.transitionTo("idle");
      } else if (
        finishedAction === this.actions["draw"] ||
        finishedAction === this.actions["inspect"]
      ) {
        this.transitionTo("idle");
      }
    });

    this.actions["draw"]?.play();
    this.isLoaded = true;

    if (this.debugMode) {
      this.setupDebugControls();
      this.updateDebugUI();
    }

    // Initial ammo UI
    this.onAmmoChanged?.(this.currentAmmo, this.reserveAmmo);
  }

  private finishReload() {
    if (this.reserveAmmo <= 0) return;

    const needed = MAG_SIZE - this.currentAmmo; // tactical: only fill what's missing
    const taken = Math.min(needed, this.reserveAmmo);
    this.currentAmmo += taken;
    this.reserveAmmo -= taken;
    this.onAmmoChanged?.(this.currentAmmo, this.reserveAmmo);
  }

  transitionTo(next: GunState, duration = 0.15) {
    if (this.currentState === next || !this.isLoaded) return;
    const current = this.actions[this.currentState];
    const nextAction = this.actions[next];
    if (!nextAction) return;

    if (current && current !== nextAction) {
      nextAction.reset().play();
      current.crossFadeTo(nextAction, duration, true);
    } else {
      nextAction.reset().play();
    }

    this.currentState = next;
  }

  fire(): boolean {
    // Returns true if shot was actually fired
    if (this.fireAnimPlaying) return false;
    if (this.currentState === "reload") return false;
    if (this.currentState === "draw") return false;
    if (this.currentAmmo <= 0) {
      // Empty — auto reload if reserve available
      if (this.reserveAmmo > 0) this.reload();
      return false;
    }

    this.currentAmmo--;
    this.fireAnimPlaying = true;
    this.onAmmoChanged?.(this.currentAmmo, this.reserveAmmo);
    this.transitionTo("fire", 0.05);
    this.onShoot?.();
    return true;
  }

  reload() {
    if (this.currentState === "reload") return;
    if (this.currentState === "draw") return;
    if (this.currentAmmo === MAG_SIZE) return; // already full
    if (this.reserveAmmo <= 0) return;
    this.transitionTo("reload", 0.2);
  }

  inspect() {
    if (this.fireAnimPlaying) return;
    if (this.currentState === "reload") return;
    this.transitionTo("inspect", 0.2);
  }

  update(
    dt: number,
    isMoving: boolean,
    isRunning: boolean,
    isFiring: boolean,
    isInspecting: boolean,
    isReloading: boolean,
  ) {
    if (!this.isLoaded) return;

    if (
      this.currentState !== "fire" &&
      this.currentState !== "draw" &&
      this.currentState !== "inspect" &&
      this.currentState !== "reload"
    ) {
      if (isFiring) {
        this.fire();
      } else if (isReloading) {
        this.reload();
      } else if (isInspecting) {
        this.inspect();
      } else if (isRunning) {
        this.transitionTo("run");
      } else if (isMoving) {
        this.transitionTo("walk");
      } else {
        this.transitionTo("idle");
      }
    }

    this.mixer.update(dt);
  }

  // --- Debug controls unchanged ---
  private setupDebugControls() {
    this.debugEl = document.createElement("div");
    this.debugEl.style.cssText = `
      position: fixed; top: 10px; right: 10px;
      background: rgba(0,0,0,0.75); color: #00ff00;
      font-family: monospace; font-size: 13px;
      padding: 12px; border-radius: 6px;
      z-index: 999; line-height: 1.8; pointer-events: none;
    `;
    document.body.appendChild(this.debugEl);

    window.addEventListener("keydown", (e) => {
      if (!this.debugMode || !this.isLoaded) return;
      const STEP = 0.01,
        ROT_STEP = 0.05,
        SCALE_STEP = 0.05;
      switch (e.code) {
        case "ArrowLeft":
          this.model.position.x -= STEP;
          break;
        case "ArrowRight":
          this.model.position.x += STEP;
          break;
        case "ArrowUp":
          this.model.position.z -= STEP;
          break;
        case "ArrowDown":
          this.model.position.z += STEP;
          break;
        case "KeyR":
          this.model.position.y += STEP;
          break;
        case "KeyF":
          this.model.position.y -= STEP;
          break;
        case "KeyI":
          this.model.rotation.x -= ROT_STEP;
          break;
        case "KeyK":
          this.model.rotation.x += ROT_STEP;
          break;
        case "KeyJ":
          this.model.rotation.y -= ROT_STEP;
          break;
        case "KeyL":
          this.model.rotation.y += ROT_STEP;
          break;
        case "KeyU":
          this.model.rotation.z -= ROT_STEP;
          break;
        case "KeyO":
          this.model.rotation.z += ROT_STEP;
          break;
        case "Equal":
          this.model.scale.setScalar(this.model.scale.x + SCALE_STEP);
          break;
        case "Minus":
          this.model.scale.setScalar(this.model.scale.x - SCALE_STEP);
          break;
      }
      this.updateDebugUI();
    });
  }

  private updateDebugUI() {
    if (!this.debugEl) return;
    const p = this.model.position;
    const r = this.model.rotation;
    const s = this.model.scale.x;
    this.debugEl.innerHTML = `
      <b>GUN DEBUG</b><br><br>
      <b>Position</b><br>
      X: ${p.x.toFixed(3)} ← ArrowLeft / ArrowRight<br>
      Y: ${p.y.toFixed(3)} ← R / F<br>
      Z: ${p.z.toFixed(3)} ← ArrowUp / ArrowDown<br><br>
      <b>Rotation</b><br>
      X: ${r.x.toFixed(3)} ← I / K<br>
      Y: ${r.y.toFixed(3)} ← J / L<br>
      Z: ${r.z.toFixed(3)} ← U / O<br><br>
      <b>Scale</b><br>
      ${s.toFixed(3)} ← + / -<br><br>
      <b>Copy into Gun.ts:</b><br>
      position.set(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})<br>
      rotation.set(${r.x.toFixed(3)}, ${r.y.toFixed(3)}, ${r.z.toFixed(3)})<br>
      scale.setScalar(${s.toFixed(3)})
    `;
  }
}
