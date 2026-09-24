// Headless balance runner: extracts the SIM CORE block from index.html and runs it in Node.
// Usage: node tools/headless.mjs [seconds=900] [seed=7] [scenario=twoFounders] [file=index.html]
import { readFileSync } from 'node:fs';

const [secs = '900', seed = '7', scenario = 'twoFounders', file = 'index.html'] = process.argv.slice(2);
const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const a = src.indexOf('// === SIM CORE START ===');
const b = src.indexOf('// === SIM CORE END ===');
if (a < 0 || b < 0) throw new Error('SIM CORE markers not found in ' + file);
const core = src.slice(a, b) + '\nreturn { Simulation, DEFAULT_PARAMS, GENES, G, SIM_DT };';
const { Simulation, DEFAULT_PARAMS, GENES, SIM_DT } = new Function(core)();

const params = { ...DEFAULT_PARAMS, seed: Number(seed), scenario };
const sim = new Simulation(params);
const t0 = Date.now();
const total = Number(secs);
const show = ['size', 'speed', 'strength', 'armor', 'sense', 'camo', 'diet', 'grass', 'berry', 'cactus', 'fern', 'coat', 'fertility', 'swim', 'climb', 'wings', 'social', 'stalk'];

/**
 * Prints a one-line population and trait summary.
 */
function report() {
  const h = sim.history[sim.history.length - 1];
  const live = [...sim.species.values()].filter((s) => !s.extinct && s.count > 0).sort((x, y) => y.count - x.count);
  const med = show.map((k) => { const i = GENES.indexOf(k) * 3; return `${k.slice(0, 4)}=${h.q[i].toFixed(2)}/${h.q[i + 1].toFixed(2)}/${h.q[i + 2].toFixed(2)}`; }).join(" ");
  console.log(`t=${sim.time.toFixed(0).padStart(5)} n=${String(h.n).padStart(4)} H/O/C=${h.herb}/${h.omni}/${h.carn} `
    + `plants=${h.plants.toFixed(2)} species=${live.length} (${live.slice(0, 4).map((s) => s.name + ':' + s.count).join(', ')}) `
    + `gen=${sim.stats.maxGen} corpses=${sim.corpses.length}`);
  console.log('        ' + med);
} // End of report()

let next = 0;
while (sim.time < total) {
  sim.step(SIM_DT);
  if (sim.time >= next) { report(); next += 60; }
}
report();
const s = sim.stats;
console.log(`deaths: eaten=${s.eaten} starved=${s.starved} old=${s.old} cold=${s.cold} disaster=${s.disaster}; attacks=${s.attacks} giveUps=${s.giveUps}; born=${s.born}; peak=${s.peak}`);
console.log('log:', sim.log.slice(-15).map((l) => `${l.t.toFixed(0)}:${l.key}`).join(' '));
console.log(`wall ${(Date.now() - t0) / 1000}s for ${total}s simulated`);
