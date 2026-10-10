# SnapShare — Scaling Plan

A scaling plan for **SnapShare**, a photo-sharing app where users upload photos and scroll a feed of photos from people they follow.

---

## 1. Assumptions

Given starting facts:

- 10,000,000 registered users.
- 10% of them are active each day.
- Each active user uploads **1 photo per day**.
- Each active user views **50 feed pages per day**.
- An average photo is **2 MB**.
- Each photo also gets a **50 KB thumbnail**.

My own estimates, added:

- 1 day ≈ **100,000 seconds** (86,400 rounded up for easy maths, per the Day 7 notes).
- Peak traffic is **5× the average** (busy evening hours).
- No deletions and no compression for this estimate — we are sizing the "worst case" growth.

**Daily active users (DAU):**

```
10,000,000 × 10% = 1,000,000 DAU
```

---

## 2. Estimates

### Uploads per second

```
1,000,000 users × 1 photo   = 1,000,000 uploads per day
1,000,000 ÷ 100,000         ≈ 10 uploads per second (average)
10 × 5                      ≈ 50 uploads per second (peak)
```

### Feed views per second

```
1,000,000 users × 50 views  = 50,000,000 feed views per day
50,000,000 ÷ 100,000        ≈ 500 feed views per second (average)
500 × 5                     ≈ 2,500 feed views per second (peak)
```

### Photo storage per year

```
Original photos:  1,000,000 photos/day × 2 MB      = 2,000,000 MB/day = 2 TB/day
                  2 TB × 365 days                  ≈ 730 TB per year

Thumbnails:       1,000,000 photos/day × 50 KB     = 50,000,000 KB/day = 50 GB/day
                  50 GB × 365 days                 ≈ 18.25 TB per year

Total:            730 TB + ~18 TB                  ≈ 750 TB per year
```

That is roughly **three-quarters of a petabyte every year** — before any backups or replicas.

---

## 3. Read-heavy or write-heavy?

**SnapShare is massively read-heavy.**

- ~10 uploads/s vs ~500 feed views/s → **50× more reads than writes**.
- Even at peak, that's 50 uploads/s vs 2,500 feed views/s — the same 50:1 ratio.

**What this means for the design:**

- **Caching is the biggest win.** Feed pages are expensive to build and viewed many times — Redis can serve 80–90% of them in ~1 ms each, keeping the database lightly loaded.
- **Read replicas are essential.** A single primary that handles writes plus several read replicas that handle feed queries is the natural fit.
- **Uploads are rare, so the write path can be simpler.** The primary database only sees ~50 writes/s at peak — very manageable for one well-indexed database.
- **The bottleneck is not the database, it is the photo bytes.** Serving 2 MB images to thousands of concurrent feed viewers would swamp the servers, which is exactly why a CDN is required.

---

## 4. Why photos do not go in the database

Photos should **never be stored as blobs inside the database**. Instead they go into **object storage** (Amazon S3, Cloudflare R2, Google Cloud Storage).

Reasons:

1. **Size.** 750 TB per year of photos inside a relational database would make backups, replication and sharding painfully slow and expensive. Databases are optimised for small rows, not multi-megabyte files.
2. **Cost.** Object storage costs a fraction of database storage per gigabyte, and is designed for exactly this workload.
3. **Delivery.** Object storage sits behind a CDN. The database would have to stream every byte itself, competing with queries.
4. **Backups.** Backing up a database that stores 750 TB/year of images is impractical; backing up a database that stores only the *URL* of each image is trivial.

**What the database *does* store:** one row per photo, with the metadata — the photo's id, the owner's user id, the caption, the timestamp, the URL of the full-size image, and the URL of the thumbnail. The bytes themselves live in object storage; the database just points to them.

---

## 5. Architecture diagram

```
                               ┌─────────┐
                    ┌─────────>│   DNS   │  (snapshare.com → IPs)
                    │          └─────────┘
                    │
       ┌────────────┴──────────────┐
       │  Browser / mobile client  │
       └────────────┬──────────────┘
                    │
       ┌────────────┴──────────────┐        static files
       │   Static files (JS, CSS)  │ ──────> ┌───────────────────┐
       └────────────┬──────────────┘         │   CDN + object    │
                    │                        │   storage         │
                    │  API calls (JSON)      │   (photos +       │
                    │                        │    thumbnails)    │
                    v                        └───────────────────┘
          ┌──────────────────┐
          │  Load balancer   │
          └────────┬─────────┘
        ┌──────────┼──────────┐
        v          v          v
   ┌────────┐ ┌────────┐ ┌────────┐        ┌───────────────┐
   │ App 1  │ │ App 2  │ │ App 3  │ ─────> │  Cache (Redis)│
   └───┬────┘ └───┬────┘ └───┬────┘        │  feed + photo │
       │          │          │             │  metadata     │
       │ writes   │ reads    │ jobs        └───────────────┘
       v          v          v
  ┌─────────┐ ┌────────────┐ ┌─────────┐   ┌──────────┐
  │ Primary │>│ Read       │ │ Queue   │──>│ Worker   │
  │   DB    │ │ replicas   │ │ (jobs)  │   │ (makes   │
  │(metadata│ │(feed reads)│ └─────────┘   │ thumbnails│
  │ only)   │ └────────────┘               └────┬─────┘
  └─────────┘                                    │ writes
                                                 v
                                          ┌───────────────┐
                                          │ Object storage│
                                          │ (photo files) │
                                          └───────────────┘
```

