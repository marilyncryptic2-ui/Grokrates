# YieldBoard — Looping Strategy: Full Design Spec

Design first, build second. This is the logic we agree on before any
code. Every number the loop engine produces must trace to a rule here.

---

## SCALE — 40 VENUES × 15 ASSETS, HANDLED BY CLUSTERING + PRUNING

The platform carries ~15 assets across ~40 venues. A naive route search
over that is millions of paths per refresh — too slow and mostly junk.
Three design rules keep it fast AND make the output better:

1. Search PER CLUSTER, never globally. 15 assets are never searched
   together. Each correlation cluster (stables ~6-7, ETH ~6-8, BTC ~4,
   SOL ~5) is its own small graph, searched independently. This is what
   makes the search tractable — and it's the same rule that keeps routes
   safe (3.2).

2. PRUNE hard before searching. Within a cluster, for each asset keep
   only the top few venues by supply rate and the top few by cheapest
   borrow. Drop: sub-TVL-floor venues, dominated rates (a 2% supply when
   the same asset pays 8% elsewhere never appears in an optimal route),
   and borrow markets with no available liquidity. After pruning, each
   cluster is a handful of assets × a handful of best venues — a small
   graph the 5-hop search runs over in milliseconds.

3. OUTPUT is best-route-per-cluster, not per-asset. "Best stablecoin
   route," "best ETH route," etc. A few strong, checked answers beats 15
   noisy ones — and it's a cleaner product.

Pruning is not just for speed: a dominated venue is never part of a
good answer, so cutting it loses nothing and clarifies everything.

---

## THE CORE IDEA

A loop is a ROUTE: a path of up to 5 hops through the lending market,
where EACH hop independently chooses the best asset, the best supply
venue, and a swap if needed — based purely on the rates available at
that hop.

A hop = supply the asset you're holding on its best venue → borrow a
correlated asset there → (swap it to whatever the next hop's venue
wants) → next hop. Across 5 hops a route can touch several assets
(USDS, USDT, USDC...), several venues (Spark, Aave, Fluid, Morpho...),
and several swaps. It is NOT "5 rounds of the same supply-borrow at one
venue" — that's just the simplest possible route (a 2-hop same-asset
same-venue cycle).

Leverage multiplies both the yield you earn and the borrow you pay. A
route is worth it only when the yields it chains beat the borrows +
swap costs it chains, and only while EVERY position it opens stays a
safe distance from liquidation.

The engine's job: given today's rates across every venue, search for
the best SAFE route (up to 5 hops) for each correlation cluster, show
the honest net number with the full path, and prove it on screen.

The single-venue loop (Layer 1) and the multi-venue route (Layer 3)
are the SAME model at different depths — Layer 1 is the 1-venue special
case, Layer 3 is the general path search. We build the simple case
first to get the math and display honest, then generalize to the full
route search.

---

## GLOBAL CAP — MAX 5 LOOPS  [DECIDED]

A hard ceiling of 5 applies in BOTH places loops can grow, because past
5 the marginal yield approaches zero while gas keeps costing:

- Stage-table cycles within one position: build at most 5 rounds toward
  target leverage (was 6). By round 5 you've captured ~95%+ of reachable
  leverage; further rounds add gas, not return.
- Route hops in the optimizer (Layer 3): a route chains at most 5
  venue-to-venue legs. Deeper routes are theoretically higher-yield but
  lose to gas and stop being executable by a human.

This resolves D1: max hops = 5.

---

## LAYER 1 — THE HONEST SINGLE-VENUE LOOP

Goal: what's shown is correct and honest, even before optimization.
Fixes the sUSDS-type nonsense.

### 1.1 Loop the best LOOPABLE venue, not just any venue
For an asset, a venue is "loopable" only if you can both supply it AND
borrow a correlated asset against it there. Staking pools (Lido) and
savings rates (Sky sUSDS) are NOT loopable — no borrow market.
Rule: among an asset's loopable venues, pick the one that produces the
highest safe net loop APY. Loop THAT, not whichever row we're on.

### 1.2 Compare against the best PASSIVE rate, honestly
The baseline a loop must beat is the best rate you can get by just
supplying the asset ANYWHERE with no leverage and no loop.
  bestPassive = max supply rate for this asset across all venues
Rule: netLoopAPY must exceed bestPassive by a real margin (say +0.5pt
after the buffer) or the loop is not worth the risk.

### 1.3 Hide loops dominated by supplying
If bestPassive >= netLoopAPY, do NOT show the loop. A leveraged 8% is
never the answer when a passive 7.13% exists for the same asset. The
"+X more than holding" line compares to bestPassive, so it can never
show a fake win.

### 1.4 The income breakdown must be on screen
Every loop panel shows the actual arithmetic, per $ of the chosen
capital:
  gross yield   = collateral × totalYield
  borrow cost   = debt × borrowRate
  NET           = gross − borrow   (→ this is the netAPY)
So the headline number is verifiable from the panel, not asserted.

---

## LAYER 2 — ACCURACY INPUTS (make leverage SAFE)

Goal: the leverage we call "safe" is actually safe.

### 2.1 Real liquidation threshold + LTV from an editable config
A per-protocol, per-asset-pair table of REAL published LTV and
liquidation-threshold values from each protocol's docs. This is the
"edit here when a parameter changes" table. Falls back to Llama's
standard-mode LTV + a clearly-labeled estimate only when a pair isn't
in the table. Every loop tags its source: verified / estimated.
(Governance-vote auto-updates are out of scope — current values only,
edited manually when they change.)

