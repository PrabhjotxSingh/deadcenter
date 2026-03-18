import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Player } from "../player/Player";
import { InputManager } from "../input/InputManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { HUD } from "../ui/HUD";
import { Gun } from "../gun/Gun";

export class World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player!: Player;
  input: InputManager;
  physics!: PhysicsWorld;
  hud!: HUD;
  gun!: Gun;
  lastTime = 0;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    // Add camera to scene so children (gun) render
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.input = new InputManager();
    this.hud = new HUD();
    this.setupPointerLock();
    window.addEventListener("resize", () => this.onResize());

    this.init();
  }

  private async init() {
    this.physics = await PhysicsWorld.create();
    await this.loadMap("/map.glb");
    this.setupLights();

    this.player = new Player(this.camera, this.physics);

    this.gun = new Gun();
    await this.gun.load(this.camera);

    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  private async loadMap(url: string) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        this.physics.addStaticTrimesh(child);
      }
    });

    this.scene.add(model);
  }

  private setupLights() {
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  }

  private setupPointerLock() {
    this.renderer.domElement.addEventListener("click", () => {
      this.renderer.domElement.requestPointerLock();
    });
  }

  private tick(time: number) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (!this.player) return;

    this.player.update(dt, this.input);
    this.physics.step(dt);

    this.gun.update(
      dt,
      this.input.isMoving,
      this.input.isRunning,
      this.input.firePressed,
      this.input.isInspecting,
      this.input.isReloading,
    );

    this.input.flushMouseDelta();

    this.renderer.render(this.scene, this.camera);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
