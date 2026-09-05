# Elvanis — Reviewer Quality Rubric
**Version:** September 2026  
**Author:** Sally Abas  
**Purpose:** Consistent standards for accepting, editing, and rejecting findings in the reviewer workspace. Apply this rubric to every finding on every report before approving.

---

## Why this rubric exists

You are the single reviewer on every report. There is no second reviewer, no formal review board, no automated quality check on your judgment. That is an honest, disclosed limitation of Elvanis at this stage.

This rubric exists to make your single-reviewer judgment as consistent and defensible as possible — so that a CRITICAL finding in a report you reviewed on a Friday afternoon means the same thing as one you reviewed on a Tuesday morning.

---

## The four reviewer decisions

Every finding requires one of four decisions. Nothing leaves in a "needs decision" state.

### Accept
Use when: the AI-drafted finding is accurate, specific, and actionable as written. The diagnosis correctly identifies the problem. The root cause is plausible given the submitted evidence. The recommended action is concrete and achievable.

**The accept test — three questions:**
1. Is the diagnosis grounded in something the client actually submitted, not inferred from nothing?
2. Would a competent operator reading this finding know exactly what to investigate first?
3. Is the severity badge correct for the actual business impact described?

If yes to all three — Accept.

### Edit
Use when: the finding is directionally correct but the wording is imprecise, the recommended action is too vague, the severity is miscalibrated, or the financial impact estimate needs adjustment.

**Edit, do not accept, when:**
- The recommended action says "consider improving" or "explore options" — rewrite to a specific first step
- The diagnosis identifies the symptom but not the mechanism — add one sentence explaining why
- The severity is HIGH but the finding has no financial consequence — downgrade to MEDIUM
- The severity is MEDIUM but the finding is actively blocking the client's stated goal — upgrade to HIGH
- The financial impact range is wider than 3x (e.g. £10,000–£120,000) — narrow it or remove the estimate and explain why in reviewer notes

**The edit standard:** After your edit, the finding should pass the Accept test. If you edit something and it still doesn't pass the Accept test, Reject it and note why.

### Reject
Use when: the finding is not grounded in submitted evidence, duplicates another finding, is too generic to be actionable, or is factually incorrect given what the client submitted.

**Reject when:**
- The diagnosis would apply to any company in any industry — it has no specificity to this client's evidence
- The finding is a restatement of another finding already in the report with different wording
- The AI has hallucinated a specific metric that was not in the submitted evidence (e.g. "your CAC is £450" when no CAC data was submitted)
- The finding contradicts something else in the report that you have already accepted (conflict detection should catch this, but check manually)

**When you reject a finding:** Write one sentence in Reviewer notes explaining why. This is your audit trail.

### Add Concierge Note
Use when: a finding is accepted or edited but requires additional human context that the AI cannot provide — your own pattern recognition from similar companies, a caveat about data quality, a suggestion to discuss in the Delivery Session.

Concierge notes are visible to the client. Write them as you would speak to the client directly. Do not add a Concierge note just to look thorough — add one only when it genuinely adds something the finding text does not already say.

---

## Severity calibration guide

The AI assigns severity. You override it when it is wrong. Here are the calibration standards:

### CRITICAL
Reserved for findings where inaction in the next 30 days creates material business risk. Examples:
- Revenue concentration above 35% in a single customer with no diversification plan
- Cash runway below 6 months with no fundraising underway
- AI in production with zero governance documentation and no AI use inventory — confirmed through AI & Governance lens evidence (core audit finding)
- Active procurement questionnaire with no compliance documentation submitted — Tender Readiness module finding, always CRITICAL when the deadline is active
- Churn above 15% annually with no identified root cause
- A regulatory compliance gap with an active deadline (e.g. procurement questionnaire due in 30 days)

**CRITICAL means: this finding should be in the Top 3. If it is not, reorder.**

### HIGH
Findings that will become CRITICAL within 90 days if unaddressed, or that are directly limiting the client's stated goal right now.

### MEDIUM
Real findings with real consequences but no immediate urgency. Worth addressing in the 60–90 day window.

