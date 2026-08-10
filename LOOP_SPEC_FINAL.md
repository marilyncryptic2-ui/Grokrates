# YieldBoard — Loop Engine: FINAL LOCKED SPEC

Every rule below is decided. This is the single reference the engine is
built and checked against. No ambiguity remains in the core logic.

---

## THE ONE-SENTENCE MODEL

Starting with your capital in one asset, the money flows step to step —
up to 5 steps — each step supplying on the best venue anywhere and
borrowing the cheapest correlated asset, the borrowed money flowing into
the next step, staying within one correlated asset group, only taking a
step whose spread clears 0.5%, keeping each position a safety haircut
below its LTV, netting out gas — and the whole route is shown only if it
beats simply supplying the starting asset.

---

## THE STEP-BY-STEP FORMULA

For a route starting with capital C in a starting asset:

### Each step i (i = 1..5):
1. You hold some amount of some asset.
2. SUPPLY it on the venue with the highest supply APY for that asset,
   across ALL platforms and ALL blockchains.  → earns S_i
3. BORROW the cheapest correlated asset available at that same venue
   → costs B_i.  Same-asset borrowing IS allowed: a pure recursive loop
   (supply X → borrow X → re-supply X) is valid whenever the spread
   still clears 0.5%.
4. STEP GATE: take the step only if  S_i − B_i ≥ 0.5%.
   If no borrow clears this, the route ends here.
5. SAFE BORROW AMOUNT: you may borrow up to (safeLTV × collateral),
   where safeLTV depends on the supplied asset's group:
     - Stables:            safeLTV = poolLTV − 0.05   (5% haircut)
     - ETH / BTC / SOL / volatile: safeLTV = poolLTV − 0.10  (10% haircut)
   poolLTV is the live max LTV from the venue (fetched from Llama).
   No liquidation-threshold lookup needed — the haircut IS the safety
   margin, sized bigger for volatile assets.
6. SWAP if the next step's best supply wants a different asset in the
   same group. Swap cost is subtracted.
7. The borrowed amount (post-swap) becomes step i+1's supply amount.

### Stop when ANY of:
   - 5 steps reached
   - the next step's spread < 0.5%
   - the amount to carry forward is negligible (< $50 after compounding)

### Net APY of the route:
   grossYield   = Σ (amount supplied at step i × S_i)
   borrowCost   = Σ (amount borrowed at step i × B_i)
   swapCost     = Σ (swap cost where a step changes asset)
   gasCost      = Σ (predefined gas per blockchain, per step)
   NET (annual $) = grossYield − borrowCost − swapCost − gasCost
   NET APY %      = NET / C × 100

### Show gate (honesty):
   bestPassive = highest plain supply APY for the starting asset anywhere
   IF route NET APY > bestPassive → show the route
   ELSE → show "Best: supply on <venue> at <bestPassive>%" instead
   (never show a loop that loses to just supplying)

---

## CONFIG — the editable inputs (real numbers to fill)

### Correlated asset groups (only chain within a group)
   STABLES: USDC, USDT, DAI, USDS, sUSDS, sDAI, USDe, sUSDe, GHO, sGHO,
            PYUSD, RLUSD, USD1
   ETH:     ETH, WETH, stETH, wstETH, weETH, rETH, cbETH, osETH, ETHx,
            ezETH, rsETH
   BTC:     WBTC, cbBTC, tBTC, LBTC
   SOL:     SOL, wSOL, jitoSOL, mSOL, jupSOL, bnSOL, dSOL, bbSOL
   (RWA assets do not loop — no borrow markets — so no group.)

### Volatility class (sets the LTV haircut)
   STABLES → 5% haircut
   ETH, BTC, SOL → 10% haircut

### Gas estimate per blockchain (predefined, editable, $ per step)
   Ethereum  ≈ $<fill>    (highest)
   Arbitrum  ≈ $<fill>
   Base      ≈ $<fill>
   Optimism  ≈ $<fill>
   Polygon   ≈ $<fill>
   BSC       ≈ $<fill>
   Solana    ≈ $<fill>    (lowest)
   (Values set once from typical costs; a step subtracts its chain's #.)

### Swap cost
   A flat small % per asset-change step (e.g. 0.05% for deep pegged
   pairs), editable.

### Bridge cost
   If a step crosses blockchains, add a bridge cost (flat editable %).
   Same-chain steps: no bridge cost.

---

## WHAT WE DELIBERATELY DO NOT DO  (decided)

- No asset-concentration cap — users manage their own exposure.
- No borrow-rate-rise modeling — rates refresh each interval; the engine
  recomputes on current rates every cycle.
- No liquidation-threshold config table — the LTV haircut replaces it.
- No cross-group chaining ever (no USDC↔ETH) — that's a directional bet.

---

## BUILD PLAN

1. Config: correlated groups, volatility classes, gas/swap/bridge costs,
   LTV haircuts.  [pure data]
2. Route search: per group, money-flows-forward step search, best rate
   per step, all gates (0.5% spread, safe LTV, 5-step cap, stop rules).
3. Net calc: gross − borrow − swap − gas − bridge; net APY vs bestPassive.
4. Output: best route per group (+ the "just supply" fallback).
5. Tests on fixtures: prove the math on known inputs before live data.
6. Display (later): the multi-step route path — visual only, not formula.

The formula is complete. Building it is the remaining work; verifying it
against live rates is the iteration that follows.

---

## LOCKED-STATE ADDENDUM (final decisions)

- SAME-ASSET BORROWING ALLOWED. Pure recursive leverage (supply X →
  borrow X → re-supply) is valid whenever spread ≥ 0.5%. Verified result:
  USDC $1000 → step 1 borrows cheapest (USDT 2.8%), steps 2-5 pure
  USDT↔USDT at 2.5% spread → NET APY 10.76% vs 6.10% passive → show route.
- DATA SOURCE: DefiLlama, 2-hour pull, confirmed correct. Its apy includes
  apyBase + apyReward (matches Aave's own UI) and excludes non-tradable
  points/pre-TGE incentives (intentional). Do NOT switch the main pipeline
  to per-protocol subgraphs; optional light borrow/LTV enrichment for the
  top 5-8 protocols only, and never let a missing subgraph break the snapshot.
- DELTA-NEUTRAL and RATE-ARB full engines are DROPPED for now. The product
  focuses on best passive rates (table) + best looping APY (route engine +
  multi-step panel). A lightweight delta-neutral card may return later.
- SWAP/BRIDGE costs still deferred; will be fixed manual constants
  (~0.05% swap, ~0.10% bridge) subtracted only on asset-change / chain-change
  steps, purely to signal expected cost.
- The old Excel ENGINE TRACE sheet is OBSOLETE (it used a fixed 0.85 LTV,
  cross-venue borrows, all-Ethereum gas). Ignore it. The locked code logic
  in route.ts + groups.ts is the only source of truth.
- Accepted limitations (documented, unchanged): no live liquidity/borrow-cap
  checks, static gas underestimates real entry cost, static haircut is not a
  full health-factor sim, 2-hour data lag possible, no post-entry monitoring,
  new assets missing from CORRELATION_GROUP silently return null (safe).
