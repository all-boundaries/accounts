create table account (
  id        text primary key,
  name      text not null,
  status    text not null check (status in ('open','closed')),
  opened_at timestamptz not null,
  closed_at timestamptz
);

-- Written in the transaction that changes an account; a relay publishes it to the broker.
create table outbox (
  message_id text primary key,
  topic      text not null,
  key        text not null,
  payload    text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

create index outbox_unsent on outbox (created_at) where sent_at is null;
