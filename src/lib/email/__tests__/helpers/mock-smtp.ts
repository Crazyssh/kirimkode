/**
 * Mock SMTP_Sender for email-service tests.
 *
 * Mirrors the shape of the real sender defined in design.md
 * (`src/lib/email/smtp.ts`): `sendViaSmtp(email, cfg) => Promise<SendResult>`.
 * The mock never touches the network. It records every attempt and lets a test
 * deterministically simulate success or failure so that non-blocking delivery,
 * failure logging, and broadcast tally properties can be exercised.
 *
 * The types below are declared locally so this helper has no dependency on the
 * not-yet-implemented `smtp.ts` module (task 2.3).
 */

export interface MockOutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MockSmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  fromName: string;
}

export interface MockSendResult {
  ok: boolean;
  reason?: string;
}

/**
 * How the mock should respond to a send:
 * - "success": always resolve `{ ok: true }`
 * - "fail": always resolve `{ ok: false, reason }`
 * - "throw": reject with an Error (simulates connection/timeout crash)
 * - function: caller-supplied decision per email (may return sync or async)
 */
export type MockSmtpBehavior =
  | "success"
  | "fail"
  | "throw"
  | ((
      email: MockOutgoingEmail,
    ) => MockSendResult | Promise<MockSendResult>);

export interface MockSmtpOptions {
  behavior?: MockSmtpBehavior;
  /** Reason attached to failures when behavior is "fail". */
  failReason?: string;
  /** Message used when behavior is "throw". */
  throwMessage?: string;
}

export class MockSmtpSender {
  /** Every email the sender was asked to send, in order. */
  readonly attempts: MockOutgoingEmail[] = [];
  /** Emails that were sent successfully (ok === true). */
  readonly sent: MockOutgoingEmail[] = [];
  /** Emails whose send failed (ok === false or threw). */
  readonly failed: MockOutgoingEmail[] = [];

  behavior: MockSmtpBehavior;
  failReason: string;
  throwMessage: string;

  constructor(options: MockSmtpOptions = {}) {
    this.behavior = options.behavior ?? "success";
    this.failReason = options.failReason ?? "mock smtp failure";
    this.throwMessage = options.throwMessage ?? "mock smtp connection error";
  }

  /**
   * Drop-in replacement for `sendViaSmtp`. `cfg` is accepted for signature
   * compatibility but ignored by the mock.
   */
  send = async (
    email: MockOutgoingEmail,
    _cfg?: MockSmtpConfig,
  ): Promise<MockSendResult> => {
    this.attempts.push(email);

    if (typeof this.behavior === "function") {
      const result = await this.behavior(email);
      (result.ok ? this.sent : this.failed).push(email);
      return result;
    }

    switch (this.behavior) {
      case "success": {
        this.sent.push(email);
        return { ok: true };
      }
      case "fail": {
        this.failed.push(email);
        return { ok: false, reason: this.failReason };
      }
      case "throw": {
        this.failed.push(email);
        throw new Error(this.throwMessage);
      }
    }
  };

  /** Clear all recorded state (useful between fast-check iterations). */
  reset(): void {
    this.attempts.length = 0;
    this.sent.length = 0;
    this.failed.length = 0;
  }
}

/** Convenience factory. */
export function createMockSmtpSender(
  options?: MockSmtpOptions,
): MockSmtpSender {
  return new MockSmtpSender(options);
}