### 2.2 The 5% liquidation buffer floor  [ALREADY BUILT]
Position's utilized LTV must stay >= 5 points below the liquidation
threshold, taking whichever is more conservative between that and the
health-factor target. Loops that can't keep 5% don't show.

### 2.3 Borrow-liquidity cap
Use Llama's availableBorrowUsd (already fetched, currently ignored). If
the borrow market can't supply what the loop needs, cap the loop size
and flag it. Never show a loop that can't actually be opened.

---

## LAYER 3 — THE RATE-SHOPPING OPTIMIZER (the real vision)

Goal: each leg routes the held asset to its BEST venue across the whole
market. This is the "find the number everyone missed" engine.

### 3.1 The rate graph
- NODES = assets (USDS, USDT, USDC, DAI; ETH, wstETH, weETH; ...)
- SUPPLY EDGE = "supply asset A on venue V at rate r" (a yield you earn)
- BORROW EDGE = "borrow asset B on venue V at rate c" against A collateral
- SWAP EDGE = "convert A → B" (via LST mint/redeem, or a DEX swap),
  only between CORRELATED assets, with a small conversion cost
A loop is a CYCLE in this graph that returns to your starting asset.

### 3.2 Correlation safety is the spine
Assets may only be chained if they're safe to hold against each other:
  - Stable cluster: USDS ~ USDT ~ USDC ~ DAI ~ sUSDS ~ sUSDe ...
  - ETH cluster:    ETH ~ wstETH ~ weETH ~ rETH ~ cbETH ...
  - BTC cluster:    wBTC ~ cbBTC ~ tBTC ...
  - SOL cluster:    SOL ~ jitoSOL ~ mSOL ...
NEVER chain across clusters (USDC↔ETH) — that's a directional bet that
liquidates on any price move. The cluster map is curated config.

### 3.3 The route search
For a starting asset + capital, search cycles through the graph that:
  a) stay within one correlation cluster
  b) maximize net yield = Σ(supply legs) − Σ(borrow legs) − Σ(swap costs)
  c) keep EVERY venue position's buffer >= 5% (Layer 2)
  d) respect each borrow market's available liquidity (2.3)
Return the best route, plus the simple single-venue loop for comparison.
Bounded depth (say <= 4 hops) so routes stay executable, not academic.

### 3.4 Per-venue position tracking
A multi-venue loop = multiple positions, each its own health factor.
Example: supply USDS/borrow USDT on Spark = position 1; supply
USDT/borrow USDS on Aave = position 2. The engine tracks each
separately, shows each buffer, and the route is only "safe" if ALL
positions hold their 5% cushion. A depeg moves all linked positions at
once — the panel says so.

### 3.5 Presentation
The panel shows the route as an ordered path with each hop's venue and
rate, each position's buffer, the swap costs, and the net — so a
multi-venue route is as readable and checkable as a single-venue loop.

---

## LAYER 4 — COST REALISM (make the net number REAL)

Goal: the APY is what you'd actually keep, not a frictionless ideal.

### 4.1 Gas per transaction, chain-aware
Each hop = supply + borrow + swap ≈ 3 txns. A 4-hop route ≈ 12 txns.
Cost is real on mainnet, tiny on L2/Solana. Subtract estimated gas
from the net for the chosen capital, so small capital shows the truth
(a loop that nets +$80/yr but costs $120 in gas is a LOSS at $1k).

### 4.2 Swap slippage between legs
Each conversion has a cost beyond gas (DEX spread). Small for deep
pegged pairs, real for thin ones. Subtract it.

### 4.3 Borrow-rate rise from utilization
Borrowing more raises the market's utilization and rate. Model the
rate at the loop's actual size, not the current spot rate. Bigger
loops on thin markets pay more than the quoted rate.

### 4.4 Minimum viable capital
Show the capital floor below which the route loses to fees, so nobody
runs a route that gas eats alive.

### 4.5 Reward-vs-organic yield
Separate incentive-token APY from organic yield in the loop. Rewards
are volatile and end; a loop leaning on rewards is riskier than one on
organic yield. Flag reward-heavy loops.

---

## BUILD ORDER (once this spec is agreed)

1. Layer 1 — honest single-venue loop (correct + verifiable on screen)
2. Layer 2 — real LTV/LT config + buffer + liquidity cap (safe)
3. Layer 3 — rate-shopping optimizer + per-venue tracking (optimal)
4. Layer 4 — gas, slippage, rate-rise, min capital (real net)

Each layer ships and is verified against the master check sheet before
the next. Layer 1 alone fixes the nonsense you're seeing now; Layer 3
is the ambitious engine; Layer 4 makes every number trustworthy net of
friction.

---

## OPEN DECISIONS TO SETTLE IN THIS SPEC

D1. [DECIDED] Max 5 loops — both stage-cycles and route-hops capped at 5.
D2. Min margin a loop must beat passive by (proposed: +0.5pt after
    buffer). Higher = fewer but stronger loops shown.
D3. Which correlation clusters at launch (proposed: stables + ETH,
    add BTC/SOL after). Narrower = safer to start.
D4. Same-chain only at launch, or allow cross-chain routes? (Proposed:
    same-chain only — cross-chain adds bridge risk/cost the route math
    would have to model.)
D5. Gas model: flat per-chain estimate, or live gas oracle? (Proposed:
    flat per-chain estimate, editable in config — good enough, no new
    live dependency.)
