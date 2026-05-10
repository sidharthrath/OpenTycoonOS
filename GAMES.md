# Game Compositions

Concrete mapping of target games to TycoonOS module compositions. Use this as a design
check: every game should fully decompose into a finite combination of TycoonOS modules.
If a game introduces a capability that isn't listed below, it becomes a TycoonOS module candidate.

## Unlock roadmap

| Game | Unlocked at version | Composition |
|---|---|---|
| **Streaming** (Netflix-style) | v0.1 | `core` + `subscription` + `segmented` + `competition` + `press` + `perks` + `recognition` + `inflation` |
| **AI SaaS** (managed agents) | v0.1 | `core` + `subscription` + `segmented` + `fleet` (compute) * + `competition` + `press` + `perks` |
| **Social network** | v0.1 | `core` + `subscription` (freemium) + `segmented` + `competition` + `press` + `events` |
| **News publisher** | v0.1 | `core` + `subscription` (paywall) + `segmented` + `press` + `roster` (journalists) |
| **Cloud provider** | v0.1-0.2 | `core` + `subscription` + `fleet` (servers) + `geographic` + `competition` |
| **EV company** | v0.2 | `core` + `unit-sale` + `inventory` + `geographic` + `competition` + `reputation` + `events` + `seasonality` + `commodities` (batteries) |
| **Consumer electronics** | v0.2 | `core` + `unit-sale` + `inventory` + `geographic` + `competition` + `reputation` + `events` (launches) + `seasonality` |
| **Fashion brand** | v0.2 | `core` + `unit-sale` + `inventory` + `geographic` + `reputation` + `roster` (designers) + `seasonality` |
| **Craft brewery** | v0.2 | `core` + `unit-sale` + `inventory` + `geographic` + `reputation` + `seasonality` |
| **AV company** (Waymo-style) | v0.3 | `core` + `transaction` + `fleet` + `geographic` + `competition` + `reputation` + `events` (incidents) + `political` (regulatory) |
| **Rental cars** | v0.3 | `core` + `transaction` + `fleet` + `perishable` + `geographic` + `loyalty` |
| **Hotel chain** | v0.3 | `core` + `transaction` + `infrastructure` (properties) + `perishable` + `loyalty` + `ranking` (stars) + `geographic` + `seasonality` |
| **Cruise line** | v0.3 | `core` + `transaction` + `fleet` (ships) + `perishable` + `loyalty` + `seasonality` |
| **Airline** | v0.4 | `core` + `transaction` + `fleet` + `network` (routes) + `perishable` + `loyalty` + `competition` + `commodities` (fuel) + `seasonality` |
| **Metro system** | v0.4 | `core` + `transaction` + `infrastructure` + `network` + `political` + `events` |
| **Telecom** | v0.4 | `core` + `subscription` + `infrastructure` + `network` (coverage) + `political` + `competition` |
| **LEO broadband** (Starlink-style) | v0.4 | `core` + `subscription` + `infrastructure` + `geographic` + `network` (capacity) + `competition` + `reputation` + `events` + `political` |
| **Utility company** | v0.4 | `core` + `subscription` + `infrastructure` + `political` + `commodities` |
| **Shipping / container** | v0.4 | `core` + `transaction` + `fleet` + `network` (routes) + `commodities` (fuel) |
| **Food delivery platform** | v0.5 | `core` + `transaction` + `marketplace` + `geographic` + `competition` + `reputation` |
| **Dating app** | v0.5 | `core` + `subscription` + `marketplace` + `segmented` + `competition` |
| **Amazon-style marketplace** | v0.5 | `core` + `transaction` + `marketplace` + `inventory` + `geographic` + `reputation` |
| **Pharma company** | v0.5 | `core` + `unit-sale` + `pipeline` (FDA) + `competition` + `reputation` + `events` + `political` + `inflation` |
| **Biotech startup** | v0.5 | `core` + `pipeline` + `competition` + `events` (binary outcomes) |
| **Film studio** | v0.5 | `core` + `unit-sale` + `roster` (talent) + `competition` + `press` + `recognition` + `events` (releases) |
| **Sports team / league** | v0.5 | `core` + `transaction` + `roster` (players) + `ranking` + `reputation` + `press` + `events` + `seasonality` |
| **Record label** | v0.5 | `core` + `subscription`/`unit-sale` + `roster` (artists) + `competition` + `recognition` |
| **Video game publisher** | v0.5 | `core` + `unit-sale` + `roster` (studios) + `events` (launches) + `competition` |
| **Law firm** | v0.5 | `core` + `transaction` (billable hours) + `roster` + `ranking` + `reputation` |
| **Consulting firm** (McKinsey) | v0.5 | `core` + `transaction` + `roster` + `ranking` + `reputation` + `competition` |
| **University** | v0.5 | `core` + `subscription` (tuition) + `pipeline` (degrees) + `ranking` + `reputation` + `political` |
| **Bank** (retail) | v0.5 | `core` + `subscription` (deposits) + `balance-sheet` + `competition` + `political` + `press` |
| **Insurance company** | v0.5 | `core` + `subscription` (premiums) + `balance-sheet` + `geographic` + `commodities` (claims shocks) |
| **Hedge fund** | v0.5 | `core` + `transaction` (fee model) + `balance-sheet` + `roster` (PMs) + `ranking` |
| **Oil & gas** | v0.5 | `core` + `unit-sale` + `infrastructure` + `commodities` + `geographic` + `political` |
| **Mining** | v0.5 | `core` + `unit-sale` + `infrastructure` + `commodities` + `political` |
| **Theme park** | v0.5 | `core` + `transaction` + `infrastructure` + `perishable` (tickets) + `seasonality` + `roster` (attractions) |
| **Fitness chain** | v0.5 | `core` + `subscription` + `infrastructure` (locations) + `geographic` + `loyalty` + `seasonality` (resolutions) |
| **Coffee chain** | v0.5 | `core` + `unit-sale` + `inventory` + `geographic` (density!) + `loyalty` + `seasonality` |
| **Restaurant chain** | v0.5 | `core` + `unit-sale` + `inventory` (perishable ingredients) + `geographic` (density) + `reputation` + `roster` (chefs) |

