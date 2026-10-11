# TicketHub — System Design

A design document for **TicketHub**, a website that sells tickets for concerts and events.

---

## 1. Requirements

### Functional requirements

- Users can browse a list of events and view one event's details.
- Users can see which seats are available for an event.
- Users can **hold** a seat for a short time while they pay (a "hold" lasts 10 minutes).
- Users can pay for their held seats and receive a confirmed ticket.
- Users can view the tickets they have bought.
- Organisers can create events and define their seats.

### Non-functional requirements

- **Speed:** browsing pages load in under 1 second; holding a seat responds in under 500 ms even at peak.
- **Correctness:** **a seat can never be sold twice** — this is the hard rule the whole design protects.
- **Fairness:** when a popular concert goes on sale, everyone who tries has a reasonable chance; one user cannot take 100 seats with a script.
- **Availability:** 99.9% during normal hours; **99.99% during a big sale** — an on-sale minute is the moment the business cannot afford to be down.
- **Scalability:** the system must survive a jump from ~5 requests/second to thousands of requests/second in seconds.
- **Security:** payments handled through a PCI-compliant provider; card data never touches our servers.
- **Durability:** once an order is confirmed, the ticket is never lost — even if a server crashes one second later.

---

## 2. Estimates

Assumptions (rounding 1 day to 100,000 seconds, per the Day 7 rule):

### Normal day

```
Visitors:        50,000 people
Page views:      50,000 × 10 = 500,000 pages/day
Page views/s:    500,000 ÷ 100,000 = 5 pages/s (average)
Peak (5×):       ~25 pages/s

Tickets sold:    5,000/day
Ticket writes/s: 5,000 ÷ 100,000 = 0.05 writes/s
```

**Normal traffic is very light.** A single well-configured server could handle a normal day comfortably.

### The big sale

```
People trying:   200,000 within 10 minutes (600 seconds)
Arrival rate:    200,000 ÷ 600 ≈ 333 people/s
Requests each:   ~10 (load page, view seats, retry, hold, pay)
Total requests:  200,000 × 10 = 2,000,000 in 600 s
Request rate:    2,000,000 ÷ 600 ≈ 3,333 req/s (average)
Peak (front-loaded): ~8,000–10,000 req/s

Seats to sell:   20,000 over 600 s = ~33 successful holds/s
```

### The comparison

| Metric | Normal day | Big sale | Ratio |
|---|---|---|---|
| Requests/second | ~5 | ~3,300 (peak 10,000) | **~2,000×** |
| Successful writes/s | 0.05 | ~33 | ~660× |
| Concurrent users | a few hundred | 200,000 | ~1,000× |

**What this tells us:** the system is tiny 99% of the time and then must survive a spike of **~2,000× normal traffic** for ten minutes. The design must scale down cheaply (so we are not paying for peak capacity all year) and scale up fast when a sale starts. This is exactly the case where stateless app servers, a cache, a queue and a seat-hold mechanism pay off.

---

## 3. API

| # | Method | Path | Description | Success status |
|---|---|---|---|---|
| 1 | GET | `/events` | List upcoming events. Supports `?search=` and pagination. | 200 OK |
| 2 | GET | `/events/:id` | Get one event's details (name, venue, date). | 200 OK |
| 3 | GET | `/events/:id/seats` | List seats for an event with their current status (`available`, `held`, `sold`). Served from cache. | 200 OK |
| 4 | POST | `/events/:id/seats/:seatId/hold` | Try to hold one seat for 10 minutes. Returns `{ holdId, expiresAt }`. | 201 Created |
| 5 | POST | `/orders` | Pay for the held seats. Body: `{ holdId, paymentToken }`. Returns the confirmed order. | 201 Created |
| 6 | GET | `/me/tickets` | List the logged-in user's confirmed tickets. | 200 OK |
| 7 | POST | `/auth/login` | Log in and receive a token. | 200 OK |

