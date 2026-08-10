# Loop Engine — Comprehensive Case Diagnosis

Full review of every case the engine can hit, the bug in each, and the
correct behavior. Written before code changes so we agree the fixes.

---

## THE CORE INSIGHT (what unifies every bug)

At every step the engine faces ONE decision: **do the highest-value
thing with the money I'm holding right now.** That is either:
  (a) LOOP: supply on the best loopable venue, borrow the cheapest
      correlated asset, carry forward — OR
  (b) PARK: supply at the single best rate anywhere (loopable or not)
      and STOP.

You take whichever produces more total yield. Every bug below is a
place where the current engine fails to make this comparison correctly.

---

## CASE 1 — A higher-rate loopable venue exists but isn't used
Example: Aave supplies USDC at 4.2% (loopable), Morpho at 3.56%
(loopable). Old engine loops Morpho because that was the clicked row.
CURRENT NEW ENGINE: bestLoopableSupply already picks the highest —
so the NEW engine supplies Aave. ✓ correct.
BUG LOCATION: only the OLD buildLoop (still shown on deployed site).
FIX: kill the old buildLoop display entirely. The new engine is right.

## CASE 2 — Highest rate is un-loopable (savings/staking)
Example: Sky sUSDS 7.12% (can't borrow against), Morpho 3.56%
(loopable). You cannot loop Sky, but you can END on it.
CURRENT: park step supplies the FINAL hop on Sky. ✓ partially right.
REMAINING BUG: see Case 3 — it loops 5 times FIRST, then parks, even
when parking earlier is better.

## CASE 3 — Thin loop spread + high park rate → should stop looping early
Example: Morpho spread is 3.56% − 1.6% = 1.96%. Sky park is 7.12%.
Each Morpho loop hop earns only its thin spread on borrowed money, and
shrinks what reaches Sky. Parking earlier earns 7.12% on more money.
CURRENT BUG: engine ALWAYS loops until spread<0.5% or 5 steps, THEN
parks. It never asks "is one more loop worth more than parking now?"
FIX: at each step, compare (park everything now) vs (loop once more,
then park the rest). Stop looping the moment parking-now wins. This is
the biggest logic fix.

## CASE 4 — 0% / missing borrow rate treated as free borrowing
Example: pool has borrowApy 0 or null (no real borrow market / missing
feed data). Engine sees supply 7.32% − borrow 0% = 7.32% spread and
builds a fake 5-step loop → absurd 27% APY.
CURRENT: FIXED — MIN_VALID_BORROW rejects borrow < 0.01%. ✓
KEEP as is.

## CASE 5 — Loop barely beats passive → not worth the risk
Example: best loop nets 8.31%, best passive is 7.12%. 1.2pt edge isn't
worth leverage + liquidation + gas.
CURRENT: FIXED — LOOP_MARGIN 1.5pt; shows "just supply" unless the
loop beats passive by ≥1.5pt. ✓ KEEP.
NOTE: with Case 3 fixed, the loop's net will be HIGHER (parks earlier),
so some loops that were hidden may legitimately show — that's correct.

## CASE 6 — Cross-group contamination
Example: a wstETH pool (ETH group) sitting in a USD route's data.
CURRENT: groupOf() filter everywhere; never chains across groups. ✓

## CASE 7 — Unknown asset (not in any correlation group)
Example: a new token not in CORRELATION_GROUP.
CURRENT: buildRoute returns null. ✓ safe.

## CASE 8 — Same-asset pure leverage
Example: supply USDC, borrow USDC, re-supply (one venue, recursive).
CURRENT: allowed when spread ≥ 0.5%. ✓ correct and intended.

## CASE 9 — The park step double-counts or mis-sizes
The park supplies `carry` (the last borrowed amount). But is that
amount right? After the last loop step, carry = last borrowedUsd, which
is money you hold and haven't supplied. Parking it is correct. ✓
BUT: the park's gas and the "spread 0" row must not distort net. Net =
Σ supplied×supplyApy − Σ borrowed×borrowApy. Park adds supplied×apy
with borrowed 0 — correct. ✓

## CASE 10 — Greedy borrow choice misses better next step
Example: cheapest borrow is USDT (2.8%) but borrowing USDC (2.9%) leads
to a much higher next supply. Greedy takes USDT.
CURRENT: greedy cheapest-borrow. Known limitation, ACCEPTED (you chose
greedy over lookahead). Within a correlated group rates are close, so
impact is small. LEAVE for now.

## CASE 11 — Which starting asset per group?
buildRoutes tries the top-3-by-pool-count start assets and keeps the
best. But the START asset matters less now: with the park step and
early-stop, any start in the group converges toward "loop the best
loopable spread, park on the best rate." Still, trying a few starts and
keeping the best net is correct. ✓ KEEP.

## CASE 12 — Display doesn't show the multi-venue PATH clearly
Your main complaint. Even when the route IS multi-venue, the display is
vague ("Looped 4.63x"). Each step should show, side by side: which
venue, which chain, supply rate, borrow rate, and HOW MUCH THAT STEP
ADDS (its contribution to net APY, in points and/or dollars).
FIX: rebuild the route card as a clear step-by-step path with a
per-step contribution column. Kill the old cycle-table entirely.

---

## THE UNIFIED FIX (what changes)

1. LOGIC — replace "always loop to 5 / spread<0.5%" with the
   park-aware optimal stop:
     At each step, compute:
       parkNow   = supply all current carry at best rate anywhere
       loopMore  = take one loop step, then (recursively) best of
                   parkNow / loopMore on the smaller carry
     Take loopMore only if it beats parkNow. Else stop and park.
   This naturally produces the RIGHT number of loops (often 1–2 when a
   high park rate exists, up to 5 when spreads are fat and no park
   rate dominates).

2. VENUE SELECTION — already correct in the new engine (best loopable
   supply each step). Just ensure the FIRST step also considers that
   parking immediately (no loop at all) might win.

3. PER-STEP CONTRIBUTION — compute each step's $ and pt contribution to
   net, so the display can show "this hop adds +X%".

4. DISPLAY — rebuild as a legible path: one row per hop, columns for
   venue · chain · supply% · borrow% · this-step-adds. Mark the park
   step. Remove the old single-venue buildLoop display entirely.

5. KEEP AS-IS (already correct): 0% borrow rejection (Case 4), margin
   gate (Case 5), group isolation (Case 6), unknown-asset null (Case 7),
   same-asset leverage (Case 8), greedy borrow (Case 10, accepted).

---

## THE STOP RULE, PRECISELY

Define value(carry, holding, stepsLeft):
  parkValue = carry × bestRateAnywhere(holding)      // supply & stop
  if stepsLeft == 0: return parkValue
  bestLoop = bestLoopableSupply(holding)
  if no bestLoop or spread < 0.5%: return parkValue
  borrowed = carry × safeLtv
  loopValue = carry × supplyApy            // this step's supply earns
            − borrowed × borrowApy         // this step's borrow costs
            + value(borrowed, borrowAsset, stepsLeft−1)  // recurse
  return max(parkValue, loopValue)

The engine walks this: at each step it only loops if loopValue >
parkValue; otherwise it parks. This is a bounded recursion (≤5 deep,
one branch), so it stays fast and deterministic. It provably never
loops when parking is better, and never parks when looping is better.

This single rule resolves Cases 1, 2, 3, and 5 together.
