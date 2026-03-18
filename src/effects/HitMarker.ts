import * as THREE from "three";

export class HitMarker {
  private scene: THREE.Scene;
  private dots: { mesh: THREE.Mesh; life: number }[] = [];
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(0.03, 6, 6);
    this.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  }

  spawn(position: THREE.Vector3, normal: THREE.Vector3) {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    // Offset slightly from surface so it doesn't z-fight
    mesh.position.copy(position).addScaledVector(normal, 0.01);
    this.scene.add(mesh);
    this.dots.push({ mesh, life: 10 }); // 10 seconds lifetime
  }

  update(dt: number) {
    for (let i = this.dots.length - 1; i >= 0; i--) {
      this.dots[i].life -= dt;
      if (this.dots[i].life <= 0) {
        this.scene.remove(this.dots[i].mesh);
        this.dots.splice(i, 1);
      }
    }
  }
}
