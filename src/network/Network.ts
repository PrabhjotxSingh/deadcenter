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
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.myCode = code;
      this.isHost = true;

      // Use explicit PeerJS cloud config for reliability
      this.peer = new Peer(code, {
        host: "0.peerjs.com",
        port: 443,
        path: "/",
        secure: true,
        debug: 2,
      });

      this.peer.on("open", (id) => {
        console.log("Hosting with code:", id);
        resolve(id);
      });

      this.peer.on("error", (e) => {
        console.error("Host peer error:", e);
        reject(e);
      });

      this.peer.on("connection", (conn) => {
        console.log("Guest connected!");
        this.conn = conn;
        this.setupConn();
      });
    });
  }

  async join(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isHost = false;

      this.peer = new Peer({
        host: "0.peerjs.com",
        port: 443,
        path: "/",
        secure: true,
        debug: 2,
      });

      this.peer.on("open", () => {
        console.log("Joining game with code:", code);
        this.conn = this.peer.connect(code, {
          reliable: true,
        });

        this.conn.on("open", () => {
          console.log("Connected to host!");
          resolve();
        });

        this.conn.on("error", (e) => {
          console.error("Connection error:", e);
          reject(e);
        });

        this.setupConn();
      });

      this.peer.on("error", (e) => {
        console.error("Join peer error:", e);
        reject(e);
      });

      setTimeout(() => reject(new Error("Connection timed out")), 15000);
    });
  }

  private setupConn() {
    if (!this.conn) return;

    this.conn.on("open", () => {
      console.log("Connection open!");
      this.onConnected?.();
    });

    this.conn.on("data", (data) => {
      this.onMessage?.(data as NetMessage);
    });

    this.conn.on("close", () => {
      console.log("Connection closed");
      this.onDisconnected?.();
    });

    this.conn.on("error", (e) => {
      console.error("Conn error:", e);
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
