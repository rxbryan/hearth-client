import type { ClaimResult, InviteResult, InviteOptions, JoinOptions, Message } from "./types";
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

  async messages(
    room: string,
    token: string,
    opts: { after?: number; limit?: number } = {},
  ): Promise<{ messages: Message[]; nextCursor: number | null }> {
    const params = new URLSearchParams();
    if (opts.after !== undefined) params.set("after", String(opts.after));
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    const qs = params.toString();
    const path = `/api/rooms/${encodeURIComponent(room)}/messages${qs ? `?${qs}` : ""}`;

    const res = await this.get(path, token);
    if (res.ok) {
      const body = await res.json();
      return { messages: body.messages, nextCursor: body.next_cursor };
    }
    throw await this.toError(res);
  }

  private get(path: string, token: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
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
