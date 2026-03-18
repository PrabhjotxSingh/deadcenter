import Peer, { type DataConnection } from "peerjs";

export type NetMessage =
  | {
      type: "player-update";
      x: number;
      y: number;
      z: number;
      yaw: number;
      isMoving: boolean;
      isRunning: boolean;
    }
  | { type: "player-shot" }
  | { type: "player-hit" }
  | { type: "score-update"; myScore: number; theirScore: number }
  | { type: "round-reset" }
  | { type: "game-start" };

export class Network {
  peer!: Peer;
  conn?: DataConnection;
  isHost = false;
  myCode = "";

  onConnected?: () => void;
  onMessage?: (msg: NetMessage) => void;
  onDisconnected?: () => void;

  async host(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Generate a short readable code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.myCode = code;
      this.isHost = true;

      this.peer = new Peer(code);
      this.peer.on("open", () => resolve(code));
      this.peer.on("error", reject);

      this.peer.on("connection", (conn) => {
        this.conn = conn;
        this.setupConn();
      });
    });
  }

  async join(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      this.peer = new Peer();

      this.peer.on("open", () => {
        this.conn = this.peer.connect(code);
        this.setupConn();

        this.conn.on("open", () => resolve());
        this.conn.on("error", reject);
      });

      this.peer.on("error", (e) => reject(e));

      setTimeout(() => reject(new Error("Connection timed out")), 10000);
    });
  }

  private setupConn() {
    this.conn!.on("open", () => {
      this.onConnected?.();
    });

    this.conn!.on("data", (data) => {
      this.onMessage?.(data as NetMessage);
    });

    this.conn!.on("close", () => {
      this.onDisconnected?.();
    });
  }

  send(msg: NetMessage) {
    if (this.conn?.open) {
      this.conn.send(msg);
    }
  }

  destroy() {
    this.conn?.close();
    this.peer?.destroy();
  }
}
