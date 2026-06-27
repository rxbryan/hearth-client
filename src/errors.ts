export class HearthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomAlreadyClaimedError extends HearthError {}
export class NotOwnerError extends HearthError {}
export class UnauthorizedError extends HearthError {}
export class HearthRequestError extends HearthError {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`request failed (${status}): ${code}`);
  }
}
