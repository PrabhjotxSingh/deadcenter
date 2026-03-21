import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class RemotePlayer {
  model!: THREE.Group;
  private mixer!: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private currentAnim = "";
  private scene: THREE.Scene;
  isLoaded = false;

  // Smooth interpolation targets
  targetPos = new THREE.Vector3();
  targetYaw = 0;

  // Debug
  private debugMode = false; // ← set to false when done
  private debugEl?: HTMLElement;

  // Tunable values — adjust these via debug controls
  private scaleFactor = 1.5;
  private posOffset = new THREE.Vector3(0, -1.2, 0);
  private rotOffset = new THREE.Euler(0, Math.PI, 0); // faces correct direction

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async load() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync("/player.glb");
    this.model = gltf.scene;

    this.model.scale.setScalar(this.scaleFactor);
    this.model.rotation.copy(this.rotOffset);

    this.scene.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);

    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      if (clip.name === "walk1") {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      this.actions[clip.name] = action;
    }

    this.playAnim("Idle");
    this.isLoaded = true;

    if (this.debugMode) {
      this.setupDebugControls();
      this.updateDebugUI();
    }
  }

  private playAnim(name: string, timeScale = 1) {
    if (this.currentAnim === name) return;
    const prev = this.actions[this.currentAnim];
    const next = this.actions[name];
    if (!next) return;

    next.timeScale = timeScale;
    if (prev) {
      next.reset().play();
      prev.crossFadeTo(next, 0.2, true);
    } else {
      next.reset().play();
    }
    this.currentAnim = name;
  }

  update(dt: number, isMoving: boolean, isRunning: boolean) {
    if (!this.isLoaded) return;

    // Smoothly interpolate position + apply offset
    const target = this.targetPos.clone().add(this.posOffset);
    this.model.position.lerp(target, 0.2);

    // Smoothly interpolate yaw + apply rotation offset
    const currentY = this.model.rotation.y - this.rotOffset.y;
    let diff = this.targetYaw - currentY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.model.rotation.y += diff * 0.2;

    // Animation
    if (isRunning) {
      this.playAnim("walk1", 2.0);
    } else if (isMoving) {
      this.playAnim("walk1", 1.0);
    } else {
      this.playAnim("Idle");
    }

    this.mixer.update(dt);
  }

  setPosition(x: number, y: number, z: number) {
    this.targetPos.set(x, y, z);
  }

  remove() {
    this.scene.remove(this.model);
  }

  private setupDebugControls() {
    this.debugEl = document.createElement("div");
    this.debugEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0,0,0,0.75);
      color: #00ffff;
      font-family: monospace;
      font-size: 13px;
      padding: 12px;
      border-radius: 6px;
      z-index: 999;
      line-height: 1.8;
      pointer-events: none;
    `;
    document.body.appendChild(this.debugEl);

    window.addEventListener("keydown", (e) => {
      if (!this.debugMode || !this.isLoaded) return;

      const STEP = 0.05;
      const ROT_STEP = 0.05;
      const SCALE_STEP = 0.1;

      // Only fire when holding Alt to avoid conflicting with movement keys
      if (!e.altKey) return;

      switch (e.code) {
        // Position offset
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

        // Rotation offset
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

        // Scale
        case "Equal":
          this.scaleFactor += SCALE_STEP;
          this.model.scale.setScalar(this.scaleFactor);
          break;
        case "Minus":
          this.scaleFactor -= SCALE_STEP;
          this.model.scale.setScalar(this.scaleFactor);
          break;
      }

      // Apply rotation offset immediately
      this.model.rotation.x = this.rotOffset.x;
      this.model.rotation.z = this.rotOffset.z;

      this.updateDebugUI();
    });
  }

  private updateDebugUI() {
    if (!this.debugEl) return;
    const p = this.posOffset;
    const r = this.rotOffset;
    const s = this.scaleFactor;

    this.debugEl.innerHTML = `
      <b>PLAYER DEBUG</b> (hold Alt)<br>
      <br>
      <b>Position Offset</b><br>
      X: ${p.x.toFixed(3)} ← Alt+ArrowLeft / ArrowRight<br>
      Y: ${p.y.toFixed(3)} ← Alt+R / F<br>
      Z: ${p.z.toFixed(3)} ← Alt+ArrowUp / ArrowDown<br>
      <br>
      <b>Rotation Offset</b><br>
      X: ${r.x.toFixed(3)} ← Alt+I / K<br>
      Y: ${r.y.toFixed(3)} ← Alt+J / L<br>
      Z: ${r.z.toFixed(3)} ← Alt+U / O<br>
      <br>
      <b>Scale</b><br>
      ${s.toFixed(3)} ← Alt++ / Alt+-<br>
      <br>
      <b>Copy into RemotePlayer.ts:</b><br>
      scaleFactor = ${s.toFixed(3)}<br>
      posOffset = new THREE.Vector3(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})<br>
      rotOffset = new THREE.Euler(${r.x.toFixed(3)}, ${r.y.toFixed(3)}, ${r.z.toFixed(3)})
    `;
  }
}
