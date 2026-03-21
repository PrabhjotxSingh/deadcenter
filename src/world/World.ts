import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Player } from "../player/Player";
import { InputManager } from "../input/InputManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { HUD } from "../ui/HUD";
import { ScoreHUD } from "../ui/ScoreHUD";
import { Gun } from "../gun/Gun";
import { HitMarker } from "../effects/HitMarker";
import { DeathEffect } from "../effects/DeathEffect";
import { RemotePlayer } from "../entities/RemotePlayer";
import { Network } from "../network/Network";
import { MenuManager } from "../menu/MenuManager";

const HOST_SPAWN = { x: -83.79, y: 10, z: -8.14 };
const GUEST_SPAWN = { x: 109.3, y: 10, z: -9.0 };
const WIN_SCORE = 10;
const VOID_Y = -30;

export class World {
  scene: THREE.Scene;
  gunScene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  gunCamera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player!: Player;
  input: InputManager;
  physics!: PhysicsWorld;
  hud!: HUD;
  scoreHUD!: ScoreHUD;
  gun!: Gun;
  hitMarker!: HitMarker;
  deathEffect!: DeathEffect;
  remotePlayer!: RemotePlayer;
  network!: Network;
  menu!: MenuManager;
  lastTime = 0;

  private raycaster = new THREE.Raycaster();
  private mapMeshes: THREE.Mesh[] = [];
  private myScore = 0;
  private theirScore = 0;
  private isInGame = false;
  private isSinglePlayer = false;
  private remoteIsMoving = false;
  private remoteIsRunning = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc9dff0);
    this.scene.fog = new THREE.Fog(0xc9dff0, 30, 120);

    this.gunScene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.scene.add(this.camera);

    this.gunCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01,
      10,
    );
    this.gunScene.add(this.gunCamera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    document.body.appendChild(this.renderer.domElement);

    // Gun scene lights — warm to match world
    this.gunScene.add(new THREE.AmbientLight(0xfff4e0, 0.8));
    const gunLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    gunLight.position.set(2, 4, 2);
    this.gunScene.add(gunLight);
    const gunFill = new THREE.DirectionalLight(0x8899bb, 0.3);
    gunFill.position.set(-1, 0, -1);
    this.gunScene.add(gunFill);

    this.input = new InputManager();
    this.hud = new HUD();
    this.scoreHUD = new ScoreHUD();
    this.network = new Network();
    this.menu = new MenuManager();

    window.addEventListener("resize", () => this.onResize());
    this.init();
  }

  private async init() {
    this.physics = await PhysicsWorld.create();
    await this.loadMap("/map.glb");
    this.setupLights();

    this.hitMarker = new HitMarker(this.scene);
    this.deathEffect = new DeathEffect(this.scene);

    this.remotePlayer = new RemotePlayer(this.scene);
    await this.remotePlayer.load();
    this.remotePlayer.model.visible = false;

    this.gun = new Gun();
    await this.gun.load(this.gunCamera, this.gunScene);

    this.gun.onAmmoChanged = (current, reserve) => {
      this.hud.updateAmmo(current, reserve);
    };

    this.gun.onShoot = () => {
      if (!this.isInGame) return;
      this.doRaycast();
      if (!this.isSinglePlayer && this.network.conn) {
        this.network.send({ type: "player-shot" });
      }
    };

    this.setupNetwork();
    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  private setupNetwork() {
    this.menu.onSinglePlayer = () => {
      this.startSinglePlayer();
    };

    this.menu.onHost = async () => {
      try {
        const code = await this.network.host();
        this.menu.showHostWait(code);
      } catch (e) {
        console.error("Failed to host:", e);
        this.menu.showJoinError("FAILED TO HOST");
      }
    };

    this.menu.onJoin = async (code) => {
      this.menu.showConnecting();
      try {
        await this.network.join(code);
      } catch (e) {
        console.error("Failed to join:", e);
        this.menu.showJoinError("FAILED TO CONNECT");
      }
    };

    this.network.onConnected = () => {
      if (this.network.isHost) {
        this.network.send({ type: "game-start" });
        this.startCountdown();
      }
    };

    this.network.onMessage = (msg) => {
      if (msg.type === "game-start") {
        this.startCountdown();
      }

      if (msg.type === "player-update") {
        this.remotePlayer.setPosition(msg.x, msg.y, msg.z);
        this.remotePlayer.targetYaw = msg.yaw;
        this.remoteIsMoving = msg.isMoving;
        this.remoteIsRunning = msg.isRunning;
      }

      if (msg.type === "player-hit") {
        this.theirScore++;
        this.scoreHUD.update(this.myScore, this.theirScore, "YOU", "ENEMY");
        this.network.send({
          type: "score-update",
          myScore: this.myScore,
          theirScore: this.theirScore,
        });
        this.handleDeath(false);
      }

      if (msg.type === "score-update") {
        this.myScore = msg.theirScore;
        this.theirScore = msg.myScore;
        this.scoreHUD.update(this.myScore, this.theirScore, "YOU", "ENEMY");
      }

      if (msg.type === "round-reset") {
        this.resetPositions();
      }
    };

    this.network.onDisconnected = () => {
      if (this.isInGame && !this.isSinglePlayer) {
        alert("Opponent disconnected.");
        window.location.reload();
      }
    };
  }

  private startSinglePlayer() {
    this.isSinglePlayer = true;
    this.menu.showCountdown(() => {
      this.player = new Player(this.camera, this.physics, HOST_SPAWN);
      this.isInGame = true;
      this.remotePlayer.model.visible = false;
      this.menu.showGame();
      this.scoreHUD.hide();
      this.setupPointerLock();
      this.renderer.domElement.requestPointerLock();
    });
  }

  private startCountdown() {
    this.menu.showCountdown(() => {
      const spawn = this.network.isHost ? HOST_SPAWN : GUEST_SPAWN;
      this.player = new Player(this.camera, this.physics, spawn);
      this.isInGame = true;
      this.remotePlayer.model.visible = true;
      this.menu.showGame();
      this.scoreHUD.show();
      this.scoreHUD.update(0, 0, "YOU", "ENEMY");
      this.setupPointerLock();
      this.renderer.domElement.requestPointerLock();
    });
  }

  private doRaycast() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    if (
      !this.isSinglePlayer &&
      this.remotePlayer.isLoaded &&
      this.remotePlayer.model.visible
    ) {
      const remoteHits = this.raycaster.intersectObject(
        this.remotePlayer.model,
        true,
      );
      if (remoteHits.length > 0) {
        this.network.send({ type: "player-hit" });
        this.myScore++;
        this.scoreHUD.update(this.myScore, this.theirScore, "YOU", "ENEMY");
        this.deathEffect.spawn(this.remotePlayer.model.position.clone());

        if (this.myScore >= WIN_SCORE) {
          this.endGame("YOU");
          return;
        }

        this.handleDeath(true);
        return;
      }
    }

    const hits = this.raycaster.intersectObjects(this.mapMeshes, false);
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit.face && hit.point) {
        const normal = hit.face.normal
          .clone()
          .transformDirection(hit.object.matrixWorld);
        this.hitMarker.spawn(hit.point, normal);
      }
    }
  }

  private handleDeath(iKilled: boolean) {
    if (!iKilled) {
      const pos = this.player.body.translation();
      this.deathEffect.spawn(new THREE.Vector3(pos.x, pos.y, pos.z));
    }

    if (this.theirScore >= WIN_SCORE) {
      this.endGame("ENEMY");
      return;
    }

    setTimeout(() => {
      this.resetPositions();
      if (!this.isSinglePlayer && this.network.isHost) {
        this.network.send({ type: "round-reset" });
      }
    }, 800);
  }

  private resetPositions() {
    const mySpawn = this.network.isHost ? HOST_SPAWN : GUEST_SPAWN;
    const theirSpawn = this.network.isHost ? GUEST_SPAWN : HOST_SPAWN;

    this.player.body.setTranslation(
      { x: mySpawn.x, y: mySpawn.y, z: mySpawn.z },
      true,
    );
    this.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);

    if (!this.isSinglePlayer) {
      this.remotePlayer.setPosition(theirSpawn.x, theirSpawn.y, theirSpawn.z);
    }
  }

  private endGame(winnerName: string) {
    this.isInGame = false;
    document.exitPointerLock();
    this.scoreHUD.hide();
    this.menu.showWinner(winnerName);
    if (!this.isSinglePlayer) {
      this.network.destroy();
    }
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
        this.mapMeshes.push(child);
      }
    });

    this.scene.add(model);
  }

  private setupLights() {
    // Hemisphere light — sky from above, warm ground bounce below
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a3728, 0.6);
    this.scene.add(hemi);

    // Main sun — warm, angled for natural shadows
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
    sun.position.set(40, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);

    // Soft fill from opposite side — no pitch black shadows
    const fill = new THREE.DirectionalLight(0x88aacc, 0.4);
    fill.position.set(-20, 10, -20);
    this.scene.add(fill);
  }

  private setupPointerLock() {
    this.renderer.domElement.addEventListener("click", () => {
      if (this.isInGame) {
        this.renderer.domElement.requestPointerLock();
      }
    });
  }

  private tick(time: number) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (!this.player) return;

    this.player.update(dt, this.input);
    this.physics.step(dt);

    // Void death — fell off the world
    if (this.player.body.translation().y < VOID_Y) {
      if (this.isSinglePlayer) {
        this.player.body.setTranslation(
          { x: HOST_SPAWN.x, y: HOST_SPAWN.y, z: HOST_SPAWN.z },
          true,
        );
        this.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        this.theirScore++;
        this.scoreHUD.update(this.myScore, this.theirScore, "YOU", "ENEMY");
        this.network.send({
          type: "score-update",
          myScore: this.myScore,
          theirScore: this.theirScore,
        });
        this.handleDeath(false);
      }
    }

    // Sync gun camera to main camera every frame
    this.gunCamera.position.copy(this.camera.position);
    this.gunCamera.quaternion.copy(this.camera.quaternion);

    if (this.isInGame && !this.isSinglePlayer) {
      const pos = this.player.body.translation();
      this.network.send({
        type: "player-update",
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: this.player.yaw,
        isMoving: this.input.isMoving,
        isRunning: this.input.isRunning,
      });
    }

    this.gun.update(
      dt,
      this.input.isMoving,
      this.input.isRunning,
      this.input.firePressed,
      this.input.isInspecting,
      this.input.isReloading,
    );

    this.remotePlayer.update(dt, this.remoteIsMoving, this.remoteIsRunning);
    this.hitMarker.update(dt);
    this.deathEffect.update(dt);
    this.input.flushMouseDelta();

    // Pass 1: render world
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Pass 2: render gun on top, clearing only depth
    this.renderer.clearDepth();
    this.renderer.render(this.gunScene, this.gunCamera);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.gunCamera.aspect = window.innerWidth / window.innerHeight;
    this.gunCamera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