**Example — holding a seat**

```
POST /events/42/seats/A12/hold
Authorization: Bearer <token>
```

Response — `201 Created`:

```json
{
  "holdId": "h_8f3a92",
  "seatId": "A12",
  "expiresAt": "2026-10-18T20:10:00Z"
}
```

If the seat is already held or sold, the response is `409 Conflict`:

```json
{ "error": "That seat is no longer available." }
```

**Error codes used:**

| Status | When |
|---|---|
| 400 Bad Request | Invalid request body. |
| 401 Unauthorized | No token, or expired token. |
| 403 Forbidden | Trying to hold a seat on someone else's order. |
| 404 Not Found | Event or seat does not exist. |
| 409 Conflict | The seat is already held or sold — the key double-booking case. |
| 429 Too Many Requests | Rate limit exceeded. |
| 500 Internal Server Error | Server-side failure. |

---

## 4. Data model

### `users`

| Column | Type | Key |
|---|---|---|
| `id` | `SERIAL` | **PK** |
| `email` | `TEXT` | `NOT NULL UNIQUE` |
| `password_hash` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

### `events`

| Column | Type | Key |
|---|---|---|
| `id` | `SERIAL` | **PK** |
| `name` | `TEXT` | `NOT NULL` |
| `venue` | `TEXT` | `NOT NULL` |
| `starts_at` | `TIMESTAMP` | `NOT NULL` |
| `on_sale_at` | `TIMESTAMP` | `NOT NULL` — when the sale opens |

### `seats`

| Column | Type | Key |
|---|---|---|
| `id` | `SERIAL` | **PK** |
| `event_id` | `INTEGER` | **FK** → `events.id`, `NOT NULL` |
| `label` | `TEXT` | `NOT NULL` (e.g. `A12`) |
| `status` | `TEXT` | `NOT NULL DEFAULT 'available'`, `CHECK (status IN ('available','held','sold'))` |
| `held_until` | `TIMESTAMP` | nullable — set when status is `held` |

`UNIQUE (event_id, label)` — the same seat label cannot exist twice in one event.

### `orders`

| Column | Type | Key |
|---|---|---|
| `id` | `SERIAL` | **PK** |
| `user_id` | `INTEGER` | **FK** → `users.id`, `NOT NULL` |
| `total_cents` | `INTEGER` | `NOT NULL` |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending'` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

### `order_items` — where double-booking is stopped

| Column | Type | Key |
|---|---|---|
| `id` | `SERIAL` | **PK** |
| `order_id` | `INTEGER` | **FK** → `orders.id`, `NOT NULL` |
| `seat_id` | `INTEGER` | **FK** → `seats.id`, `NOT NULL` |
| `event_id` | `INTEGER` | **FK** → `events.id`, `NOT NULL` |

**`UNIQUE (event_id, seat_id)`** — this single constraint makes it **impossible** for a seat to appear in two confirmed orders for the same event.

### Relationships

- **users → orders** — one-to-many (one user, many orders).
- **orders → order_items** — one-to-many (one order, many seats).
- **seats → order_items** — one-to-many in the data model, but the `UNIQUE (event_id, seat_id)` constraint turns it into **at most one** confirmed order per seat. This is the join that enforces the business rule.
- **events → seats** — one-to-many.

---

## 5. Architecture

