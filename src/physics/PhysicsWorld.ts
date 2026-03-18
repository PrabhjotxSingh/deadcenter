import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

export class PhysicsWorld {
  world: RAPIER.World;
  RAPIER: typeof RAPIER;

  private constructor(rapier: typeof RAPIER) {
    this.RAPIER = rapier;
    this.world = new rapier.World({ x: 0, y: -20, z: 0 });
  }

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    return new PhysicsWorld(RAPIER);
  }

  // Build a static trimesh collider from any THREE.Mesh
  addStaticTrimesh(mesh: THREE.Mesh) {
    const geom = mesh.geometry;
    const posAttr = geom.attributes.position;
    const indexAttr = geom.index;

    // Apply world transform into the vertex positions
    mesh.updateWorldMatrix(true, false);
    const worldMatrix = mesh.matrixWorld;

    const vertices = new Float32Array(posAttr.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(worldMatrix);
      vertices[i * 3] = v.x;
      vertices[i * 3 + 1] = v.y;
      vertices[i * 3 + 2] = v.z;
    }

    let indices: Uint32Array;
    if (indexAttr) {
      indices = new Uint32Array(indexAttr.count);
      for (let i = 0; i < indexAttr.count; i++) {
        indices[i] = indexAttr.getX(i);
      }
    } else {
      // Non-indexed: generate sequential indices
      indices = new Uint32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) indices[i] = i;
    }

    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed();
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.RAPIER.ColliderDesc.trimesh(vertices, indices);
    this.world.createCollider(colliderDesc, body);
  }

  step(dt: number) {
    this.world.timestep = Math.min(dt, 0.05);
    this.world.step();
  }
}
