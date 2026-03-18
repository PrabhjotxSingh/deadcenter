export class HUD {
  private crosshair: HTMLElement;

  constructor() {
    this.crosshair = document.createElement("div");
    this.crosshair.id = "crosshair";
    document.body.appendChild(this.crosshair);

    // Show/hide based on pointer lock
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement) {
        this.show();
      } else {
        this.hide();
      }
    });
  }

  show() {
    this.crosshair.style.display = "block";
  }

  hide() {
    this.crosshair.style.display = "none";
  }
}
