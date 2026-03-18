export class ScoreHUD {
  private el: HTMLElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Courier New', monospace;
      font-size: 22px;
      font-weight: bold;
      color: white;
      text-shadow: 0 0 10px rgba(0,0,0,0.8);
      letter-spacing: 4px;
      pointer-events: none;
      display: none;
    `;
    document.body.appendChild(this.el);
  }

  update(
    myScore: number,
    theirScore: number,
    myName: string,
    theirName: string,
  ) {
    this.el.innerHTML = `
    <span style="color:#00ff00">${myName} ${myScore}</span>
    <span style="color:#444; margin: 0 12px;">—</span>
    <span style="color:#ff4444">${theirScore} ${theirName}</span>
  `;
  }

  show() {
    this.el.style.display = "block";
  }
  hide() {
    this.el.style.display = "none";
  }
}
