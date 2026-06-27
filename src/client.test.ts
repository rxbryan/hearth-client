import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hearth } from "./client";
import { RoomAlreadyClaimedError, NotOwnerError } from "./errors";

function mockFetch(status: number, body: object) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("Hearth control face", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("claim returns the owner token, camelCased", async () => {
    vi.stubGlobal("fetch", mockFetch(201, { room: "lobby", owner_token: "tok_abc" }));
    const hearth = new Hearth("http://test");
    const result = await hearth.claim("lobby");
    expect(result).toEqual({ room: "lobby", ownerToken: "tok_abc" });
  });

  it("claim throws RoomAlreadyClaimedError on 409", async () => {
    vi.stubGlobal("fetch", mockFetch(409, { error: "room_already_claimed" }));
    const hearth = new Hearth("http://test");
    await expect(hearth.claim("lobby")).rejects.toThrow(RoomAlreadyClaimedError);
  });

  it("invite throws NotOwnerError on 403", async () => {
    vi.stubGlobal("fetch", mockFetch(403, { error: "not_owner" }));
    const hearth = new Hearth("http://test");
    await expect(hearth.invite("lobby", "bad_token")).rejects.toThrow(NotOwnerError);
  });
});
