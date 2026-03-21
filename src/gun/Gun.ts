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
  private gunScene!: THREE.Scene;
  private debugMode = false;
  private debugEl?: HTMLElement;

  // Position/rotation offsets (tuned values preserved)
  private posOffset = new THREE.Vector3(0.23, -2.19, -0.63);
  private rotOffset = new THREE.Euler(0.05, -9.4, 0.05);
  private scaleFactor = 1.45;

  // Ammo
  currentAmmo = MAG_SIZE;
  reserveAmmo = RESERVE_MAX;

  // Semi-auto lock
  private fireAnimPlaying = false;

  // Callbacks
  onAmmoChanged?: (current: number, reserve: number) => void;
  onShoot?: () => void;

  constructor() {}

  async load(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.playerCamera = camera;
    this.gunScene = scene;

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync("/p_gun.glb");
    this.model = gltf.scene;

    // Add to gun scene directly — NOT to camera
    // We manually sync position in update()
    this.gunScene.add(this.model);

    this.model.scale.setScalar(this.scaleFactor);

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
        this.fireAnimPlaying = false;
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

    this.onAmmoChanged?.(this.currentAmmo, this.reserveAmmo);
  }

  private syncModelToCamera() {
    // Compute world offset from camera position + orientation
    const offset = this.posOffset.clone();
    offset.applyQuaternion(this.playerCamera.quaternion);
    this.model.position.copy(this.playerCamera.position).add(offset);

    // Apply camera rotation + fixed rotation offset
    const rotQuat = new THREE.Quaternion().setFromEuler(this.rotOffset);
    this.model.quaternion.copy(this.playerCamera.quaternion).multiply(rotQuat);
  }

  private finishReload() {
    if (this.reserveAmmo <= 0) return;
    const needed = MAG_SIZE - this.currentAmmo;
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
    if (this.fireAnimPlaying) return false;
    if (this.currentState === "reload") return false;
    if (this.currentState === "draw") return false;
    if (this.currentAmmo <= 0) {
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
    if (this.currentAmmo === MAG_SIZE) return;
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

    // Always sync model to camera every frame
    this.syncModelToCamera();

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
          this.posOffset.x -= STEP;
          break;
        case "ArrowRight":
          this.posOffset.x += STEP;
          break;
        case "ArrowUp":
          this.posOffset.z -= STEP;
          break;
        case "ArrowDown":
          this.posOffset.z += STEP;
          break;
        case "KeyR":
          this.posOffset.y += STEP;
          break;
        case "KeyF":
          this.posOffset.y -= STEP;
          break;
        case "KeyI":
          this.rotOffset.x -= ROT_STEP;
          break;
        case "KeyK":
          this.rotOffset.x += ROT_STEP;
          break;
        case "KeyJ":
          this.rotOffset.y -= ROT_STEP;
          break;
        case "KeyL":
          this.rotOffset.y += ROT_STEP;
          break;
        case "KeyU":
          this.rotOffset.z -= ROT_STEP;
          break;
        case "KeyO":
          this.rotOffset.z += ROT_STEP;
          break;
        case "Equal":
          this.scaleFactor += SCALE_STEP;
          this.model.scale.setScalar(this.scaleFactor);
          break;
        case "Minus":
          this.scaleFactor -= SCALE_STEP;
          this.model.scale.setScalar(this.scaleFactor);
          break;
      }
      this.updateDebugUI();
    });
  }

  private updateDebugUI() {
    if (!this.debugEl) return;
    const p = this.posOffset;
    const r = this.rotOffset;
    const s = this.scaleFactor;
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
      posOffset = new THREE.Vector3(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})<br>
      rotOffset = new THREE.Euler(${r.x.toFixed(3)}, ${r.y.toFixed(3)}, ${r.z.toFixed(3)})<br>
      scaleFactor = ${s.toFixed(3)}
    `;
  }
}