Read it as a request travelling top to bottom:

1. The client asks DNS for the IP of `snapshare.com`.
2. Static files (JavaScript, CSS, HTML) come from the CDN.
3. Photo bytes come from the CDN, which pulls them from object storage on the first miss.
4. API calls (JSON) go to the load balancer, which spreads them across the app servers.
5. App servers read from Redis; on a miss they read from a **read replica**.
6. On upload, the app server writes only to the **primary database** (metadata) and pushes the photo file to **object storage** — then adds a "make thumbnail" job to the queue.
7. A **worker** picks up the job, creates the thumbnail, writes it to object storage, and updates the photo row.

---

## 6. Components — one sentence each

- **DNS** — turns `snapshare.com` into an IP address so clients can find the system at all.
- **CDN** — serves photos, thumbnails and static files from edge servers near the user, cutting latency and keeping the origin servers free.
- **Load balancer** — spreads incoming API requests across several app servers and skips unhealthy ones, so one failing server does not take the system down.
- **App servers** — run the application code (feed building, uploads, auth), and because they are stateless, any server can handle any request.
- **Cache (Redis)** — holds frequently requested feed pages and photo metadata in memory so most reads never touch the database.
- **Primary database** — holds the one true copy of every photo's metadata and accepts all writes.
- **Read replica** — a copy of the primary that handles the read-heavy feed queries, taking load off the primary and providing failover.
- **Object storage** — stores the actual photo files and thumbnails at petabyte scale, cheaply and durably.
- **Queue** — holds background jobs (like thumbnail creation) so the app server can reply to the user immediately instead of waiting.
- **Worker** — pulls jobs off the queue and runs them in the background (creating thumbnails, updating metadata).

---

## 7. Upload flow, step by step

When a user taps "Post" on a new photo:

1. **Client requests an upload URL** — the app server authenticates the user and returns a pre-signed upload URL pointing at object storage.
2. **Client uploads the photo directly to object storage** — the 2 MB photo goes straight to the storage bucket, bypassing the app servers entirely. This keeps the API servers free.
3. **Client tells the API the upload is done** — a small POST with the object's storage key.
4. **App server writes the metadata row to the primary database** — a new row in `photos` with the owner's id, the caption, a timestamp, the object key for the full-size image, and a placeholder for the thumbnail. Returns `201 Created` to the user.
5. **App server adds a "make thumbnail" job to the queue** — a tiny JSON message like `{ "photoId": 12345, "key": "uploads/user7/photo.jpg" }`.
6. **Worker picks up the job** — it downloads the original from object storage, resizes it to a 50 KB thumbnail, uploads the thumbnail back to object storage.
7. **Worker updates the photo row** — writes the thumbnail's storage key into the database and invalidates any cached feed entry that contains this photo.
8. **The user's followers see the photo on their next feed load** — with the thumbnail served instantly from the CDN, and the full-size image loaded only if they tap on it.

The user gets `201 Created` at step 4 — long before the thumbnail exists. That is the whole point of the queue.

---

## 8. Trade-offs

**1. Speed vs freshness (caching and read replicas).**
Feeds are cached in Redis with a short TTL and served from read replicas that lag the primary by a few milliseconds. That makes feed loads fast, but a follower might see a post a second or two after it was made, or see an older cached version briefly. For a social photo app this is completely acceptable — no one minds seeing a new post one second late. A banking app would not accept this and would favour consistency over speed.

**2. Cost vs reliability (replication and multi-region).**
Every read replica, backup and extra region costs money — and object storage bills keep growing as the archive hits hundreds of terabytes. We could cut costs by keeping a single database in one region, but then a regional outage would take the whole app down. Investing in replicas and multi-region storage buys much higher availability (closer to "four nines") at real cost. We chose to spend on reliability because a photo app that goes offline loses users permanently.

**3. Simplicity vs scalability (monolith first).**
The plan above is still a single deployable monolith running behind a load balancer — three app servers running the *same* code. Splitting into microservices (a feed service, an upload service, a thumbnail service) would let large teams deploy independently and scale each part separately, but it would multiply the operational complexity. At 50 uploads/s and 2,500 feed views/s, a well-organised monolith scales comfortably. The right decision is to start simple and only split when a clear reason appears.

**4. Direct-to-storage uploads (extra step for the client, saved bandwidth for the server).**
By having the client upload straight to object storage instead of through the app server, we save an enormous amount of server bandwidth — but we add a step to the client flow and have to carefully secure the pre-signed URL (short expiry, one-time use). A naive design that sent bytes through the API servers would be much simpler to build but would collapse under peak upload traffic.
