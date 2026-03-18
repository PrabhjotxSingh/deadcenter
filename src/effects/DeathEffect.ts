import * as THREE from "three";

export class DeathEffect {
  private scene: THREE.Scene;
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] =
    [];
  private geometry: THREE.SphereGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(0.06, 4, 4);
  }

  spawn(position: THREE.Vector3) {
    const colors = [0xff2222, 0xff6600, 0xffaa00, 0xffffff];

    for (let i = 0; i < 30; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
      });
      const mesh = new THREE.Mesh(this.geometry, mat);
      mesh.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 10 + 2,
        (Math.random() - 0.5) * 12,
      );

      this.scene.add(mesh);
      this.particles.push({ mesh, vel, life: 0.8 + Math.random() * 0.4 });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 20 * dt; // gravity
      p.mesh.position.addScaledVector(p.vel, dt);

      // Fade out
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = p.life;
      mat.transparent = true;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
}
