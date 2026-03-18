import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { InputManager } from "../input/InputManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";

const SPEED = 7;
const JUMP_FORCE = 6;
const SENSITIVITY = 0.002;
const PLAYER_HEIGHT = 2.4;
const MIN_AIRTIME = 0.3;

export class Player {
  camera: THREE.PerspectiveCamera;
  body: RAPIER.RigidBody;
  yaw = 0;
  pitch = 0;
  private canJump = true;
  private hasFallen = false;
  private airTime = 0;

  constructor(camera: THREE.PerspectiveCamera, physics: PhysicsWorld) {
    this.camera = camera;

    const bodyDesc = physics.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(-83.79, 10, -8.14)
      .lockRotations();
    this.body = physics.world.createRigidBody(bodyDesc);

    const colliderDesc = physics.RAPIER.ColliderDesc.capsule(0.8, 0.35)
      .setFriction(0.0)
      .setRestitution(0.0);
    physics.world.createCollider(colliderDesc, this.body);
  }

  update(dt: number, input: InputManager) {
    const velY = this.body.linvel().y;

    if (!this.canJump) {
      this.airTime += dt;

      if (this.airTime > MIN_AIRTIME && velY < -0.5) {
        this.hasFallen = true;
      }

      if (this.hasFallen && Math.abs(velY) < 0.1) {
        this.canJump = true;
        this.hasFallen = false;
        this.airTime = 0;
      }
    }

    // --- Mouse look ---
    this.yaw -= input.mouseDelta.x * SENSITIVITY;
    this.pitch -= input.mouseDelta.y * SENSITIVITY;
    this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
    this.camera.quaternion.setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"),
    );

    // --- Movement ---
    const dir = new THREE.Vector3();
    if (input.keys["KeyW"]) dir.z -= 1;
    if (input.keys["KeyS"]) dir.z += 1;
    if (input.keys["KeyA"]) dir.x -= 1;
    if (input.keys["KeyD"]) dir.x += 1;

    dir.normalize().applyEuler(new THREE.Euler(0, this.yaw, 0));

    const isRunning = input.isRunning;
    const speed = isRunning ? SPEED * 1.8 : SPEED;

    const current = this.body.linvel().y;
    this.body.setLinvel(
      { x: dir.x * speed, y: current, z: dir.z * speed },
      true,
    );

    // --- Jump ---
    if (input.jumpPressed && this.canJump) {
      this.body.applyImpulse({ x: 0, y: JUMP_FORCE, z: 0 }, true);
      this.canJump = false;
      this.hasFallen = false;
      this.airTime = 0;
    }

    // --- Sync camera ---
    const pos = this.body.translation();
    this.camera.position.set(pos.x, pos.y + PLAYER_HEIGHT, pos.z);

    // console.log(
    //   `Player pos: x=${pos.x.toFixed(2)} y=${pos.y.toFixed(2)} z=${pos.z.toFixed(2)}`,
    // );
  }
}
