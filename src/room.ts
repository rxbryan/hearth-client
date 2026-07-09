import { Socket, Channel, Presence as PhoenixPresence } from "phoenix";
import type { Message, Presence, JoinOptions } from "./types";
import { UnauthorizedError } from "./errors";

type MessageHandler = (msg: Message) => void;
type PresenceHandler = (state: Presence) => void;

export class Room {
  private lastSeq = 0;
  private messageHandlers: MessageHandler[] = [];
  private presenceHandlers: PresenceHandler[] = [];
  public history: Message[] = [];
  private presence: PhoenixPresence;

  private constructor(
    public readonly name: string,
    private readonly channel: Channel,
  ) {
    this.presence = new PhoenixPresence(channel);
  }

  static join(socket: Socket, name: string, token: string, opts: JoinOptions): Promise<Room> {
    const channel = socket.channel(`room:${name}`, {
      token,
      who: opts.who,
    });
    const room = new Room(name, channel);
    room.wireEvents();

    return new Promise((resolve, reject) => {
      channel
        .join()
        .receive("ok", () => resolve(room))
        .receive("error", (reason) => reject(new UnauthorizedError(JSON.stringify(reason))));
    });
  }

  send(body: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.channel
        .push("message", { body })
        .receive("ok", (reply: { seq: number }) => resolve(reply.seq))
        .receive("error", reject);
    });
  }

  typing(isTyping: boolean): void {
    this.channel.push("typing", { typing: isTyping });
  }

  on(event: "message", handler: MessageHandler): void;
  on(event: "presence", handler: PresenceHandler): void;
  on(event: "message" | "presence", handler: MessageHandler | PresenceHandler): void {
    if (event === "message") this.messageHandlers.push(handler as MessageHandler);
    else this.presenceHandlers.push(handler as PresenceHandler);
  }

  leave(): void {
    this.channel.leave();
  }

  private wireEvents(): void {
    this.channel.on("message", (msg: Message) => this.deliver(msg));
    // On join the server sends the recent tail + current seq as room_state.
    this.channel.on("room_state", (state: { messages: Message[]; seq: number }) => {
      for (const msg of state.messages) this.deliver(msg);
      // seq is the room's high-water mark; deliver() already advances lastSeq,
      // but set it explicitly in case the tail was empty.
      if (state.seq > this.lastSeq) this.lastSeq = state.seq;
    });

    this.presence.onSync(() => {
      const present = this.presence.list((id, { metas }) => ({ id, metas }));
      this.presenceHandlers.forEach((h) => h(present));
    });
  }

  // single path for both live and replayed messages: order-preserving, deduped
  private deliver(msg: Message): void {
    if (msg.seq <= this.lastSeq) return;
    this.lastSeq = msg.seq;
    this.history.push(msg);
    this.messageHandlers.forEach((h) => h(msg));
  }
}
