# Courier API

One courier-agnostic shipping API. Consumers send a `courier_partner` and our own order schema. Each operator
(UrbaneBolt, Delhivery, ...) is a separate adapter with settings stored in MySQL.

Node.js 20.11+, Express 5, Sequelize 6, MySQL, Zod, Axios, Pino, Vitest. Plain JavaScript (ES modules).

## Structure

```
courier-api/
├── server.js                  entry point: boot, recovery, listen, graceful shutdown
├── src/
│   ├── app.js                 Express setup (middlewares, routes, error handling)
│   ├── config/                env config, Sequelize connection, operator seed (couriers.json)
│   ├── controllers/           thin request handlers
│   ├── services/              business logic
│   │   └── couriers/          adapter registry + adapters (urbanebolt, mock) + shared http/token helpers
│   ├── repositories/          all database queries
│   ├── models/                Sequelize models
│   ├── routes/v1/             route definitions
│   ├── middlewares/           request context, api key, validation, not-found, error handler
│   ├── validations/           Zod schemas
│   ├── utils/                 errors, logger, status mapping, serializers, helpers
│   ├── jobs/                  bulk batch processor, startup recovery
│   ├── loaders/               wires database, repositories, events, services, jobs, controllers
│   └── events/                event bus and order event handlers
├── tests/                     unit/ and integration/
├── docker/                    Dockerfile, docker-compose.yml
├── scripts/                   migrate, seed, healthcheck
└── docs/                      Postman collection, curl examples
```

## Run

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d mysql
npm install
npm run dev
npm test
```

`npm test` uses in-memory SQLite through the same Sequelize models, so it needs no database server.
`docker compose -f docker/docker-compose.yml up` also starts the API container.

Tables are created on boot when `DB_AUTO_SYNC=true`, or run `npm run db:migrate`. `npm run db:seed` loads the operator
rows. `sync()` only creates missing tables, so use real migrations before changing the schema in production.

## Configuration

`.env` holds the database connection, service settings and each operator's credentials:

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX` | MySQL connection |
| `DB_DIALECT` | `mysql` (default) or `sqlite` |
| `<OPERATOR>_USERNAME`, `<OPERATOR>_PASSWORD` | for example `URBANEBOLT_USERNAME`, `DELHIVERY_PASSWORD` |
| `API_KEY` | optional, requires `x-api-key` on `/api/v1/*` |
| `PORT`, `LOG_LEVEL`, `BULK_MAX_SIZE`, `BULK_CONCURRENCY`, `COURIER_CONFIG_PATH` | service settings |

Operator settings (base URL, paths, customer code, timeouts, retries, enabled flag) live in the `courier_operators`
table. `src/config/couriers.json` only seeds that table on first boot and provides the default timeout and retry
policy. Rows already in the database are never overwritten, so edits made through the API survive restarts.
Passwords are never stored in the database; a row only stores the env variable names to read.

Set `customerCode` for UrbaneBolt in `couriers.json` (or through the API) before using it.

## API (`/api/v1`)

| Method | Path | |
|---|---|---|
| POST | `/orders` | create shipment, 201 new / 200 replay |
| GET | `/orders/{order_id}` | stored order |
| GET | `/orders/{order_id}/track?refresh=true` | poll courier, append new events, return history |
| POST | `/orders/{order_id}/cancel` | optional body `{courier_partner, reason}` |
| POST | `/orders/bulk` | `{ "orders": [...] }`, max 100, returns 202 and a `batch_id` |
| GET | `/orders/bulk/{batch_id}` | per-order results |
| GET | `/orders?status=&needs_reconciliation=` | list orders, for example failed ones to reconcile |
| GET | `/couriers` | active `courier_partner` values |
| GET | `/operators`, `/operators/{code}` | operator settings and whether the adapter is active |
| PATCH | `/operators/{code}` | `{enabled?, settings?, runtime?, credentials_env?}`, merged and applied immediately |

Every error uses one shape:

```json
{ "success": false, "error": { "code": "UNKNOWN_COURIER", "message": "Unsupported courier_partner 'dhl'",
  "details": { "field": "courier_partner", "supported_couriers": ["mock", "urbanebolt"] }, "request_id": "..." } }
```

| Code | HTTP |
|---|---|
| `VALIDATION_ERROR`, `INVALID_JSON`, `BATCH_TOO_LARGE`, `UNKNOWN_COURIER` | 400 |
| `UNAUTHORIZED` | 401 |
| `ORDER_NOT_FOUND`, `BATCH_NOT_FOUND`, `OPERATOR_NOT_FOUND`, `NOT_FOUND` | 404 |
| `ORDER_ID_CONFLICT`, `ORDER_IN_PROGRESS`, `INVALID_ORDER_STATE` | 409 |
| `COURIER_VALIDATION_ERROR`, `COURIER_UNSERVICEABLE`, `COURIER_REJECTED` | 422 |
| `COURIER_AUTH_FAILED`, `COURIER_UNAVAILABLE` | 502 |
| `COURIER_RATE_LIMITED` | 503 |
| `COURIER_TIMEOUT` | 504 |

## Database

| Table | Model | Purpose |
|---|---|---|
| `orders` | `Order` | order, courier ids, AWB, status, full courier request and response, failure info |
| `tracking_events` | `TrackingEvent` | append-only history, unique per `(order_id, dedupe_key)`, update and delete blocked in the model |
| `bulk_batches`, `bulk_batch_items` | `BulkBatch`, `BulkBatchItem` | bulk jobs and per-order results |
| `courier_operators` | `CourierOperator` | per-operator settings |

## Adding an operator (for example Delhivery)

1. Create `src/services/couriers/delhivery/index.js` with a default export `{ code, displayName, enabled(ctx), create(ctx) }`.
   `couriers/mock` is the smallest example, `couriers/urbanebolt` the full HTTP one using `CourierHttpClient` and `TokenAuth`.
2. Add `DELHIVERY_USERNAME` and `DELHIVERY_PASSWORD` to `.env`.
3. Add its settings with `PATCH /api/v1/operators/delhivery`, or add a block to `couriers.json` before the first boot.

No route, validation, service or other adapter changes. Adapter folders are discovered at boot.

## Notes

- The UrbaneBolt Postman documentation could not be read as text, so request and response field names are best-effort
  and isolated in `src/services/couriers/urbanebolt/mapper.js`. Verify them against one UAT call.
- Bulk jobs run inside the API process and resume from the database after a restart. Swap `BulkBatchJob.schedule` for a
  queue if you need several API nodes.
- Orders left in an unknown state (timeout, crash) get `needs_reconciliation = true`.
- MySQL was not available where this was built. Tests run the same models on SQLite.
