// Smoke test: builds every kind of world in every size with every starting scenario, runs it briefly and checks
// that nothing crashes and no creature or food value turns into NaN/Infinity. Also runs an ice age (sea-level
// changes) and the meteor/bloom/introduce tools on one world.
// Usage: node tools/smoke.mjs [seconds=40]
import { readFileSync } from 'node:fs';

const secs = Number(process.argv[2] || 40);
const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const a = src.indexOf('// === SIM CORE START ===');
const b = src.indexOf('// === SIM CORE END ===');
const core = src.slice(a, b) + '\nreturn { Simulation, DEFAULT_PARAMS, WORLD_TYPES, WORLD_SIZES, SIM_DT, NF };';
const { Simulation, DEFAULT_PARAMS, WORLD_TYPES, WORLD_SIZES, SIM_DT, NF } = new Function(core)();

/**
 * Returns a description of the first broken value in a world, or '' if everything is finite.
 * @param {object} sim - Simulation.
 * @returns {string} Problem description.
 */
function check(sim) {
  for (const c of sim.creatures) {
    for (const k of ['x', 'y', 'energy', 'heading', 'speed', 'maxE', 'basal', 'vmax']) {
      if (!Number.isFinite(c[k])) return `creature ${c.id} ${k}=${c[k]}`;
    }
    for (let i = 0; i < c.ate.length; i++) if (!Number.isFinite(c.ate[i])) return `creature ${c.id} ate[${i}]`;
  }
  for (let p = 0; p < NF; p++) {
    const arr = sim.plants[p];
    for (let k = 0; k < arr.length; k++) if (!Number.isFinite(arr[k]) || arr[k] < 0) return `food ${p} cell ${k} = ${arr[k]}`;
  }
  return '';
} // End of check()

let failures = 0, runs = 0;
const t0 = Date.now();
for (const size of Object.keys(WORLD_SIZES)) {
  for (const type of [...Object.keys(WORLD_TYPES), 'surprise']) {
    for (const scenario of ['twoFounders', 'single', 'random']) {
      runs++;
      try {
        const sim = new Simulation({ ...DEFAULT_PARAMS, seed: 3 + runs, worldSize: size, worldType: type, scenario });
        while (sim.time < secs) sim.step(SIM_DT);
        const bad = check(sim);
        if (bad) { failures++; console.log(`FAIL ${size} ${type} ${scenario}: ${bad}`); }
        else console.log(`ok   ${size.padEnd(6)} ${type.padEnd(11)} ${scenario.padEnd(11)} n=${sim.creatures.length} species=${[...sim.species.values()].filter((s) => !s.extinct).length}`);
      } catch (e) {
        failures++;
        console.log(`FAIL ${size} ${type} ${scenario}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
      }
    } // End of the loop over scenarios
  }
} // End of the loop over sizes
// Events and tools on one world: an ice age (the sea drops and rises again), meteors, blooms, introductions
try {
  const sim = new Simulation({ ...DEFAULT_PARAMS, seed: 5, worldSize: 'Medium', worldType: 'archipelago' });
  sim.startEffect('iceAge', 60);
  for (let i = 0; i < 4; i++) { const p = sim.randomLand(); sim.meteor(p.x, p.y, 60); sim.fertilize(p.x, p.y, 90); }
  sim.introduce(sim.creatures[0].g, 500, 500, 8, 0);
  sim.plague();
  while (sim.time < 120) sim.step(SIM_DT);
  const bad = check(sim);
  runs++;
  if (bad) { failures++; console.log(`FAIL events: ${bad}`); } else console.log(`ok   events (ice age, meteors, blooms, introductions, plague) n=${sim.creatures.length}`);
} catch (e) {
  failures++;
  console.log(`FAIL events: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
}
console.log(`${runs - failures}/${runs} passed in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exitCode = failures ? 1 : 0;
