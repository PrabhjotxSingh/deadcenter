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
  private mouseX = 0;
  private mouseY = 0;
  private animFrame?: number;

  onHost?: () => void;
  onJoin?: (code: string) => void;
  onSinglePlayer?: () => void;

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

    this.container.innerHTML = `
      <div id="menu-bg" style="
        position: absolute; inset: 0;
        background: linear-gradient(180deg, #0d0d0d 0%, #1c1c1c 40%, #111 100%);
      "></div>
      <div id="menu-lines" style="
        position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(
          0deg, transparent, transparent 2px,
          rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 4px
        );
      "></div>
      <div id="menu-vignette" style="
        position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%);
      "></div>
      <canvas id="menu-canvas" style="position:absolute; inset:0; pointer-events:none; opacity:0.4;"></canvas>
      <div id="menu-content" style="position: relative; z-index: 2; width: 100%; transition: transform 0.1s ease-out;"></div>
    `;

    document.body.appendChild(this.container);
    this.injectStyles();
    this.setupMouseParallax();
    this.setupParticles();
    this.showMain();
  }

  private setupMouseParallax() {
    window.addEventListener("mousemove", (e) => {
      this.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouseY = (e.clientY / window.innerHeight - 0.5) * 2;

      const content = document.getElementById("menu-content");
      if (content && this.current !== "game") {
        content.style.transform = `translate(${this.mouseX * 8}px, ${this.mouseY * 6}px)`;
      }

      // Shift background slightly opposite direction
      const bg = document.getElementById("menu-bg");
      if (bg) {
        bg.style.transform = `translate(${-this.mouseX * 12}px, ${-this.mouseY * 8}px) scale(1.05)`;
      }
    });
  }

  private setupParticles() {
    const canvas = document.getElementById("menu-canvas") as HTMLCanvasElement;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener("resize", () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    const ctx = canvas.getContext("2d")!;

    // Floating particles
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      color: string;
    }[] = [];

    const colors = ["#f0a500", "#ffffff", "#c8f0c8", "#f0a500"];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Floating crosses / tactical markers
    const markers: {
      x: number;
      y: number;
      vy: number;
      opacity: number;
      size: number;
    }[] = [];

    for (let i = 0; i < 8; i++) {
      markers.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: -Math.random() * 0.2 - 0.05,
        opacity: Math.random() * 0.15 + 0.05,
        size: Math.random() * 16 + 8,
      });
    }

    const drawCross = (x: number, y: number, size: number, opacity: number) => {
      ctx.strokeStyle = `rgba(240, 165, 0, ${opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      // Corner brackets
      ctx.moveTo(x - size * 0.4, y - size);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x - size, y - size * 0.4);
      ctx.moveTo(x + size * 0.4, y - size);
      ctx.lineTo(x + size, y - size);
      ctx.lineTo(x + size, y - size * 0.4);
      ctx.stroke();
    };

    const animate = () => {
      if (this.current === "game") return;
      this.animFrame = requestAnimationFrame(animate);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      for (const p of particles) {
        p.x += p.vx + this.mouseX * 0.3;
        p.y += p.vy;

        if (p.y < -10) p.y = canvas.height + 10;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color
          .replace(")", `, ${p.opacity})`)
          .replace("rgb", "rgba")
          .replace("#f0a500", `rgba(240,165,0,${p.opacity})`)
          .replace("#ffffff", `rgba(255,255,255,${p.opacity})`)
          .replace("#c8f0c8", `rgba(200,240,200,${p.opacity})`);
        ctx.fill();
      }

      // Draw tactical markers
      for (const m of markers) {
        m.y += m.vy;
        if (m.y < -50) m.y = canvas.height + 50;
        drawCross(m.x, m.y, m.size, m.opacity);
      }

      // Subtle horizontal scan line
      const scanY = ((Date.now() / 20) % (canvas.height + 100)) - 50;
      const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      grad.addColorStop(0, "rgba(240,165,0,0)");
      grad.addColorStop(0.5, "rgba(240,165,0,0.03)");
      grad.addColorStop(1, "rgba(240,165,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 40, canvas.width, 80);
    };

    animate();
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
        animation: cs-fadein 0.6s ease-out;
      }

      .cs-subtitle {
        font-size: 13px;
        letter-spacing: 6px;
        color: #f0a500;
        text-transform: uppercase;
        margin-top: 6px;
        font-weight: 600;
        animation: cs-fadein 0.8s ease-out;
      }

      .cs-divider {
        width: 60px;
        height: 2px;
        background: #f0a500;
        margin: 24px auto;
        animation: cs-expand 0.6s ease-out;
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
        animation: cs-slidein 0.4s ease-out both;
      }

      .cs-btn:nth-child(1) { animation-delay: 0.1s; }
      .cs-btn:nth-child(2) { animation-delay: 0.2s; }
      .cs-btn:nth-child(3) { animation-delay: 0.3s; }

      .cs-btn:hover {
        background: rgba(240,165,0,0.12);
        border-color: rgba(255,255,255,0.2);
        border-left-color: #f0a500;
        color: #fff;
        padding-left: 32px;
        box-shadow: 0 0 20px rgba(240,165,0,0.1), inset 0 0 20px rgba(240,165,0,0.03);
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

      .cs-btn:active {
        background: rgba(240,165,0,0.2);
        transform: scale(0.98);
      }

      .cs-btn-secondary {
        border-left-color: #555;
        color: #888;
      }

      .cs-btn-secondary:hover {
        background: rgba(255,255,255,0.06);
        border-left-color: #999;
        color: #ccc;
        box-shadow: none;
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
        transition: all 0.2s;
      }

      .cs-input:focus {
        border-bottom-color: #fff;
        background: rgba(0,0,0,0.6);
        box-shadow: 0 4px 20px rgba(240,165,0,0.1);
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
        text-shadow: 0 0 30px rgba(240,165,0,0.4);
        animation: cs-pulse-glow 2s ease-in-out infinite;
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
        animation: cs-fadein 1s ease-out;
      }

      .cs-waiting {
        font-size: 12px;
        letter-spacing: 4px;
        color: #666;
        text-transform: uppercase;
        animation: cs-pulse 1.8s ease-in-out infinite;
      }

      .cs-countdown-num {
        font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
        font-size: 160px;
        font-weight: 700;
        color: #fff;
        line-height: 1;
        letter-spacing: -4px;
        animation: cs-pop 0.3s ease-out;
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
        text-shadow: 0 0 40px rgba(240,165,0,0.5);
        animation: cs-pulse-glow 2s ease-in-out infinite;
      }

      .cs-match-over {
        font-size: 12px;
        letter-spacing: 6px;
        color: #555;
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      @keyframes cs-fadein {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes cs-slidein {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes cs-expand {
        from { width: 0; }
        to { width: 60px; }
      }

      @keyframes cs-pop {
        from { transform: scale(1.3); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      @keyframes cs-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.2; }
      }

      @keyframes cs-pulse-glow {
        0%, 100% { text-shadow: 0 0 30px rgba(240,165,0,0.4); }
        50% { text-shadow: 0 0 60px rgba(240,165,0,0.8), 0 0 100px rgba(240,165,0,0.3); }
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
        <button class="cs-btn" id="btn-solo">Single Player</button>
        <button class="cs-btn" id="btn-host">Host Game</button>
        <button class="cs-btn cs-btn-secondary" id="btn-join">Join Game</button>
        <div class="cs-footer">2 Players · First to 10 Kills</div>
      </div>
    `;
    document.getElementById("btn-solo")!.onclick = () =>
      this.onSinglePlayer?.();
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
        // Re-trigger pop animation
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "cs-pop 0.3s ease-out";
        setTimeout(() => onDone(), 600);
      } else {
        el.textContent = String(count);
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "cs-pop 0.3s ease-out";
      }
    }, 1000);
  }

  showGame() {
    this.current = "game";
    this.container.style.display = "none";
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  showWinner(winnerName: string) {
    this.current = "winner";
    this.container.style.display = "flex";
    this.setupParticles(); // restart particles
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