```
     ┌──────────────────────────┐
     │  Browser / mobile client │
     └────────────┬─────────────┘
                  │
             ┌────┴────┐
             │   DNS   │
             └────┬────┘
                  │
     ┌────────────┴────────────┐
     │  CDN  (static assets,   │
     │  event images)          │
     └────────────┬────────────┘
                  │  API calls (HTTPS + JSON)
                  v
          ┌──────────────────┐
          │   Rate limiter   │  ← stops scripts grabbing 100 seats
          └────────┬─────────┘
                   v
          ┌──────────────────┐
          │  Load balancer   │
          └────────┬─────────┘
        ┌──────────┼──────────┐
        v          v          v
   ┌─────────┐┌─────────┐┌─────────┐
   │ App 1   ││ App 2   ││ App 3   │ (stateless — any can serve any request)
   └────┬────┘└────┬────┘└────┬────┘
        │          │          │
        │          └────┬─────┘
        │               v
        │        ┌──────────────┐
        │        │  Redis cache │  ← seat maps for hot events
        │        │  + seat lock │     and short-lived hold locks
        │        └──────────────┘
        │
        │ writes (holds, orders)
        v
   ┌────────────────────────┐        ┌──────────────┐
   │  PRIMARY DATABASE      │  copy  │  Read        │
   │  (Postgres)            │───────>│  replicas    │  ← browse/seat views
   │  orders, seats, holds  │        └──────────────┘
   └────────────┬───────────┘
                │ jobs
                v
          ┌──────────┐         ┌────────────────┐
          │  Queue   │────────>│  Worker        │  → emails tickets,
          └──────────┘         └────────────────┘     generates PDFs
```

### What each component does, and why it's there

- **CDN** — serves static files and event images from edge servers, so the app servers are only doing dynamic work during the sale.
- **Rate limiter** — protects fairness: no single user or IP can send thousands of hold requests. Extra requests get `429`. This is what stops one person with a script from taking 100 seats.
- **Load balancer** — spreads requests across app servers and skips unhealthy ones, giving 99.99% availability during the sale.
- **App servers (stateless)** — run the API code. Because they hold no session data, any server can handle any request, and during the sale we can add more servers in seconds.
- **Redis cache** — holds the seat map for hot events. Reading the seat layout for 200,000 people is far too much for the database, so most requests are served in ~1 ms from memory.
- **Redis seat lock** — the fast, short-lived lock used to serialise holds on a single seat (see section 6).
- **Primary database (Postgres)** — the one true copy of orders, seats and holds. All writes go here.
- **Read replicas** — serve browse and seat-view reads. During the sale they absorb the ~3,300 req/s read load while the primary only handles the ~33 writes/s.
- **Queue + worker** — after payment, the worker sends the confirmation email and generates the PDF ticket in the background, so the user gets `201 Created` immediately.

### How the architecture survives the big sale

1. **Before the sale**, the seat map for the hot event is pre-loaded into Redis, so seat views never touch the database.
2. **When the sale opens**, the load balancer spreads 200,000 users across many stateless app servers. The rate limiter caps each user's request rate, so no single client can flood the system.
3. **Reads** (`GET /events/:id/seats`) are served from Redis. **Writes** (`POST .../hold`) go through the Redis lock, then to the primary.
4. **Only the ~33 successful holds per second** reach the primary — the database sees a fraction of the traffic.
5. **If a server dies**, health checks remove it, users retry, and because servers are stateless nothing is lost.
6. **After the sale**, we scale the app servers back down. Peak capacity costs us for ten minutes, not for the year.

---

## 6. How double-booking is prevented

A seat can never be sold twice because the design uses **two independent safety nets**.

### Safety net 1 — a short-lived hold with an atomic lock

When a user taps "Hold A12":

1. The app server sends an atomic command to Redis: `SET seat:42:A12 <holdId> NX EX 600`.
   - `NX` means "only set if it does not already exist".
   - `EX 600` means "expire in 600 seconds".
2. **If Redis returns OK**, the user now holds A12 for 10 minutes. Nobody else's `SET NX` on the same key will succeed — Redis is single-threaded, so the two requests cannot both win.
3. **If Redis returns nil**, the seat is already held → respond `409 Conflict`.
4. The app server also writes a `held` row into `seats` (`status = 'held'`, `held_until = now + 10 min`) inside the same transaction that creates the order.

If the user never pays, the Redis key expires and a background job flips the seat's `status` back to `available`.

