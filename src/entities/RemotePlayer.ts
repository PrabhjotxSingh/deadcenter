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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async load() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync("/player.glb");
    this.model = gltf.scene;
    this.model.scale.setScalar(3); // ← bigger
    this.model.rotation.y = Math.PI; // ← fix backwards facing
    this.scene.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);

    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      // Loop walk, everything else default
      if (clip.name === "walk1") {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      this.actions[clip.name] = action;
    }

    this.playAnim("Idle");
    this.isLoaded = true;
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

    // Smoothly interpolate position
    this.model.position.lerp(this.targetPos, 0.2);

    // Smoothly interpolate yaw
    const current = this.model.rotation.y;
    let diff = this.targetYaw - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.model.rotation.y += diff * 0.2;

    // Animation
    if (isRunning) {
      this.playAnim("walk1", 2.0); // speed up walk for run
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
}
