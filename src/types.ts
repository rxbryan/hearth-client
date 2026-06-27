export interface ClaimResult {
  room: string;
  ownerToken: string;
}

export interface InviteResult {
  room: string;
  inviteToken: string;
  ttlSeconds: number;
}

export interface InviteOptions {
  ttlSeconds?: number;
}

export interface Message {
  seq: number;
  body: string;
}

export interface JoinOptions {
  who?: string;
}

export type Presence = Record<string, { metas: Array<Record<string, unknown>> }>;
