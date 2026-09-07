/**
 * Real Payoneer payment link for the £149 Core Audit re-audit (confirmed
 * 2026-09-06, re-audit payment gate; real link wired in 2026-09-07) —
 * same "no in-app checkout, payment confirmed manually/externally"
 * pattern as module-meta.ts's own per-module links. One shared constant
 * so both the client-facing gate (ReAuditPaymentGate.tsx) and the locked
 * "awaiting payment" view (evidence-intake/page.tsx) can't drift on
 * which link they show.
 */
export const REAUDIT_PAYONEER_LINK = "https://link.payoneer.com/Token?t=F61D8905C00D46F39361F3F6A428B230&src=pl";
