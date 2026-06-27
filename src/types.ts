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
