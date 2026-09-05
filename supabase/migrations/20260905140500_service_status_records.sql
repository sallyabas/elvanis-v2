-- Service status (confirmed 2026-09-05, direct founder decision, revised
-- to one unified flow for every service type — fixed-price and Contact
-- Sales alike, no separate flows). Sibling table to payment_records, not
-- a repurposing of it (confirmed) — reuses the SAME payment_entity_type
-- enum (module_request/execution_sprint/session_request/report already
-- covers every real service, including Training & Advisory and Concierge
-- — both are session_requests under the hood) rather than defining a
-- duplicate enum for an identical set of entity kinds.
--
-- Status order, confirmed: Requested -> Booked (payment confirmed,
-- however it happened) -> Scheduled -> Completed -> Canceled.
--
-- Price is real, not payment_records' own `amount`/`status` fields
-- (which track invoicing/payment-confirmation state) — a genuinely
-- different axis (what this service costs vs. whether it's been paid),
-- confirmed as its own field: auto-populated from the known catalog
-- price for fixed-price services, or entered manually once negotiated
-- for Contact Sales services (Training & Advisory, Concierge).
--
-- note_locked_at implements the confirmed "two-way creation, one-way
-- editing" design (see reviewer_notes' own docblock): once a note here
-- has fed a reviewer_notes entry, this field is locked — any further
-- edit to this specific note must happen inside the Reviewer Notes list
-- itself, never by re-editing the original service record.
create type service_status_value as enum ('requested', 'booked', 'scheduled', 'completed', 'canceled');

create table service_status_records (
  id uuid primary key default gen_random_uuid(),
  entity_type payment_entity_type not null,
  entity_id uuid not null,
  status service_status_value not null default 'requested',
  price numeric,
  currency text default 'GBP',
  note text,
  note_locked_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);
