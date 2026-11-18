# Design

## Layers

```
routes -> middlewares (request id, api key, validation) -> controllers -> services -> repositories -> models -> MySQL
                                                                       \-> services/couriers (registry -> adapter -> courier API)
loaders wire everything together, jobs run background work, events decouple side effects
```

- Controllers only read validated input, call one service method and serialize the result.
- `OrderService` resolves an adapter by `courier_partner` from the registry. It never imports a concrete courier, so a new
  courier is a new folder under `services/couriers/` that is discovered at boot.
- `OperatorService` builds adapters from `courier_operators` rows plus credentials read from env and swaps them in the
  registry when an operator is patched. The adapter is built before the row is saved, so bad settings never replace a working one.
- `CourierHttpClient` holds timeout, retry with backoff and jitter, one re-auth on 401 and error normalisation.
  `TokenAuth` caches the token and refreshes it once at a time.
- `loaders/` builds the dependency graph in one place (`bootstrap`), which is also what the tests use.

## Events and jobs

- `events/`: `OrderService` emits `order.created`, `order.cancelled` and `order.failed`. Handlers write the system tracking
  events and the failure log. Handler errors are logged and never break the request.
- `jobs/bulkBatch.job.js`: processes bulk batches with a bounded worker pool, each item running the same idempotent create
  used by `POST /orders`. `jobs/recovery.job.js` runs at startup: orders left `PENDING` by a crash are marked
  `FAILED/INTERRUPTED` with `needs_reconciliation`, then unfinished batches are resumed.

## Data

- `orders`: `order_id` is the primary key and the idempotency key. `claim()` either inserts the row or hits the unique
  constraint, so only one request calls the courier for a given id. A `FAILED` order without an AWB is re-claimed with a
  conditional update and retried.
- `tracking_events`: insert-only. Model hooks reject update and destroy, and a unique index on `(order_id, dedupe_key)`
  makes repeated polling harmless.
- `bulk_batches` / `bulk_batch_items`: written before any courier call, so unfinished items can be resumed.
- `courier_operators`: one row per operator, JSON `settings`, `runtime` overrides, `credentials_env` names. No secrets.

## Bulk

`POST /orders/bulk` validates each item, stores the batch and returns 202 with a `batch_id`. Invalid items, unknown couriers
and in-batch duplicates are reported per order instead of failing the whole request. Clients poll `GET /orders/bulk/{batch_id}`.
Trade-off: the pool runs in the API process, so it survives restarts but does not spread across nodes.

## Errors

One error envelope everywhere. Courier 4xx responses are mapped to normalised codes and the raw body is only logged and
stored in the order's audit columns. 5xx, timeouts and network errors are retried, then the order is saved as `FAILED` with
`needs_reconciliation = true`. Logs carry `order_id`, `courier_partner`, `request_id`, `error_type` and the stack.

## Limits

- A timeout after the courier already created the shipment can duplicate it on retry unless the courier dedupes by order number.
- `sequelize.sync()` does not alter existing tables; add migrations before changing the schema in production.
