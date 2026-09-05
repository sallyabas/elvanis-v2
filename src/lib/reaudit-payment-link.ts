/**
 * Real Payoneer payment link for the £149 Core Audit re-audit (confirmed
 * 2026-09-06, re-audit payment gate) — same "no in-app checkout, payment
 * confirmed manually/externally" pattern as module-meta.ts's own
 * per-module links. One shared constant so both the client-facing gate
 * (ReAuditPaymentGate.tsx) and the locked "awaiting payment" view
 * (evidence-intake/page.tsx) can't drift on which link they show.
 *
 * PLACEHOLDER — NOT a real, working link. The founder is generating the
 * real £149 Payoneer request link separately and will send it once this
 * feature is otherwise ready; swap this one constant when it arrives, no
 * other file needs to change.
 */
export const REAUDIT_PAYONEER_LINK = "https://link.payoneer.com/REPLACE_WITH_REAL_CORE_AUDIT_REAUDIT_149_LINK";
