-- Real re-audit price, confirmed 2026-09-06 — closes a real gap:
-- standard_core_audit's own seed note already said "re-audits are always
-- paid" (2026-08-06) but no price ever backed that claim anywhere in the
-- pricing table. £149 confirmed by the founder — deliberately below the
-- real time cost (2-3 hours reviewer time), priced to make re-auditing
-- accessible enough that clients actually do it. Per-company discretionary
-- pricing (e.g. a lower founding-client rate) is a deliberately deferred
-- future feature (see CLAUDE.md) — this is one fixed, uniform price for
-- now, same admin-adjustable pattern as every other row in this table.
insert into pricing (item_key, display_name, price_amount, currency, is_placeholder, notes) values
  ('core_audit_reaudit', 'Core Audit re-audit', 149, 'GBP', false, 'Standard re-audit price for a company''s 2nd+ Core Audit cycle — always paid, first audit is free.');
