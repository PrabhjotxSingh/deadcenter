export type Screen =
  | "main"
  | "host-wait"
  | "join"
  | "countdown"
  | "game"
  | "winner";

export class MenuManager {
  private container: HTMLElement;
  private current: Screen = "main";

  onHost?: () => void;
  onJoin?: (code: string) => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "menu";
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a1a;
      font-family: 'Arial Narrow', Arial, sans-serif;
      color: white;
      overflow: hidden;
    `;

    // CS-style background layers
    this.container.innerHTML = `
      <div id="menu-bg" style="
        position: absolute; inset: 0;
        background:
          linear-gradient(180deg, #0d0d0d 0%, #1c1c1c 40%, #111 100%);
      "></div>
      <div id="menu-lines" style="
        position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255,255,255,0.01) 2px,
          rgba(255,255,255,0.01) 4px
        );
      "></div>
      <div id="menu-vignette" style="
        position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center,
          transparent 40%, rgba(0,0,0,0.85) 100%);
      "></div>
      <div id="menu-content" style="position: relative; z-index: 2; width: 100%;"></div>
    `;

    document.body.appendChild(this.container);
    this.injectStyles();
    this.showMain();
  }

  private injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap');

      #menu * { box-sizing: border-box; }

      .cs-title {
        font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
        font-size: 64px;
        font-weight: 700;
        letter-spacing: 10px;
        text-transform: uppercase;
        color: #fff;
        text-shadow: 0 0 60px rgba(255,180,0,0.15);
        line-height: 1;
      }

      .cs-subtitle {
        font-size: 13px;
        letter-spacing: 6px;
        color: #f0a500;
        text-transform: uppercase;
        margin-top: 6px;
        font-weight: 600;
      }

      .cs-divider {
        width: 60px;
        height: 2px;
        background: #f0a500;
        margin: 24px auto;
      }

      .cs-btn {
        display: block;
        width: 280px;
        padding: 13px 0;
        margin: 8px auto;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        border-left: 3px solid #f0a500;
        color: #ddd;
        font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 4px;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
        padding-left: 24px;
        position: relative;
        outline: none;
      }

      .cs-btn:hover {
        background: rgba(240,165,0,0.12);
        border-color: rgba(255,255,255,0.2);
        border-left-color: #f0a500;
        color: #fff;
        padding-left: 32px;
      }

      .cs-btn:hover::after {
        content: '▶';
        position: absolute;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        color: #f0a500;
        font-size: 12px;
      }

      .cs-btn-secondary {
        border-left-color: #555;
        color: #888;
      }

      .cs-btn-secondary:hover {
        background: rgba(255,255,255,0.06);
        border-left-color: #999;
        color: #ccc;
      }

      .cs-input {
        display: block;
        width: 280px;
        padding: 14px 20px;
        margin: 0 auto 8px;
        background: rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.1);
        border-bottom: 2px solid #f0a500;
        color: #fff;
        font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
        font-size: 32px;
        font-weight: 700;
        letter-spacing: 12px;
        text-align: center;
        text-transform: uppercase;
        outline: none;
        transition: border-color 0.2s;
      }

      .cs-input:focus {
        border-bottom-color: #fff;
        background: rgba(0,0,0,0.6);
      }

      .cs-input::placeholder {
        color: rgba(255,255,255,0.15);
        letter-spacing: 8px;
      }

      .cs-code-box {
        display: inline-block;
        padding: 16px 40px;
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.08);
        border-bottom: 3px solid #f0a500;
        font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
        font-size: 52px;
        font-weight: 700;
        letter-spacing: 14px;
        color: #fff;
        margin-bottom: 30px;
      }

      .cs-label {
        font-size: 11px;
        letter-spacing: 4px;
        color: #666;
        text-transform: uppercase;
        margin-bottom: 12px;
      }

      .cs-error {
        font-size: 12px;
        letter-spacing: 3px;
        color: #e05050;
        text-transform: uppercase;
        height: 20px;
        margin-bottom: 12px;
      }

      .cs-panel {
        text-align: center;
        max-width: 400px;
        margin: 0 auto;
        padding: 0 20px;
      }

      .cs-footer {
        font-size: 11px;
        letter-spacing: 3px;
        color: #333;
        text-transform: uppercase;
        margin-top: 40px;
      }

      .cs-waiting {
        font-size: 12px;
        letter-spacing: 4px;
        color: #666;
        text-transform: uppercase;
        animation: cs-pulse 1.8s ease-in-out infinite;
      }

      @keyframes cs-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.2; }
      }

      .cs-countdown-num {
        font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
        font-size: 160px;
        font-weight: 700;
        color: #fff;
        line-height: 1;
        letter-spacing: -4px;
      }

      .cs-countdown-label {
        font-size: 13px;
        letter-spacing: 8px;
        color: #f0a500;
        text-transform: uppercase;
        margin-top: 12px;
      }

      .cs-winner-name {
        font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
        font-size: 52px;
        font-weight: 700;
        letter-spacing: 8px;
        color: #f0a500;
        text-transform: uppercase;
        margin: 8px 0 32px;
      }

      .cs-match-over {
        font-size: 12px;
        letter-spacing: 6px;
        color: #555;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  private get content() {
    return document.getElementById("menu-content")!;
  }

  private clear() {
    this.content.innerHTML = "";
  }

  private title() {
    return `
      <div class="cs-title">DEADCENTER</div>
      <div class="cs-subtitle">Tactical Shooter</div>
      <div class="cs-divider"></div>
    `;
  }

  showMain() {
    this.current = "main";
    this.container.style.display = "flex";
    this.clear();
    this.content.innerHTML = `
      <div class="cs-panel">
        ${this.title()}
        <button class="cs-btn" id="btn-host">Host Game</button>
        <button class="cs-btn cs-btn-secondary" id="btn-join">Join Game</button>
        <div class="cs-footer">2 Players · First to 10 Kills</div>
      </div>
    `;
    document.getElementById("btn-host")!.onclick = () => this.onHost?.();
    document.getElementById("btn-join")!.onclick = () => this.showJoin();
  }

  showHostWait(code: string) {
    this.current = "host-wait";
    this.clear();
    this.content.innerHTML = `
      <div class="cs-panel">
        ${this.title()}
        <div class="cs-label">Your Game Code</div>
        <div class="cs-code-box">${code}</div>
        <div class="cs-waiting">● Waiting for opponent</div>
      </div>
    `;
  }

  showJoin() {
    this.current = "join";
    this.clear();
    this.content.innerHTML = `
      <div class="cs-panel">
        ${this.title()}
        <div class="cs-label">Enter Game Code</div>
        <input id="code-input" class="cs-input" maxlength="6" placeholder="······" autocomplete="off" />
        <div id="join-error" class="cs-error"></div>
        <button class="cs-btn" id="btn-connect">Connect</button>
        <button class="cs-btn cs-btn-secondary" id="btn-back">Back</button>
      </div>
    `;

    const input = document.getElementById("code-input") as HTMLInputElement;
    input.focus();

    document.getElementById("btn-connect")!.onclick = () => {
      const code = input.value.trim().toUpperCase();
      if (code.length < 4) {
        document.getElementById("join-error")!.textContent = "Invalid code";
        return;
      }
      this.onJoin?.(code);
    };

    document.getElementById("btn-back")!.onclick = () => this.showMain();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("btn-connect")!.click();
    });
  }

  showConnecting() {
    const err = document.getElementById("join-error");
    if (err) err.textContent = "Connecting...";
  }

  showJoinError(msg: string) {
    const err = document.getElementById("join-error");
    if (err) err.textContent = msg;
  }

  showCountdown(onDone: () => void) {
    this.current = "countdown";
    this.clear();
    this.content.innerHTML = `
      <div class="cs-panel">
        <div class="cs-countdown-num" id="countdown-num">3</div>
        <div class="cs-countdown-label">Get Ready</div>
      </div>
    `;

    let count = 3;
    const el = document.getElementById("countdown-num")!;
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        el.textContent = "GO";
        el.style.color = "#f0a500";
        setTimeout(() => onDone(), 600);
      } else {
        el.textContent = String(count);
      }
    }, 1000);
  }

  showGame() {
    this.current = "game";
    this.container.style.display = "none";
  }

  showWinner(winnerName: string) {
    this.current = "winner";
    this.container.style.display = "flex";
    this.clear();
    this.content.innerHTML = `
      <div class="cs-panel">
        ${this.title()}
        <div class="cs-match-over">Match Over</div>
        <div class="cs-winner-name">${winnerName} Wins</div>
        <button class="cs-btn" id="btn-menu">Main Menu</button>
      </div>
    `;
    document.getElementById("btn-menu")!.onclick = () => {
      window.location.reload();
    };
  }
}