### LOW
Genuine observations worth noting but with minimal near-term impact. A client who fixes only CRITICAL and HIGH findings and ignores LOW findings is making the right decision.

**Do not reject LOW findings.** They are honest observations. Reject only findings that are wrong or unsupported — not findings that are less urgent.

---

## Financial impact calibration

The system guards against fabricated or degenerate figures. Your job is to assess whether the figures that pass the guard are reasonable.

**Accept the financial impact estimate when:**
- The range is based on a metric the client submitted (e.g. their stated MRR, their stated churn rate)
- The methodology is stated in the assumptions field
- The range is no wider than 3–4x (e.g. £20,000–£60,000 is acceptable; £10,000–£120,000 is too wide)

**Edit the financial impact estimate when:**
- The range is too wide — narrow it based on the evidence
- The methodology assumes a metric the client did not submit — remove that assumption and adjust the range

**Remove the financial impact estimate entirely when:**
- No submitted evidence supports any quantification
- The finding is qualitative (e.g. "team alignment is weak") with no traceable financial mechanism

When you remove an estimate, write one sentence in Reviewer notes: "Financial impact removed — insufficient evidence to quantify."

---

## Evidence quality check

Before accepting any finding, ask: **what in the submitted evidence supports this?**

The system guarantees that missing evidence is flagged as a finding. But it does not guarantee that the AI correctly interpreted evidence that was submitted.

Check for:
- Metrics cited in the finding that match what the client submitted
- Benchmarks cited (e.g. "below the 45% top-quartile benchmark") — confirm these are from the system's benchmark library, not invented
- Root cause claims — are they plausible given the evidence, or are they the AI's best guess with no evidentiary support?

If a finding cites a specific number and you cannot trace it to submitted evidence — Edit to remove the specific number, or Reject if the whole finding depends on it.

---

## The five-minute pre-approval check

Before clicking "Approve report" run this check — it takes five minutes and catches the most common errors:

**1. Top 3 check (see goal relevance rubric)**
Are the right three findings at the top? Apply the goal relevance rubric if you haven't already.

**2. Duplicate check**
Read all findings. Is any finding a restatement of another? If yes — reject the weaker one.

**3. Contradiction check**
Does any finding contradict another? (The conflict detection system flags these, but check manually too.) If yes — resolve the contradiction in your edits before approving.

**4. Severity distribution check**
If every finding is CRITICAL — that is probably wrong. Real companies have a distribution. If you have more than 3 CRITICAL findings, re-examine whether the calibration is correct.
If you have zero CRITICAL findings — that is also probably wrong for a company seeking diagnosis. Check whether any HIGH findings should be upgraded.

**5. Actionability check**
Read each recommended action. Can the client do this with their current team in the next 30 days? If the recommended action requires hiring, a significant budget, or a vendor they don't have — note this in a Concierge note so they know what to expect.

---

## Time standards

These are targets, not guarantees. Elvanis discloses a 48-hour turnaround target for modules and 72 hours for core audits.

- Core audit review: target 2–3 hours of focused review time
- Module review (Tender Readiness, AI Reliability, Data Protection): target 1–2 hours
- If a review is taking longer: it usually means the evidence was sparse or contradictory — add a Concierge note explaining what you needed and couldn't find

**Never rush a review to hit the time target.** The time target is a commercial commitment, not a quality override. If a review needs more time, communicate with the client rather than approve a weaker report.

---

## What "human-reviewed" means and what it doesn't

Elvanis's core guarantee is that every finding is accepted, edited, or rejected by a human reviewer before the client sees it. This is enforced at the system level.

What this means: no finding reaches a client that you have not personally assessed.

What this does not mean: that your assessment is infallible, that the finding is legally certified, or that a second qualified expert would reach the same conclusion.

When in doubt about a finding — especially in AI Reliability or compliance modules — the right action is to downgrade severity, add a Concierge note flagging the uncertainty, and raise it in the Delivery Session rather than reject a finding that might be correct.

---

## Version history
- September 2026 — Initial version, Sally Abas
