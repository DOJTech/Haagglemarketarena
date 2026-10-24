# Haggle Market Arena: rules and scoring

_Generated from engine.js, the single source of truth, so this page cannot drift from the code. A test checks it._

## The game
You run a market stall for 7 days. You start with a **simulated** ₦20,000. No real money is involved. Each morning you buy stock; each afternoon 6 shoppers arrive. For each shopper you can **accept** their offer, **counter** it, or **let them go**. Every shopper has a hidden limit that only the server knows. If your counter is within the limit, the sale happens at your price (never below their offer). If it is above, they lose patience (3 chances); at zero they walk away.

## The seven-day campaign (fixed and documented)
| Day | Situation | What happens | Objective |
|---|---|---|---|
| 1 | Opening day | A normal market. Learn what each shopper is willing to pay. | Learn the market and aim for a healthy margin on every sale. |
| 2 | Supplier cost increase | Fuel costs push up wholesale prices for tomatoes and rice. | Your costs rose. Protect your margin without pricing yourself out. |
| 3 | A rival undercuts you | A nearby stall is cutting prices, so shoppers are less willing to pay. | Decide whether to hold your price or sell more for less. |
| 4 | Wedding season | Fabric is in demand and buyers will pay more for it. | Demand is strong. Do not give discounts you do not need to give. |
| 5 | Limited supply | Tomatoes are scarce, and the naira slips so imported goods cost more. | Buy carefully. Scarce stock is expensive stock. |
| 6 | Discount-hunting shoppers | Salaries are late. Shoppers open with low offers and ask for discounts. | Decide when a discount is worth it for customer goodwill. |
| 7 | Closing day | Last day. Unsold stock is valued at only 70% of what you paid. | Clear your stock. Leftover goods lose value. |

Prices and shoppers vary at random within each day, but the day's situation is fixed.

## Randomness and fairness
- Ranked markets use a seed derived from HMAC-SHA256(server secret, "haggle"+date), so everyone gets the same costs and shoppers on a given date, and nobody can predict them without the secret.
- Practice markets use a random seed per game.
- Each shopper's hidden limit also carries a small secret per-game variation (about ±6%), so replaying cannot reveal exact limits.
- The server clock decides the date. Changing the clock on your device changes nothing.
- The same inputs and the same secret always reproduce the same market (tested).

## Money rules
- Every amount is a whole naira (integer). There is no floating-point money.
- **Revenue** = money taken from sales. **Cost of goods sold (COGS)** = what you paid for the units sold (average cost, whole naira). **Gross profit** = revenue − COGS. **Gross margin** = gross profit ÷ revenue × 100 (shown only when revenue is above zero). Rent and wages are not modelled, so this is gross, not net, profit.
- Tomatoes that spoil overnight are **written off** (shown separately).
- Accounting identity, checked in tests: cash + stock at cost − starting balance = revenue − COGS − spoilage.
- On the last day, unsold stock is valued at 70% of cost.

## Customer satisfaction (0 to 100)
- Shopper buys: 50 + 125 × (their limit − price) ÷ limit, kept between 50 and 100.
- Shopper walks away: 20.
- Shopper finds you out of stock: 0.
- Your satisfaction score is the average over all shoppers who arrived.

## Score (out of 1000)
| Part | Max | How it is earned |
|---|---|---|
| Profit | 500 | Result after valuing leftover stock at 70%, scaled: a result of ₦12,000 earns full points; zero or less earns none |
| Gross margin | 150 | 5% earns nothing, 35% or more earns full points, linear in between |
| Customer satisfaction | 150 | Average satisfaction × 150 ÷ 100 |
| Stock management | 100 | 100 × (1 − 2 × share of purchases lost to spoilage and leftover write-down), floor 0; zero if you bought nothing |
| Consistency | 100 | 100 × (days with at least one sale and no gross loss) ÷ 7 |

Design intent (tested): revenue alone is not rewarded; the lowest price is not automatically best; doing nothing scores 0.
**Provisional:** the ₦12,000 target and the weights are starting values, not calibrated with real players. Change them in engine.js, then update the tests.

## Ranking
Leaderboards rank by score. Ties go to whoever finished first. Weekly = the sum of your ranked daily scores over the last 7 days. One ranked run per device per day; scores are calculated only on the server.

## Limits
This is a prototype simulation. Scores do not prove real-world skill, simulated prices are not real market prices, and nothing here is financial advice.
