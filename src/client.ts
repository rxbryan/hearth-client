import type { ClaimResult, InviteResult, InviteOptions } from "./types";
import { RoomAlreadyClaimedError, NotOwnerError, HearthRequestError } from "./errors";

export class Hearth {
  constructor(private readonly baseUrl: string) {}

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
}
