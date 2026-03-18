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

const MY_SPAWN = { x: -83.79, y: 10, z: -8.14 };
const THEIR_SPAWN = { x: 109.3, y: 10, z: -9.0 };
const WIN_SCORE = 10;

export class World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
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
  private remoteIsMoving = false;
  private remoteIsRunning = false;

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
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

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

    this.player = new Player(this.camera, this.physics);
    this.hitMarker = new HitMarker(this.scene);
    this.deathEffect = new DeathEffect(this.scene);

    this.remotePlayer = new RemotePlayer(this.scene);
    await this.remotePlayer.load();
    this.remotePlayer.model.visible = false; // hide until game starts

    this.gun = new Gun();
    await this.gun.load(this.camera);

    this.gun.onAmmoChanged = (current, reserve) => {
      this.hud.updateAmmo(current, reserve);
    };

    this.gun.onShoot = () => {
      if (!this.isInGame) return;
      this.doRaycast();
      this.network.send({ type: "player-shot" });
    };

    this.setupNetwork();
    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  private setupNetwork() {
    this.menu.onHost = async () => {
      const code = await this.network.host();
      this.menu.showHostWait(code);
    };

    this.menu.onJoin = async (code) => {
      this.menu.showConnecting();
      try {
        await this.network.join(code);
      } catch {
        this.menu.showJoinError("FAILED TO CONNECT");
      }
    };

    this.network.onConnected = () => {
      // Both players connected — host triggers countdown
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
        // They hit me — their score goes up
        this.theirScore++;
        this.scoreHUD.update(this.myScore, this.theirScore, "YOU", "ENEMY");
        this.network.send({
          type: "score-update",
          myScore: this.myScore, // ← was swapped
          theirScore: this.theirScore, // ← was swapped
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
      if (this.isInGame) {
        alert("Opponent disconnected.");
        window.location.reload();
      }
    };
  }

  private startCountdown() {
    this.menu.showCountdown(() => {
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

    // Check hit on remote player first
    if (this.remotePlayer.isLoaded && this.remotePlayer.model.visible) {
      const remoteHits = this.raycaster.intersectObject(
        this.remotePlayer.model,
        true,
      );
      if (remoteHits.length > 0) {
        this.network.send({ type: "player-hit" });
        this.myScore++;
        this.scoreHUD.update(this.myScore, this.theirScore, "YOU", "ENEMY");

        // Death effect at remote player position
        this.deathEffect.spawn(this.remotePlayer.model.position.clone());

        if (this.myScore >= WIN_SCORE) {
          this.endGame("YOU");
          return;
        }

        this.handleDeath(true);
        return;
      }
    }

    // Otherwise hit the map
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
      // I died — spawn death effect at my position
      const pos = this.player.body.translation();
      this.deathEffect.spawn(new THREE.Vector3(pos.x, pos.y, pos.z));
    }

    if (this.theirScore >= WIN_SCORE) {
      this.endGame("ENEMY");
      return;
    }

    // Reset round
    setTimeout(() => {
      this.resetPositions();
      if (this.network.isHost) {
        this.network.send({ type: "round-reset" });
      }
    }, 800); // short delay so death effect plays
  }

  private resetPositions() {
    // Reset local player
    this.player.body.setTranslation(
      { x: MY_SPAWN.x, y: MY_SPAWN.y, z: MY_SPAWN.z },
      true,
    );
    this.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);

    // Reset remote player visually
    this.remotePlayer.setPosition(THEIR_SPAWN.x, THEIR_SPAWN.y, THEIR_SPAWN.z);
  }

  private endGame(winnerName: string) {
    this.isInGame = false;
    document.exitPointerLock();
    this.scoreHUD.hide();
    this.menu.showWinner(winnerName);
    this.network.destroy();
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

    if (this.isInGame) {
      // Send our position to the other player
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

    this.renderer.render(this.scene, this.camera);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
