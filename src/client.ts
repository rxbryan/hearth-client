import type { ClaimResult, InviteResult, InviteOptions, JoinOptions } from "./types";
import { Room } from "./room";
import { RoomAlreadyClaimedError, NotOwnerError, HearthRequestError } from "./errors";
import { Socket } from "phoenix";

export class Hearth {
  private socket?: Socket | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly socketUrl = baseUrl.replace(/^http/, "ws") + "/socket",
  ) {}

  async claim(room: string): Promise<ClaimResult> {
    const res = await this.post("/api/rooms", { room });

    if (res.ok) {
      const body = await res.json();
      return { room: body.room, ownerToken: body.owner_token };
    }
    if (res.status === 409) throw new RoomAlreadyClaimedError(room);
    throw await this.toError(res);
  }

  async invite(room: string, ownerToken: string, opts: InviteOptions = {}): Promise<InviteResult> {
    const ttlSeconds = opts.ttlSeconds ?? 3600;
    const res = await this.post(`/api/rooms/${encodeURIComponent(room)}/invites`, {
      room,
      owner_token: ownerToken,
      ttl_seconds: ttlSeconds,
    });

    if (res.ok) {
      const body = await res.json();
      return { room: body.room, inviteToken: body.invite_token, ttlSeconds };
    }
    if (res.status === 403) throw new NotOwnerError(room);
    throw await this.toError(res);
  }

  async join(roomName: string, token: string, opts: JoinOptions = {}): Promise<Room> {
    const socket = this.ensureSocket();
    return Room.join(socket, roomName, token, opts);
  }

  private post(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async toError(res: Response): Promise<HearthRequestError> {
    const code = await res
      .json()
      .then((b) => b.error ?? "unknown")
      .catch(() => "unknown");
    return new HearthRequestError(res.status, code);
  }

  private ensureSocket(): Socket {
    if (!this.socket) {
      this.socket = new Socket(this.socketUrl);
      this.socket.connect();
    }
    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