### Safety net 2 — the database's UNIQUE constraint

Even if a bug in the app forgot a check, or two app servers raced, the database itself refuses to allow a seat to be sold twice:

```sql
-- In a transaction, when the user pays:
BEGIN;

-- 1. Lock the seat rows so no other transaction can change them
SELECT id FROM seats
WHERE event_id = 42 AND id IN (12, 13)
FOR UPDATE;

-- 2. Check they are still held by this user
--    (application code does this between the two statements)

-- 3. Insert the order items
INSERT INTO order_items (order_id, seat_id, event_id)
VALUES (101, 12, 42), (101, 13, 42);

-- 4. Mark the seats sold
UPDATE seats SET status = 'sold', held_until = NULL
WHERE event_id = 42 AND id IN (12, 13);

COMMIT;
```

The `UNIQUE (event_id, seat_id)` constraint on `order_items` means **step 3 will fail** if that seat has already been sold. The whole transaction is rolled back, the user gets a clear error, and the database is left in a consistent state.

### Why this is enough

- **Redis catches 99.9% of races** at the hold step — before any database work — so the database is not hammered by thousands of users trying to hold the same popular seat.
- **Postgres `FOR UPDATE` + `UNIQUE`** catch the last 0.1% — the truly simultaneous requests that hit Redis within the same millisecond.
- Either net alone is *almost* enough. Together they make double-booking impossible, which is exactly what the transaction (BEGIN … COMMIT) and constraint lessons on Day 6 were for.

---

## 7. Trade-offs

**1. Redis seat-lock speed vs. absolute correctness.**
Using Redis as the first-line lock makes holds fast enough to survive 10,000 requests/second, but Redis can be lost in a crash or a network partition — and if it restarts without persistence, the lock is gone. We accept this because **the database `UNIQUE` constraint is the backstop**: a Redis failure might cause a user to be wrongly told "hold failed", but it can never cause a double sale. The trade-off is deliberate — fast path optimises for speed, slow path guarantees correctness.

**2. Rate limiting fairness vs. legitimate bulk buyers.**
The rate limiter stops scripts, but it also stops a genuine group of friends trying to buy 10 seats together. We could relax the limit, but then a scalper with a botnet would take every popular seat in seconds. We chose fairness over convenience: a per-user limit of ~1 hold request per second, and a maximum of 6 seats per order. The trade-off is that a few legitimate buyers may need to coordinate across accounts — accepted, because the alternative is a broken market.

**3. Strong consistency on holds vs. availability during the sale.**
During the sale, a hold **must** be serialised — two users cannot both hold A12. This means that if the primary database is briefly unavailable, holds must be refused rather than accepted and reconciled later. We accept a short refusal (the user sees "try again") because the alternative — accepting both holds and picking a winner later — would break the fairness promise. This is the CAP theorem in action: during the sale, we choose **consistency over availability** for writes, while keeping reads highly available from replicas and cache.

**4. Paying for peak capacity vs. scaling down after the sale.**
Running enough app servers and Redis capacity for 10,000 req/s all year would be expensive, since 99% of the time we need 5 req/s. We chose a design that scales **horizontally on demand**: stateless app servers behind a load balancer mean we can spin up 20 servers for the sale and 2 afterwards. The trade-off is complexity — we have to automate the scaling and warm the cache before each sale. We accepted that complexity because the cost saving across a year is enormous, and the alternative (a fixed huge fleet) would be wasteful.

**5. 301-style caching of seat maps vs. freshness.**
We could let browsers cache the seat map for a minute to cut load, but then a user might tap a seat that was sold seconds ago. We chose to **serve seat maps with a very short TTL (5 seconds)** from Redis, so that the map is fresh enough to avoid most wasted taps, but not so fresh that every user generates a database read. Users occasionally see a seat that turns out to be taken; the alternative (no caching) would collapse under the traffic.
