# Elvanis — Goal Relevance Ranking Rubric
**Version:** September 2026  
**Author:** Sally Abas  
**Purpose:** Consistent criteria for ranking findings by goal relevance in the reviewer workspace. Apply this rubric every time you reorder findings before approving a report.

---

## Why this rubric exists

The AI assigns a preliminary goal relevance score to each finding. That score is LLM judgment — not a deterministic rule. This rubric makes your override decisions consistent across reports, so a finding ranked #1 in August means the same thing as a finding ranked #1 in February.

The rubric does not replace your judgment. It structures it.

---

## The core question for every finding

**"If the client fixes only this one thing, how directly does it move the needle on their stated goal?"**

That question — and only that question — determines rank order. Not severity alone. Not financial impact alone. Not how impressive the finding sounds. Goal proximity.

---

## Goal-by-goal ranking criteria

### Goal: Growth / Revenue Efficiency
Rank highest findings that directly affect:
- Customer acquisition cost (CAC) or win rate
- Revenue concentration risk (single customer > 35% ARR is always top 3)
- Pricing pressure or competitive displacement causing revenue loss
- Sales cycle length or conversion rate
- Market positioning gaps blocking new customer acquisition

Rank lower findings that affect:
- Internal process efficiency with no direct revenue connection
- Team structure issues that don't yet show up in delivery speed
- AI governance gaps (unless they are blocking enterprise deals)

### Goal: Cash Flow / Margin Efficiency
Rank highest findings that directly affect:
- Gross margin (anything below 60% for SaaS is always top 3)
- Burn rate or runway (below 9 months remaining is always top 3)
- Cost structure — specific, identified cost drivers, not general observations
- Pricing below market rate for delivered value

Rank lower findings that affect:
- Growth metrics disconnected from cash position
- Team or process issues with no near-term cost impact

### Goal: Churn / Retention
Rank highest findings that directly affect:
- Annual logo churn above 10% (always top 3)
- Net Revenue Retention below 100% (always top 3)
- Activation rate below 40% (leading indicator — rank high)
- Support contact rate above 50% (symptom of product confusion)
- Onboarding gaps with traceable connection to early churn

Rank lower findings that affect:
- Acquisition metrics (relevant but not goal-proximate)
- Internal delivery speed unless directly tied to customer-visible bugs

### Goal: Execution Speed
Rank highest findings that directly affect:
- PR review pickup time above 4-hour benchmark
- Deployment frequency below weekly
- Decision latency — meetings without decisions, approvals taking days
- Backlog health — bug-to-feature ratio above 3:1
- Team structure blocking fast execution (no clear ownership, unclear escalation)

Rank lower findings that affect:
- Revenue or market positioning (real but not goal-proximate)
- Customer metrics unless they are causing reactive engineering work

### Goal: Product Delivery
Rank highest findings that directly affect:
- Roadmap predictability — shipping rate vs committed dates
- Engineering velocity blockers — tech debt causing delivery drag
- Specification quality — features delivered that don't match intent
- Stakeholder alignment gaps causing rework
- Missing release process causing quality issues

Rank lower findings that affect:
- Commercial or market metrics
- Financial metrics unless cash pressure is directly affecting the team's capacity to deliver

---

## Universal ranking rules — apply regardless of goal

**Rule 1 — Root causes rank above symptoms.**
If finding A is the root cause of finding B, finding A ranks higher even if finding B has a higher severity badge. Fixing symptoms first wastes the client's effort.

**Rule 2 — Blockers rank above accelerators.**
A finding that is actively preventing progress ranks above a finding that would speed up something already working.

**Rule 3 — Financial impact breaks ties.**
When two findings are equally goal-proximate, the one with the larger quantified financial impact ranks higher. If neither has a quantified impact, the one with higher confidence ranks higher.

**Rule 4 — Never rank a finding #1 that the client cannot act on.**
If a finding requires a dependency the client doesn't control (a third-party vendor, a regulatory body, a hiring market), it cannot be #1 regardless of severity. Move it to #2 or #3 and note the dependency.

**Rule 5 — AI & Governance findings rank at #1 only when they are actively blocking something.**
An AI literacy gap ranks #1 if it is blocking an enterprise deal or a regulatory approval. It ranks lower if it is a future risk with no active blocker today.

---

## The Top 3 check — before you approve

Before approving any report, ask yourself these three questions:

**1. If the client reads only the Top 3 and ignores everything else, will they fix the right things first?**
If no — reorder.

**2. Is there a root cause in the lower findings that is driving a Top 3 symptom?**
If yes — swap them. The root cause should be higher.

**3. Can the client act on all three of these in the next 30 days with their current resources?**
If no — replace the one they can't act on with the highest-ranked finding they can. Note the deferred finding with a reason.

---

## What to document when you override the AI ranking

In the Reviewer notes field, write one sentence explaining why you changed the order. Examples:

- "Moved CAC finding to #1 — it is the root cause of the revenue concentration finding at #3."
- "Moved AI literacy to #3 — no active enterprise deal blocker; revenue concentration is more urgent."
- "Swapped #2 and #3 — PR pickup time is causing the bug backlog, not a parallel issue."

These notes are not client-facing. They are your audit trail for consistency.

---

## Version history
- September 2026 — Initial version, Sally Abas
