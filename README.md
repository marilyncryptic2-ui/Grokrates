# YieldBoard v2

Curated DeFi + RWA yield board. One page: every yield on the shortlist,
with the strategy percentages beside each rate — loop, Pendle fixed,
delta-neutral, rate arb. Click any % for the step-by-step with today's
numbers, per-cycle LTV, and remaining buffer. Refreshes every 2 hours.

## What's fixed vs v1 (verified against live data, Aug 2026)

- **Native yield**: LSTs and sUSDe carry their token yield everywhere.
  Aave pays ~0% on wstETH; the ~2.2% lives in the token — loops now
  lever (native + venue) instead of the near-zero venue rate.
- **E-mode**: correlated loops on Aave/Spark use governance e-mode
  LTV/LT from config, not standard-mode values.
- **Corrected slugs**: sparklend, spark-savings, ondo-yield-assets,
  blackrock-buidl, stakewise-v2, invesco-ustb, circle-usyc, etc.
- **Delta-neutral**: 30-day mean funding (90 prints) and the k/(k+1)
  capital split — no more 2x overstatement.
- **Rate arb**: cheapest borrow vs best realized lend across venues,
  shown only above a 0.75 pt spread.
- **Exit terms + access**: parsed from Llama poolMeta where present,
  curated config otherwise; KYC/institutional badges on RWA rows.

## Run

```bash
npm install
npm test        # 16 unit + integration tests
npm run dev     # http://localhost:3000 — live data on first load
```

Zero env vars required. Everything degrades gracefully.

## Deploy (tomorrow's checklist)

1. Push this folder to GitHub, import in Vercel, deploy. Done — the
   site works immediately, computing on demand.
2. Env vars to add when ready (Project → Settings → Environment
   Variables), each independent:
   - `ADMIN_PASSWORD` — enables /admin (protocol registry)
   - `CRON_SECRET` — locks /api/refresh and /api/digest
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — persistent
     2h snapshots, the history archive (starts counting from day one of
     this), and persistent admin registry. **Add this early: history
     can't be backfilled.**
   - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — pipeline alerts + the
     daily thread-draft digest (deferred, add whenever)
3. 2h cadence: Vercel Hobby crons fire once daily. Either upgrade to
   Pro, or point cron-job.org (free) at
   `https://<your-app>.vercel.app/api/refresh` every 2 hours with
   header `Authorization: Bearer <CRON_SECRET>`.

## Architecture

```
adapters/  defillama (backbone + native-yield resolution + lendBorrow)
           pendle (PT fixed)   funding (30d mean)   registry (admin-added)
engine.ts  loops (e-mode, stages) · fixed · delta-neutral · rate-arb
           → asset groups → board → top10
store.ts   Upstash snapshot + compact history archive (in-memory fallback)
pipeline   refresh cycle, warnings, Telegram (no-op until configured)
app/       board strip · grouped rates table with venue expansion and
           inline strategy panels · /admin registry with preview gate
```

## Editorial controls (no code)

`lib/config/curation.ts` is the whole editorial layer: asset shortlist,
protocol allowlist, native-yield sources, correlated pairs, e-mode
table, exit terms, access gates, thresholds. One line per change.
`/admin` adds protocols at runtime (Llama slug or generic REST mapping);
new entries start inactive until previewed.

## Launch gate (agreed)

No public link until the board numbers have been checked against the
venue UIs across several consecutive days. First check after deploy:
wstETH loop and sUSDe rates vs Aave's own app.

## Known v1-scope deferrals

Swap-routing loop legs (v2 roadmap) · notifications (parked) ·
Morpho isolated-market native adapter (loops on Morpho currently rely
on Llama lendBorrow where present; direct Morpho API adapter is the
next engine upgrade) · "what changed" view (lights up once Redis
history has a few days of points).
