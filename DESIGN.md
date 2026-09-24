# Evolution! — design notes

A top-down 2D ecosystem where every creature carries a genome of 20 genes (all 0..1). Babies inherit
a recombination of both parents' genes, plus mutations. There are no scripted species: new ones
branch off when populations drift apart. Design ideas were cross-checked with Codex. Its suggestions
adopted here: a camouflage gene, a toxic plant that only matching specialists can digest, hybrid
fertility that fades with genetic distance, milestone notes, and introducing mutants.

## Genome and trade-offs

Every trait has a cost, so no single "best creature" exists. Derived values are computed in `derive()`.

| Gene | Benefit | Cost |
|---|---|---|
| size | more reserves, attack/defence ∝ √mass, bigger bites (∝ m^0.85), reaches berries, keeps warm; plant eaters above mid size grow extra mass (up to ~2× a top predator) and digest grass better (bulk feeding, up to +20%) | metabolism ∝ m^0.75, grows up and breeds slower |
| speed | top speed | upkeep (+30% basal at max), movement cost ∝ m·v² |
| strength | attack power, chews tough plants (cactus) | upkeep (+50%) |
| armor | defence, thorn resistance | −35% speed, upkeep, later maturity |
| endurance | sprint duration, fat reserves; persistence hunting (chases up to ~18 s, tracks prey further, +up to 30% on exhausted prey) | upkeep |
| sense | vision radius (food, mates, danger) | upkeep |
| camo | predators/prey notice you at up to 55% shorter range | upkeep |
| diet | 0 = plants, 1 = meat. Meat eaters gorge (bigger stomach) and have up to 30% lower upkeep | plant digestion ∝ (1−d)^1.3, meat digestion ∝ d^1.3: omnivores are mediocre at both |
| grass / berry / cactus / fern | share of a fixed gut budget; digestion ∝ share^0.6 | generalists digest everything poorly; ferns are poisonous below a 35% share |
| coat | 0 = heat-adapted, 1 = cold-adapted (preferred temperature) | metabolism rises with the square of the temperature mismatch (size helps in the cold) |
| fertility | litter size 1–5 | each baby gets less starting energy (r/K trade-off) |
| swim | water speed 0.3 → 0.9, marsh speed 0.7 → 0.95 (water is an escape route from non-swimmers); no wading surcharge | upkeep (+12%), up to −10% speed on other dry land |
| climb | mountain speed 0.5 → 0.9, forest speed 0.85 → 0.95 | upkeep (+15%), up to −4% speed on other dry land |
| wings | flight = wings × (1 − 0.7·armor) × clamp(1.3 − 1.2·size): good fliers ignore terrain, and ground predators miss up to 25% more attacks on them (flying predators don't) | upkeep (+45%, paid even when too heavy to fly), −15% defence, flying movement costs up to 75% more |
| social | herds: stay together, spot danger up to 30% further, bolt when kin raise the alarm, confuse attackers (up to −25% success); packs: +50% attack per packmate on the same prey (up to 3), packmates barely count as breeding rivals | groups are spotted up to 25% further away, compete for the same food, share kills and suffer more from plagues; social animals disperse less |
| stalk | hunters creep at 30% speed while prey notices them at up to 60% shorter range, then strike from close range (+up to 40% success on prey that isn't fleeing) | hunts are slow (give up after 25 s of stalking) and the final chase is short; neutral for plant eaters |
| hue | neutral lineage marker (drifts slowly) | — |

## World

- Latitude sets temperature (cold north, hot south), plus noise. Biomes: water (slow to cross),
  tundra, grassland, forest, marsh, savanna, desert and mountains (the highest 8% of the map, grey,
  colder towards the peaks, sparse grass and ferns, slow unless you climb). Rivers, lakes and ranges
  partly isolate populations, until swimmers, climbers or fliers evolve.
- Continents: one (Small/Medium) or two (Large/Huge) meandering north–south oceans of deep water split
  the land, so each continent evolves on its own. Every continent gets its share of the founding herds and
  hunter packs. Each ocean has a shallow strait in the temperate middle of the map. When the sea drops (a
  5-minute ice age, or the Climate slider far on the cold side), the strait dries into a land bridge about 400
  units wide that anyone can walk across, and grass steppe grows on it (dry sea floor has its own grass cap).
  The field notes say when bridges open and close, and creatures stranded when the sea rises must swim or drown.
- Barriers: deep ocean needs a good swimmer (swim ≥ 0.5) or a strong flier (flight ≥ 0.5, a long crossing);
  cliffs need a good climber (climb ≥ 0.55) or a decent flier (flight ≥ 0.35). Walkers slide along the edge instead of stepping in. The map's connected
  regions are flood-filled for each kind of access (`computeZones()`, redone when the sea level changes), so
  nobody chases food, mates or prey it cannot reach.
- Islands (in each ocean, ringed by deep water) and mesas (plateaus ringed by two-cell-thick red-brown cliffs)
  have rich, untouched plant cover: empty niches that reward the first swimmers, climbers or fliers.
- World sizes: Small, Medium, Large (default) and Huge (4800 × 3200).
- Walking speed on each biome is per creature (`terrainMul` in `derive()`); hunters compare speeds on
  the ground each animal is standing on.
- Four plants with logistic regrowth, each with its own temperature niche:
  - grass: fast, poor food.
  - berries: rich but seasonal, and tall creatures reach them best.
  - cactus: tough and thorny; needs jaws and armour.
  - toxic ferns: wet ground; poisonous unless the gut is specialised.
- Seasons (a 120 s year), a climate slider, and events: ice age, heat wave, drought, plague, meteors.
- Carcasses (from kills or natural deaths) feed scavengers. That is a stepping stone for carnivory
  to evolve from plant eaters. Carrion is scored in energy per second while eating, like plants, so
  part-time scavengers (omnivores) really use it.

## Behaviour (4 decisions per second, per creature)

The priority order is:
1. Flee from meat-eaters that would probably win a fight, if they are hunting or very close.
2. Mate with a compatible partner in sight (courtship). A creature that stays lonely for 15 s
   reproduces asexually.
3. Eat. The creature compares live prey, carrion and sampled plant cells by expected energy per
   second. Sated predators don't hunt.
4. Otherwise wander, prowl (meat-eaters) or drift toward a comfortable temperature.

Dispersal (checked after fleeing, before mating): half of all young adults, on maturing, walk in a straight
line for 10–30 s (loners more often, social animals less), and crowded creatures leave too: each decision has
a 1% chance to go when more than 4 + 18·social kin are in sight, so loners quit crowds within tens of seconds. They stop if they get
hungry. Without it animals only circled their birthplace, and no creature crossed a land bridge in tests;
with it, a typical ice age sends a handful to a few dozen founders (with their offspring) to another continent.

Kinship: creatures never hunt members of their own species with a similar diet. A meat-eater may prey on
relatives whose diet is at least 0.3 more plant-based, and those relatives flee from it. So predators can
evolve inside a herbivore species before it splits in two. (Before this, carnivores rarely appeared from a
single grazer ancestor: 1 of 4 runs in 30 simulated minutes, against 6 of 6 within about 50 minutes now,
and the grazers + hunters start got more stable too.)

Body size in combat (`subdueMul()`): a lone predator can hardly bring down prey clearly heavier than itself
(packmates on the same prey help), and prey much smaller than its attacker often dodges. A failed attack costs
the attacker more energy the heavier the prey. Together with the extra mass plant eaters can reach, this lets
small, fast-breeding herbivores (rabbits) and giant ones (elephants) coexist. Before, every herbivore shrank to
size ≈0.1 while predators reached 0.6–0.8; now giant herbivore species (0.8–0.97) appear alongside small ones in
test worlds. Fleeing prey barely recovers stamina, so enduring hunters can run it down.

Stabilisers:
- Predators are territorial: they won't breed with more than 3 rival meat-eaters in sight.
- A soft population cap lowers baby viability.
- Juveniles and the elderly are slower and weaker, so predators have an easier food source.

## Species

Every 2 s, each creature is compared with its species prototype (the mean genome of its members):
- If it is farther than the species threshold (default 0.35) and no other species is close enough,
  it founds a new species, and its old species is recorded as the parent.
- Splinter groups with fewer than 4 members are re-absorbed.
- Mating between parents is allowed up to 1.5× the threshold. Fertility fades linearly from 1× to
  1.5× the threshold (a hybrid zone).
- Daughter species get a clearly different colour from their parent. The field notes explain each
  split by the two biggest trait changes.
- Evolution in place (anagenesis): each species keeps its founding genome (the members' mean during its first
  minute). When a species of 20+ members, at least 5 minutes old, has its average more than half the threshold
  away from that genome for three passes in a row, the leading edge (members further along the drift than the
  average) becomes a successor species with a related colour ("X has evolved into Y"). After that, any member
  clearly closer to the successor's average than to the ancestor's (by a 20% margin) moves across each pass, so
  the ancestor fades gradually and ends without an extinction notice. Before this, the founding grazer kept its
  name forever and led the charts in 5 of 6 test worlds after 40 minutes. Now it typically holds ~75% of all
  creatures at 15 minutes, ~50% at 25 and 10–20% at 40, with 13–17 such events per world in 40 minutes.
  (Triggering on individual members' distance instead fired 26–44 times, because within-species variation alone
  puts many members that far out.)

## Visual encoding

| Trait | How it looks |
|---|---|
| size | Body size |
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
  cold coat), whose corners square off with armour, and which narrows towards the snout with strength. So fast
  creatures look like long ellipses, armoured ones like rectangles, strong-jawed ones like triangles and
  cold-adapted, slow ones like circles, and every mix in between. It is drawn at every zoom except the dots.
- The "Look" button (key C) recolours every creature by any single trait on a blue→red ramp.
- When zoomed out, creatures become dots in their species colour (in the natural look; other colour modes keep
  their ramp). The minimap does the same.

## Interface

- Clicking a species in the list highlights it: its members are drawn on top at full opacity (outlined when
  they are dots) while every other creature fades, on the map, minimap and charts. A stats card shows its
  population, share, peak, age, ancestor, daughter species, average energy/age, generations, and each
  trait's average with the middle-80% range. Click again, "Show all species" or Esc to clear.
  The list reuses its buttons so clicks aren't lost when the ranking changes.
- Toolbar tools have text labels and keys 1–4. The hint line under the toolbar explains the active tool
  (including what 🧬 will copy), and a dashed circle under the mouse shows the tool's area.
- Introducing copies while a species is highlighted adds them to that species.

## Tuning

Run `node tools/headless.mjs [seconds] [seed] [scenario]`.
The movement genes were checked over 16 seeds × 1200 s: no prey collapses, the same as before they were added.
A lower mutation rate (0.25) and distance normaliser (6) were tried and made collapses more likely, so both kept
their old values. It extracts the SIM CORE block from
`index.html` and prints population, guilds, species and trait percentiles every simulated minute.
