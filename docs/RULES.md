# Haggle Market Arena: rules and scoring

_Generated from engine.js, the single source of truth, so this page cannot drift from the code. A test checks it._

## The game
You run a market stall for 7 days. You start with a **simulated** ₦20,000. No real money is involved. Each morning you read the **weather forecast**, check wholesale prices and buy stock from 12 goods. Each afternoon 7 to 10 shoppers arrive, but you only have limited **selling time**. For each shopper you can **accept** their offer, **counter** it, or **let them go**. Every shopper has a hidden limit, a personality and a hint about them.

## Weather and the forecast
Each week is either in the wet or the dry season. Every day has real weather that nobody can change, and a forecast shown in the morning. **The forecast is right about 3 days in 4.** Wholesale prices in the morning follow the *forecast*; what shoppers want follows the *real* weather, which you only see once your stall is open. A wrong forecast can leave you with the wrong stock.

| Weather | Shoppers (base) | What sells | What does not |
|---|---|---|---|
| Sunny | 10 | Sachet water, soft drinks, hand fans | Umbrellas, rain boots |
| Heatwave | 9 | Sachet water, soft drinks, hand fans (much more); wholesale water, drinks and fans cost more | Umbrellas, rain boots |
| Cloudy | 9 | A normal mix | Nothing in particular |
| Light rain | 9 | Umbrellas, rain boots; wholesale umbrellas cost more | Water, soft drinks, fans |
| Heavy rain | 8 | Umbrellas and rain boots (a lot); wholesale umbrellas, boots and tomatoes cost more | Water, drinks, fans, fabric |
| Harmattan (dry and dusty) | 9 | Body cream (a lot); wholesale cream costs more | Fans, umbrellas, rain boots |

Weather changes how **often** shoppers ask for a product by the full amount, but changes **how much they will pay** by only about a third as much, so the weather is a reason to stock an item, not a licence to charge anything.

## Goods
Tomatoes and fresh bread **spoil overnight** and are written off. Everything else carries over to the next day. The goods are tomatoes, rice, Ankara fabric, phone chargers, Golden Crate noodles (the sample sponsor product), umbrellas, rain boots, sachet water, soft drinks, hand fans, body cream and fresh bread. Each morning the game shows the range shoppers *usually* pay for each good today. It is a guide only: individual shoppers vary a lot.

## Shoppers, hints and negotiation
There are five personalities. You are never told which one you face. You get a **hint** (what they say or do). Hints are right about 85 to 90 percent of the time; about 1 shopper in 7 **bluffs**, showing a hint that belongs to someone else. After each shopper the game tells you who they really were so you can learn to read them.

| Personality | What to expect |
|---|---|
| Bargain hunter | Opens very low, is patient (4 tries), moves slowly, and will pay about 10 percent less than the usual range |
| Shopper in a hurry | Opens fair, has little patience (2 tries), moves quickly, but their limit shrinks every time you waste their time |
| Regular customer | Opens fair, patience 3, pays slightly more than usual, and pays more if your shop has a good reputation (less if it has a poor one) |
| Big spender | Pays about a quarter more than usual, has little patience (2 tries), and **walks out at once** if you push more than 12% over their limit |
| Market expert | Knows the price: their limit is close to the usual range with little variation (patience 3) |

- If you ask for **less than their offer**, they pay what they offered. If you ask **within their limit**, the sale is at your price.
- If you ask **up to 4% over** their limit, they may stretch to meet you, at their limit.
- Further over: you lose patience (1 point, or 2 if you are more than 30% over). At zero patience they walk away. Each refused counter-offer also uses 1 unit of selling time.
- After a refusal they raise their offer part of the way toward their limit. How far is partly chance, so their reply cannot be used to work out their exact limit.
- Some shoppers want **2 units**. You are paid the agreed price for each unit you have in stock (up to 2).

## Selling time and reputation
- Each day you have 1 time unit for each expected shopper, plus 5 spare. A shopper arriving uses 1; each refused counter uses 1. **When time runs out, the shoppers still waiting go to another stall.**
- Your reputation (your average customer satisfaction) changes tomorrow's crowd: 80 or better brings one more shopper, below 55 costs one. Always between 7 and 10 a day.

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

Prices and shoppers vary at random within each day, but the day's situation is fixed. Weather is added on top of the day's situation.

## Randomness and fairness
- Ranked markets use a seed derived from HMAC-SHA256(server secret, "haggle"+date), so everyone gets the same costs and shoppers on a given date, and nobody can predict them without the secret.
- Practice markets use a random seed per game.
- Each shopper's hidden limit also carries a small secret per-game variation (about ±6%), so replaying cannot reveal exact limits.
- The server clock decides the date. Changing the clock on your device changes nothing.
- The same inputs and the same secret always reproduce the same market (tested).

## Money rules
- Every amount is a whole naira (integer). There is no floating-point money.
- **Revenue** = money taken from sales. **Cost of goods sold (COGS)** = what you paid for the units sold (average cost, whole naira). **Gross profit** = revenue − COGS. **Gross margin** = gross profit ÷ revenue × 100 (shown only when revenue is above zero). Rent and wages are not modelled, so this is gross, not net, profit.
- Fresh goods (tomatoes and bread) that spoil overnight are **written off** (shown separately).
- Accounting identity, checked in tests: cash + stock at cost − starting balance = revenue − COGS − spoilage.
- On the last day, unsold stock is valued at 70% of cost.

## Customer satisfaction (0 to 100)
- Shopper buys: 50 + 125 × (their limit − price) ÷ limit, kept between 50 and 100 (once per shopper, even if they bought 2 units).
- Shopper walks away: 20.
- Shopper finds you out of stock: 0.
- Your satisfaction score is the average over all shoppers who arrived.

## Score (out of 1000)
| Part | Max | How it is earned |
|---|---|---|
| Profit | 500 | Result after valuing leftover stock at 70%, scaled: a result of ₦45,000 earns full points; zero or less earns none |
| Gross margin | 150 | 10% earns nothing, 50% or more earns full points, linear in between |
| Customer satisfaction | 150 | Average satisfaction × 150 ÷ 100 |
| Stock management | 100 | 100 × (1 − 2 × share of purchases lost to spoilage and leftover write-down), floor 0; zero if you bought nothing |
| Consistency | 100 | 100 × (days with at least one sale and no gross loss) ÷ 7 |

Design intent (tested): revenue alone is not rewarded; the lowest price is not automatically best; doing nothing scores 0.
**Provisional:** the ₦45,000 target and the weights are starting values, not calibrated with real players. They were set by simulating bots (a beginner-style bot scores about 365, a decent heuristic about 545, a bot that knows every shopper's limit about 890). Real players will differ. Change them in engine.js, then update the tests.

## Ranking
Leaderboards rank by score. Ties go to whoever finished first. Weekly = the sum of your ranked daily scores over the last 7 days. One ranked run per device per day; scores are calculated only on the server.

## Limits
This is a prototype simulation. Scores do not prove real-world skill, simulated prices are not real market prices, and nothing here is financial advice.

## Music and currency (not part of scoring)
Music and the display currency change nothing about the game. Scores are always calculated in naira on the server. The currency picker only changes how amounts are shown, using rough fixed rates (not live prices).
