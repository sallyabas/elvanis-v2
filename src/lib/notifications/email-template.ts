import { signUnsubscribeToken } from "./unsubscribe-token";
import { PREFERENCE_LABELS, type NotificationPreferences } from "./preferences";

/**
 * One shared, branded HTML email shell (confirmed 2026-09-03, email
 * redesign brief) — every notification this app sends now renders inside
 * this, replacing 16+ independent bare-`<p>` fragments with no shared
 * visual identity. Table-based layout with inline styles throughout —
 * real email clients (Outlook in particular) don't reliably support
 * modern CSS or `<style>` blocks the way a browser does, so this
 * deliberately doesn't reuse this app's own Tailwind classes; it's a
 * hand-written, email-safe recreation of the same charcoal/copper/cream
 * palette (`#2C2C2A` / `#B87333` / `#F1EFE8`, matching globals.css).
 *
 * The wordmark is real styled TEXT, not an image — a deliberate choice,
 * not a placeholder: many email clients block remote images by default
 * until a person clicks "show images," which would make an image-based
 * logo invisible on first open for a lot of real recipients. A styled
 * text wordmark always renders. (If a real logo asset is added to the
 * repo later, swapping this header for an `<img>` is a small, isolated
 * change — this function is the only place that would need it.)
 */

const CHARCOAL = "#2C2C2A";
const COPPER = "#B87333";
const CREAM = "#F1EFE8";
const INK = "#1a1a1a";
const MUTED = "#6b6b69";

export interface EmailShellOptions {
  /** Inner content HTML — plain <p>/<a> fragments, styled by the shell around them. */
  bodyHtml: string;
  /** Recipient's own address, shown in the footer ("This was sent to ..."). */
  recipientEmail: string;
  /**
   * Present only for client-facing emails (confirmed 2026-09-03: reviewer
   * emails stay fully out of unsubscribe scope, matching the existing
   * "opting out could break their own workflow" design call) — renders a
   * real, signed unsubscribe link for this one event type, plus a
   * separate "unsubscribe from everything" link, both pointing at the
   * public /unsubscribe confirm page (never an auto-acting link — see
   * that page's own docblock for why).
   */
  unsubscribe?: {
    recipientId: string;
    preferenceKey: keyof NotificationPreferences;
  };
  siteUrl: string;
}

function wordmark(): string {
  return `
    <tr>
      <td style="background:${CHARCOAL};padding:28px 32px;border-radius:8px 8px 0 0;" align="center">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:0.06em;color:#ffffff;">
          EL<span style="color:${COPPER};">V</span>ANIS
        </span>
      </td>
    </tr>`;
}

function footer(opts: EmailShellOptions): string {
  const year = new Date().getFullYear();
  let unsubscribeHtml = "";
  if (opts.unsubscribe) {
    const typeToken = signUnsubscribeToken(opts.unsubscribe.recipientId, opts.unsubscribe.preferenceKey);
    const allToken = signUnsubscribeToken(opts.unsubscribe.recipientId, "all");
    const typeLabel = PREFERENCE_LABELS[opts.unsubscribe.preferenceKey];
    unsubscribeHtml = `
        <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};">
          <a href="${opts.siteUrl}/unsubscribe?token=${encodeURIComponent(typeToken)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe from ${typeLabel}</a>
          &nbsp;·&nbsp;
          <a href="${opts.siteUrl}/unsubscribe?token=${encodeURIComponent(allToken)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe from all emails</a>
        </p>`;
  }
  return `
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #e8e8e8;" align="center">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};">
          © ${year} Elvanis · Sent to ${opts.recipientEmail}
        </p>
        ${unsubscribeHtml}
      </td>
    </tr>`;
}

export function renderEmail(opts: EmailShellOptions): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px 12px;background:${CREAM};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            ${wordmark()}
            <tr>
              <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${INK};">
                ${opts.bodyHtml}
              </td>
            </tr>
            ${footer(opts)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
