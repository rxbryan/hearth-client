# hearth-client

Light weight client for [Hearth](https://github.com/rxbryan/hearth). It presents one small interface over both of Hearth's surfaces: an HTTP control plane for provisioning rooms and minting
capabilities, and a WebSocket runtime plane for live messaging.

## Install

```bash
npm install hearth-client
```

## Quickstart

```ts
import { Hearth } from "hearth-client";

const hearth = new Hearth("http://localhost:4000");

// Claim a room.
const { ownerToken } = await hearth.claim("lobby");

// Mint a short-lived invite to hand to someone else.
const { inviteToken } = await hearth.invite("lobby", ownerToken, { ttlSeconds: 600 });

// Join with a token.
const room = await hearth.join("lobby", inviteToken, { who: "sarah" });

// Listen for messages and presence.
room.on("message", (msg) => console.log(`#${msg.seq}: ${msg.body}`));
room.on("presence", (state) => console.log("here:", Object.keys(state)));

// Send a message: returns the server assigned sequence number.
const seq = await room.send("hello");

room.typing(true);
room.leave();
```

## working with the client

Hearth has no accounts. Access is by **bearer token**: whoever holds a valid
token for a room may act on it. An **owner token** is your long-lived key to 
a room you claimed and can mint invites; an **invite token** is a short-lived capability you hand to a joiner.

The client hides the transport, deriving both the HTTP
endpoint (for claim/invite) and the WebSocket endpoint (for the live room) from
the base url.

The client recover missed messages after a disconnect without gaps or duplicates use the last seen messages seqence number.

## API

### Control plane

```ts
hearth.claim(room: string): Promise<{ room: string; ownerToken: string }>
hearth.invite(room, ownerToken, opts?: { ttlSeconds?: number }): Promise<{ room; inviteToken; ttlSeconds }>
```

`claim` throws `RoomAlreadyClaimedError` if the name is taken. `invite` throws
`NotOwnerError` if the token does not own the room. All SDK errors extend
`HearthError`.

### Runtime plane

```ts
hearth.join(room, token, opts?: { who?: string }): Promise<Room>

room.send(body: string): Promise<number>   // resolves with the assigned sequence
room.typing(isTyping: boolean): void
room.on("message", (msg) => void)           // { seq, body }
room.on("presence", (state) => void)         // who is here / typing
room.history: Message[]                       // recent messages, loaded on join
room.leave(): void
```

`join` throws `UnauthorizedError` if the token is rejected for the room.

## Coverage

The client reaches every Hearth route and channel event:

- [x] `POST /api/rooms`  claim a room (`hearth.claim`)
- [x] `POST /api/rooms/:room/invites`  mint an invite (`hearth.invite`)
- [x] channel join with token (`hearth.join`)
- [x] `shout` send and receive messages (`room.send`, `room.on("message")`)
- [x] `typing` typing indicator (`room.typing`)
- [x] `presence_state` / `presence_diff` presence (`room.on("presence")`)
- [x] `replay` missed-message catch-up on join (consumed; deduped by sequence)

## Status

The control and runtime faces are complete and the client exercises every
route and channel above. Work tracked in
[issues](https://github.com/rxbryan/hearth-client/issues):

## Development

```bash
npm install
npm run build        
npm test             
npm run lint         
npm run format       
```
