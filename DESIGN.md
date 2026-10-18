# Evolution! — design notes

A top-down 2D ecosystem where every creature carries a genome of 20 genes (all 0..1). Babies inherit
a recombination of both parents' genes, plus mutations. There are no scripted species: new ones
branch off when populations drift apart. Design ideas were cross-checked with Codex. Its suggestions
adopted here: a camouflage gene, a toxic plant that only matching specialists can digest, hybrid
fertility that fades with genetic distance, milestone notes, introducing mutants, and (in the food-web
rework below) small animal foods as a bridge to carnivory, food choice by expected net energy per second,
and predator breeding that follows the prey around.

## Why carnivores rarely evolved, and what changed

Measured with `tools/batch.mjs` before the rework (Large world, 30 simulated minutes): from a single grazer
ancestor the first 10+ carnivores appeared after 15–25 minutes; with grazers + hunters, carnivores descended from
grazers appeared in only 4 of 6 worlds; on Small worlds the population crashed to ~100 and 0 of 6 worlds evolved
carnivores. Plants sat at 70–90% of capacity and the only species that mattered were "small grass eater",
"medium grass eater" and "medium carnivore". Several barriers were stacked on top of each other:

1. **Mothers died giving birth.** The first baby of a litter was always conceived, even when it cost more than the
   mother had (a baby costs ~0.5 of an adult's reserves and mothers bred from 60%). Over half of all "starvation"
   deaths were mothers right after mating. Now a mother keeps 15% of her reserves (`BIRTH_RESERVE`) and only
   breeds once the first baby is affordable (`breedAt`), and keeps eating until then. A baby costs a share of the
   mother's body reserves (`bodyE`), not of her stomach, so meat eaters (who gorge) no longer pay 1.6× more per baby.
2. **No gradual path into any new niche.** Thorn damage was a flat subtraction and fern poison a flat penalty, so a
   grazer with a little more cactus or fern gut got nothing until it was a full specialist. Meat only paid once an
   animal could hunt. Now every food is worth a little to a slightly adapted animal and a lot to a specialist:
   thorns take a share of the energy, ferns are digested in proportion to the fern share of the gut, and two small
   animal foods (bugs and fish) are digested like meat and need no hunting.
3. **Food was never short**, so there was no competition pushing lineages apart. Herds starved on ground they had
   grazed bare while the rest of the map stayed full, and foragers walked to slightly richer cells instead of
   eating. Now animals compare food by energy per second including the walk, look beyond sight on a coarse food
   map, and plants regrow more slowly: grass is grazed well down and populations are limited by food.
4. **Hunting was undervalued and hard to find.** Plants were compared at ×6 their real value, a hard 30% success
   threshold excluded most prey, and hunters only looked within sight. Now every option is scored by expected net
   energy per second (chase, strikes, bruises, eating until full), and hungry hunters follow the scent of herds on a
   coarse prey map.

Fixing those uncovered two more problems, both found with the batch runner:

5. **Carnivores took over.** Meat eaters had a 30% upkeep discount (from when carnivory needed every help), and with
   bugs, fish and carcasses as side dishes they ended up outnumbering their prey 1.6 : 1 after 40 minutes. Without
   the discount (`MEAT_UPKEEP` 0) and with leaner carcasses from natural deaths (`LEAN_CARCASS` 0.1), plant eaters
   outnumber meat eaters again and predator numbers follow their prey (see the breeding odds below). Making
   predator breeding stricter or bugs scarcer alone did not help.
6. **Everything shrank to the minimum size.** Two causes. A bug: baby cost was taken from the baby's own (mutated)
   genome, so once the first baby had to be affordable, small mutants slipped through while big ones were aborted
   (with the size gene made invisible to the body, the gene stayed put; with it visible, it fell from 0.30 to 0.12
   in 15 minutes). And eating speed: with fast bites the bottleneck is walking from one grazed patch to the next,
   which a small body needs to do far less often, so tiny bodies won everywhere. With `BITE` 0.2 (the original value)
   eating is the bottleneck again, bigger mouths pay off, and grazers stay around size 0.15–0.4 (bulk feeding helps
   big grazers too). Bugs and fish are caught at their own rates, so they still feed the first meat eaters.

With all of this, in test worlds (Large, 40 simulated minutes): carnivores descended from plant eaters evolved in
every single-ancestor world (first after 20–30 minutes); with grazers + hunters the founding hunters persisted in 9 of
12 worlds and new carnivore lineages evolved as well; worlds ended up with 20–40 species in 10–14 niches, and plant
eaters kept a typical body size of 0.15–0.4. The default seed is 9, a world where the founding hunters persist.

Known limitation: after 30–40 minutes, small bug- and fish-eating carnivores often outnumber the plant eaters (most of
all in random soup). Making bugs and fish scarcer (half the cover) fixed that, but carnivores then took 30–40 minutes
to evolve and the founding hunters died out in most worlds, so it was not adopted.

## Genome and trade-offs

Every trait has a cost, so no single "best creature" exists. Derived values are computed in `derive()`.

| Gene | Benefit | Cost |
|---|---|---|
| size | more reserves, attack/defence ∝ √mass, bigger bites (∝ m^0.85), reaches berries, keeps warm, travels cheaply per kilo (movement cost ∝ m^0.75); plant eaters above mid size grow extra mass (up to ~2× a top predator); bulk feeding: fibrous plants are digested ×(1 + bulk·(√m − 0.9)), clamped 0.4–1.4 (grass bulk 0.6, cactus 0.3, fern 0.2, berries 0) | metabolism ∝ m^0.75, grows up and breeds slower |
| speed | top speed, catches bugs | upkeep (+30% basal at max), movement cost ∝ m·v² |
| strength | attack power, chews tough plants (cactus) | upkeep (+50%) |
| armor | defence, thorn resistance | −35% speed, upkeep, later maturity |
| endurance | sprint duration, fat reserves; persistence hunting (chases up to ~18 s, tracks prey further, +up to 30% on exhausted prey) | upkeep |
| sense | vision radius (food, mates, danger), catches bugs | upkeep |
| camo | predators/prey notice you at up to 55% shorter range | upkeep |
| diet | 0 = plants, 1 = meat. Meat (bugs, fish, carrion, prey) is digested at diet^0.65, so partial meat eaters already get a fair share; meat eaters gorge (bigger stomach). From 0.15 a creature scavenges, from 0.3 it hunts | each plant is digested at (1 − diet)^fiber: grass (fiber 1.5) needs a real plant gut, ripe berries (0.5) suit omnivores too |
| grass / berry / cactus / fern | share of a fixed gut budget; digestion ∝ share^0.6 | generalists digest everything poorly; ferns are only digested in proportion to a fern share of up to 35% |
| coat | 0 = heat-adapted, 1 = cold-adapted (preferred temperature) | metabolism rises with the square of the temperature mismatch (size helps in the cold) |
| fertility | litter size 1–5 | each baby gets less starting energy (r/K trade-off) |
| swim | water speed 0.3 → 0.9, marsh speed 0.7 → 0.95 (water is an escape route from non-swimmers); no wading surcharge; catches fish | upkeep (+12%), up to −10% speed on other dry land |
| climb | mountain speed 0.5 → 0.9, forest speed 0.85 → 0.95; reaches berries | upkeep (+15%), up to −4% speed on other dry land |
| wings | flight = wings × (1 − 0.7·armor) × clamp(1.3 − 1.2·size): good fliers ignore terrain, reach berries, catch bugs and fish, and ground predators miss up to 25% more attacks on them (flying predators don't) | upkeep (+45%, paid even when too heavy to fly), −15% defence, flying movement costs up to 75% more |
| social | herds: stay together, spot danger up to 30% further, bolt when kin raise the alarm, confuse attackers (up to −25% success); packs: +50% attack per packmate on the same prey (up to 3), packmates count less as breeding rivals | groups are spotted up to 25% further away, compete for the same food, share kills and suffer more from plagues; social animals disperse less |
| stalk | hunters creep at 30% speed while prey notices them at up to 60% shorter range, then strike from close range (+up to 40% success on prey that isn't fleeing) | hunts are slow (give up after 25 s of stalking) and the final chase is short; neutral for plant eaters |
| hue | neutral lineage marker (drifts slowly) | — |

## Food web

Six grid foods with logistic regrowth (`FOODS`), each with its own temperature niche and seasonality, plus carcasses
and live prey. Regrowth is scaled by `REGROWTH` (0.55) and by the world's lushness (below). An animal of mass 1 eats
`BITE` = 0.2 units of biomass per second.

| Food | Where | Who gets most out of it |
|---|---|---|
| grass | grassland, savanna, steppe | plant eaters with a grass gut; big bodies digest it better |
| berries | forest, mesas | tall animals, climbers and fliers reach the bushes; omnivores digest them well; gone in winter |
| cactus | desert, savanna | strong jaws (toughness 0.6) and armour (thorns take up to 45% of the energy) and a cactus gut |
| toxic ferns | marsh, forest | only in proportion to the fern share of the gut |
| bugs | everywhere on land, in patches (termite mounds, rotting logs), richest in warm wet places; scarce in winter | quick, sharp-eyed partial meat eaters and fliers; the catch grows as m^0.6 (slower than needs), so bugs suit small animals best |
| fish | rivers, lakes, marsh, shallow seas and a little in the open sea | anyone wading catches a few; swimmers and diving fliers catch many (catch rate 1.8 × min(1, 0.15 + 1.1·swim^1.2 + 0.7·flight)) |
| carcasses | where animals die | scavengers (diet ≥ 0.15). A fresh kill is a full meal; animals that died of hunger, cold or old age leave 10% (`LEAN_CARCASS`) |
| prey | — | hunters (diet ≥ 0.3), see below |

Bugs and fish are the first step from plant eating towards meat eating: an animal with a little more meat in its diet
gets a little more out of them, with no hunting skills needed. The next step is scavenging, then hunting.

## World

- Latitude sets temperature (cold north, hot south), plus noise. Biomes: water (slow to cross),
  tundra, grassland, forest, marsh, savanna, desert and mountains (the highest 8% of the map, grey,
  colder towards the peaks, sparse grass and ferns, slow unless you climb). Rivers, lakes and ranges
  partly isolate populations, until swimmers, climbers or fliers evolve.
- Kinds of world (`WORLD_TYPES`, "Kind of world" in the World folder, `?type=` in the address bar):
  - Continents (default): one (Small/Medium) or two (Large/Huge) meandering north–south oceans of deep water split
    the land. Each ocean has a shallow strait in the temperate middle of the map that dries into a land bridge
    when the sea drops (a 5-minute ice age, or the Climate slider far on the cold side).
  - Pangaea: one landmass, no oceans.
  - Archipelago: 42% of the map is open sea; islands everywhere, ringed by deep water whose shallow shelves dry into
    land bridges in ice ages. Swimmers and fliers are at a premium.
  - Wetlands (wetter, more marsh, forest and rivers), Drylands (warmer and drier: desert and savanna) and Frozen
    world (much colder: tundra).
  - Surprise me: one of the above, picked from the seed.
- Barriers: deep ocean needs a good swimmer (swim ≥ 0.5) or a strong flier (flight ≥ 0.5, a long crossing);
  cliffs need a good climber (climb ≥ 0.55) or a decent flier (flight ≥ 0.35). Walkers slide along the edge instead
  of stepping in. The map's connected regions are flood-filled for each kind of access (`computeZones()`, redone
  when the sea level changes), so nobody chases food, mates or prey it cannot reach.
- Islands (in each ocean, ringed by deep water) and mesas (plateaus ringed by two-cell-thick red-brown cliffs)
  have rich, untouched plant cover: empty niches that reward the first swimmers, climbers or fliers.
- World sizes: Small (1600 × 1060), Medium (3200 × 2140), Large (4800 × 3200, default) and Huge (7200 × 4800).
  Geography scales with the map (`featureScale` = √(area / 3200·2140)), so big worlds have big continents rather
  than more of them. Smaller worlds are lusher per unit of ground (`lushness` = √(Large area / area), 0.62–3), so
  they feed about 700 (Small), 1400 (Medium), 2200 (Large) and 3000 (Huge) animals. Before, a Small world crashed
  to ~100 animals and never evolved carnivores.
- Plant cover is sparse (`PLANT_DENSITY` 0.45 of the biome caps), so herds have open ground around them.
- Founding herds start on the most comfortable of 40 random spots of their continent (temperature close to what
  they like, some grass), at mixed ages, and each founding stock starts as one species.
- The world settings (seed, size, kind, starting life) are kept in the address bar, so a world can be bookmarked
  or shared; "🎲 New world" picks a new seed.
- Seasons (a 160 s year), a climate slider, and events: ice age, heat wave, drought, plague, meteors.

## Behaviour (4 decisions per second, per creature)

The priority order is:
1. Flee from meat-eaters that would probably win a fight, if they are hunting or very close.
2. Mate with a compatible partner in sight (courtship). A creature that stays lonely for 15 s
   reproduces asexually.
3. Eat. Every option is scored in expected energy per second over the whole episode:
   - a food cell: what it holds (up to the room in the stomach) over the walk there plus the time to eat it;
   - a carcass: the same, at the meat eating rate;
   - live prey: two strikes' chance of a kill × the meal (up to the room in the stomach), minus the bruises of failed
     strikes (big prey hits hard), over the chase, the strikes and the meal.
   Sated predators don't hunt. A hunter with no prey in sight and little else to eat follows the scent of herds
   (`scoutPrey()`, the busiest block of plant-leaning animals within ~400 units). Anyone with nothing good in sight
   heads for the best feeding ground on the coarse food map (`scoutFood()`, 128-unit blocks within ~300 units).
4. Otherwise wander, prowl (meat-eaters) or drift toward a comfortable temperature.

Dispersal (checked after fleeing, before mating): half of all young adults, on maturing, walk in a straight
line for 15–45 s (loners more often, social animals less), and crowded creatures leave too: each decision has
a 1% chance to go when more than 4 + 18·social kin are in sight. They stop if they get hungry.

Kinship: creatures never hunt members of their own species with a similar diet. A meat-eater may prey on
relatives whose diet is at least 0.3 more plant-based, and those relatives flee from it. So predators can
evolve inside a herbivore species before it splits in two.

Assortative mating by diet: partners must differ by at most 0.2 in diet, so a meat-leaning lineage breeds among
itself instead of being bred back into the grazer majority.

Body size in combat (`subdueMul()`): a lone predator can hardly bring down prey clearly heavier than itself
(packmates on the same prey help), and prey much smaller than its attacker often dodges. A failed attack costs
the attacker more energy the heavier the prey. Fleeing prey barely recovers stamina, so enduring hunters can run
it down.

Stabilisers:
- Predators breed in proportion to the prey around them: the chance of a conception is
  1 / (1 + 2·rivals / (prey + 2)) for a full meat eater (rival hunters in sight, packmates counting less; omnivores
  are affected in proportion to how much meat they eat). This replaced the old "no breeding with more than 3 rival
  meat-eaters in sight" rule.
- A soft population cap prevents conceptions above 80% of the cap.
- Juveniles and the elderly are slower and weaker, so predators have an easier food source.

## Species

Every 2 s, each creature is compared with its species prototype (the mean genome of its members):
- If it is farther than the species threshold (default 0.35) and no other species is close enough,
  it founds a new species, and its old species is recorded as the parent.
- Splinter groups with fewer than 4 members are re-absorbed.
- Mating between parents is allowed up to 1.5× the threshold. Fertility fades linearly from 1× to
  1.5× the threshold (a hybrid zone). Partners must also differ by no more than 0.2 in diet (see Kinship).
- Daughter species get a clearly different colour from their parent. The field notes explain each
  split by the two biggest trait changes.
- Evolution in place (anagenesis): each species keeps its founding genome (the members' mean during its first
  minute). When a species of 20+ members, at least 5 minutes old, has its average more than half the threshold
  away from that genome for three passes in a row, the leading edge (members further along the drift than the
  average) becomes a successor species with a related colour ("X has evolved into Y"). After that, any member
  clearly closer to the successor's average than to the ancestor's (by a 20% margin) moves across each pass, so
  the ancestor fades gradually and ends without an extinction notice.
- Every creature records the energy it has eaten from each source (`ate`: six grid foods, its own or its pack's
  kills, and carrion); each species sums its members'. That drives the "Eats" bars, the species descriptions, the
  Diets chart and the milestones.
- Milestones (field notes, once per world, for evolved species with 10+ members): first omnivores and first true
  carnivores descended from plant eaters, the first species living mainly on hunting, bugs, fish, carrion, cactus or
  ferns, the first fliers, swimmers, climbers and giants, and the first cold- and heat-adapted species.

## Visual encoding

| Trait | How it looks |
|---|---|
| size | Body size (youngsters are drawn smaller and grow up to full size as they mature) |
| diet | Body colour: green → yellow → red |
| camo | Drab, mottled body |
| speed | Long blue legs; long, slim body |
| strength | Big dark jaws; wedge-shaped body (narrow head, wide hips) |
| armor | Grey shell and spikes; boxy body |
| endurance | Purple stripes |
| sense | Eyes and antennae |
| plant digestion | Belly pie chart |
| coat | White fur and a round, compact body (cold) or big orange ears (heat) |
| fertility | White rump spots (one per baby in a litter) |
| swim | Teal back fin and webbed feet |
| climb | Dark hooked claws on the feet |
| wings | Pale wings from 0.25 up (they flap on creatures light enough to fly) |
| social | Shaggy orange neck mane |
| stalk | Whiskers |
| species | Tail colour; zoomed out (dots and small ovals) the whole body takes it, matching the species list and charts |

- Body outline (`bodyShape()`): a superellipse whose length/width ratio grows with speed (and shrinks with a
  cold coat), whose corners square off with armour, and which narrows towards the snout with strength.
- Zoomed in, bugs crawl about as dark specks and fish sway in the water.
- The "Look" button (key C) recolours every creature by any single trait on a blue→red ramp.
- When zoomed out, creatures become dots in their species colour (in the natural look; other colour modes keep
  their ramp). The minimap does the same.

## Interface

- Clicking a species in the list highlights it: its members are drawn on top at full opacity (outlined when
  they are dots) while every other creature fades, on the map, minimap and charts. A stats card shows its
  population, share, peak, age, ancestor, daughter species, average energy/age, generations, what its members eat
  (a coloured bar), and each trait's average with the middle-80% range. Click again, "Show all species" or Esc to
  clear. The creature inspector shows what that creature has eaten in the same way.
- Charts: Population (by species), Diets (how many creatures live mainly on each food source: new bands are new
  niches), Traits, Morphospace and the family Tree.
- Toolbar tools have text labels and keys 1–4. The hint line under the toolbar explains the active tool
  (including what 🧬 will copy), and a dashed circle under the mouse shows the tool's area.
- Introducing copies while a species is highlighted adds them to that species.
- `evo` in the browser console gives access to the simulation (`evo.sim`), its parameters and the view.

## Tuning

- `node tools/headless.mjs [seconds] [seed] [scenario]` extracts the SIM CORE block from `index.html` and prints
  population, guilds, species and trait percentiles every simulated minute.
- `node tools/batch.mjs --secs=1800 --seeds=1-8 --scen=single,twoFounders,random --size=Large` runs many worlds in
  parallel worker threads and prints, per sample time, population, herbivores/omnivores/carnivores, carnivores
  descended from plant eaters, plant fill, species and niches; at the end, the fill of each food, where the energy
  came from (for everyone and for carnivores), the diet histogram, median body sizes and deaths by cause.
  `--file=a.html,b.html` compares variants side by side and `--set='{"plantGrowth":0.5}'` overrides parameters
  (for example `--set='{"worldType":"archipelago"}'`).
- `node tools/smoke.mjs [seconds]` builds every kind of world in every size with every starting scenario, runs
  each briefly plus an ice age, meteors, blooms, introductions and a plague, and fails on crashes or NaN values.
