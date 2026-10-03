/**
 * Domain error (layer: domain).
 *
 * Business failures throw a DomainError carrying a stable, machine-readable `code`.
 * Transport adapters map the code to their own error shape (HTTP status / MCP isError).
 * Messages must be user-safe and expose no system internals or other users' identities.
 */

export const DomainErrorCode = {
  INVALID_GROUP: "INVALID_GROUP",
  NOT_A_MEMBER: "NOT_A_MEMBER",
  SPLIT_TARGET_NOT_MEMBER: "SPLIT_TARGET_NOT_MEMBER",
  SPLIT_MISMATCH: "SPLIT_MISMATCH",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  DUPLICATE_PARTICIPANT: "DUPLICATE_PARTICIPANT",
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DomainError";
  }
}
