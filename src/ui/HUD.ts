export class HUD {
  private crosshair: HTMLElement;
  private ammoEl: HTMLElement;

  constructor() {
    // Crosshair
    this.crosshair = document.createElement("div");
    this.crosshair.id = "crosshair";
    document.body.appendChild(this.crosshair);

    // Ammo display
    this.ammoEl = document.createElement("div");
    this.ammoEl.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      color: white;
      font-family: monospace;
      font-size: 28px;
      font-weight: bold;
      text-shadow: 0 0 6px rgba(0,0,0,0.8);
      pointer-events: none;
      letter-spacing: 2px;
    `;
    document.body.appendChild(this.ammoEl);

    // Show/hide based on pointer lock
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement) {
        this.show();
      } else {
        this.hide();
      }
    });
  }

  updateAmmo(current: number, reserve: number) {
    const color =
      current === 0 ? "#ff4444" : current <= 5 ? "#ffaa00" : "white";
    this.ammoEl.innerHTML = `
      <span style="color:${color}">${current}</span>
      <span style="color:#888; font-size:18px"> / ${reserve}</span>
    `;
  }

  show() {
    this.crosshair.style.display = "block";
    this.ammoEl.style.display = "block";
  }

  hide() {
    this.crosshair.style.display = "none";
    this.ammoEl.style.display = "none";
  }
}
