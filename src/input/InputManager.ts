export class InputManager {
  keys: Record<string, boolean> = {};
  mouseDelta = { x: 0, y: 0 };
  jumpPressed = false;
  firePressed = false;
  reloadPressed = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space" && !e.repeat) this.jumpPressed = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener("mousemove", (e) => {
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.firePressed = true;
    });
  }

  get isRunning() {
    return this.keys["ShiftLeft"] && this.keys["KeyW"];
  }

  get isMoving() {
    return (
      this.keys["KeyW"] ||
      this.keys["KeyS"] ||
      this.keys["KeyA"] ||
      this.keys["KeyD"]
    );
  }

  get isInspecting() {
    return this.keys["KeyF"] ?? false;
  }

  get isReloading() {
    return this.keys["KeyR"] ?? false;
  }

  flushMouseDelta() {
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.jumpPressed = false;
    this.firePressed = false;
    this.reloadPressed = false;
  }
}