\* AI SaaS uses `fleet` unusually — the "fleet" is compute capacity, not vehicles.

## Game type density per module

Sorted by how many games use each module (rough demand signal for engine work prioritization):

| Module | Demand | Games |
|---|---|---|
| `core` | 41/41 | all |
| `competition` | ~33/41 | all except solo-industry simulators |
| `press` | ~35/40 | all except very abstract sims |
| `inflation` | ~35/40 | all multi-year games |
| `scoring` | 41/41 | all |
| `geographic` | ~19/41 | goods, infrastructure, retail, banking, insurance |
| `reputation` | ~20/40 | physical goods, capital assets, regulated |
| `events` | ~25/40 | most games benefit |
| `roster` | ~10/40 | studios, agencies, sports, law, consulting, record labels |
| `perishable` | ~6/40 | airline, hotel, cruise, event, restaurant |
| `loyalty` | ~9/40 | airline, hotel, fitness, coffee, credit card, cruise |
| `subscription` | ~16/41 | services-shaped games |
| `transaction` | ~15/40 | transport, marketplace, service-per-use |
| `unit-sale` | ~12/40 | physical goods |
| `infrastructure` | ~11/41 | metro, telecom, utility, cloud, heavy industry |
| `fleet` | ~8/40 | transport, rental |
| `inventory` | ~12/40 | goods, retail, CPG |
| `network` | ~7/41 | airline, metro, telecom, logistics, satellite broadband |
| `pipeline` | ~5/40 | pharma, biotech, aerospace, real estate dev |
| `marketplace` | ~5/40 | two-sided platforms |
| `balance-sheet` | ~4/40 | financial services |
| `ranking` | ~10/40 | universities, law/consulting, luxury |
| `political` | ~9/41 | regulated industries |
| `commodities` | ~10/40 | energy, transport, heavy industry |
| `seasonality` | ~15/40 | goods, hospitality, airlines, retail |

**Implication for prioritization:** core + competition + press + inflation + events + reputation get used in most games → v0.1-0.2 focus. Specialists (marketplace, pipeline, balance-sheet) used in <10 games each → v0.5 timing is fine.
