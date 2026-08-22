import "server-only";

/**
 * A deliberately thin seam over the email provider. Nothing above this file
 * knows that Resend exists, so swapping providers means writing one class.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Attached so recipients can add the session to any calendar app. */
  ics?: { filename: string; content: string };
};

export type SendResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "failed"; error: string };

export interface Mailer {
  readonly name: string;
  send(email: OutboundEmail): Promise<SendResult>;
}

class ResendMailer implements Mailer {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(email: OutboundEmail): Promise<SendResult> {
    const { Resend } = await import("resend");
    const client = new Resend(this.apiKey);

    const { data, error } = await client.emails.send({
      from: this.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.ics
        ? [
            {
              filename: email.ics.filename,
              content: Buffer.from(email.ics.content).toString("base64"),
            },
          ]
        : undefined,
    });

    if (error) return { status: "failed", error: error.message };
    return { status: "sent", providerMessageId: data?.id ?? null };
  }
}

/**
 * Used when no provider is configured. Writes the message to the server log so
 * the whole notification flow — including the logs table — can be exercised in
 * development without sending anything.
 */
class ConsoleMailer implements Mailer {
  readonly name = "console";

  async send(email: OutboundEmail): Promise<SendResult> {
    console.info(
      `[studio954] email not sent — no provider configured\n  to: ${email.to}\n  subject: ${email.subject}`,
    );
    return { status: "sent", providerMessageId: null };
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function getMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey && from) return new ResendMailer(apiKey, from);
  return new ConsoleMailer();
}
