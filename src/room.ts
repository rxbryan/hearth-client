import { Socket, Channel } from "phoenix";
import type { Message, Presence, JoinOptions } from "./types";
import { UnauthorizedError } from "./errors";

type MessageHandler = (msg: Message) => void;
type PresenceHandler = (state: Presence) => void;

export class Room {
  private lastSeq = 0;
  private messageHandlers: MessageHandler[] = [];
  private presenceHandlers: PresenceHandler[] = [];
  public history: Message[] = [];

  private constructor(
    public readonly name: string,
    private readonly channel: Channel,
  ) {}

  static join(socket: Socket, name: string, token: string, opts: JoinOptions): Promise<Room> {
    const channel = socket.channel(`room:${name}`, {
      token,
      who: opts.who,
      since_seq: 0,
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
        .push("shout", { body })
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
    this.channel.on("shout", (msg: Message) => this.deliver(msg));

    this.channel.on("replay", (batch: { messages: Message[] }) => {
      // missed messages arrive as one batch; unroll through the same path as live
      for (const msg of batch.messages) this.deliver(msg);
    });

    this.channel.on("presence_state", (state: Presence) => {
      this.presenceHandlers.forEach((h) => h(state));
    });
    this.channel.on("presence_diff", (state: Presence) => {
      this.presenceHandlers.forEach((h) => h(state));
    });

    // TODO: reconnect-with-replay. On socket reconnect, re-join with
    // since_seq: this.lastSeq so the server replays the gap.
  }

  // single path for both live and replayed messages: order-preserving, deduped
  private deliver(msg: Message): void {
    if (msg.seq <= this.lastSeq) return;
    this.lastSeq = msg.seq;
    this.history.push(msg);
    this.messageHandlers.forEach((h) => h(msg));
  }
}
