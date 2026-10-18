// Batch balance runner: runs many seeds (and scenarios) of the SIM CORE in parallel worker threads and
// prints a compact table of how predators and diversity fare over time.
// Usage: node tools/batch.mjs --secs=1800 --seeds=1-8 --scen=twoFounders,single,random --file=index.html --size=Large
//   --seeds: "1-8" or "3,7,11"; --file: path relative to the repo root, or absolute; --every: sample interval (s);
//   --set: JSON object of parameter overrides.
// Lineage: every creature is tagged by its founding ancestor (G = plant-eating founder, H = meat-eating founder),
// so "novel" carnivores (diet >= 0.66 descended from plant eaters) can be told apart from the founding hunters.
import { readFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';

/**
 * Loads the SIM CORE block of an index.html file as a module-like object.
 * @param {string} file - Path to the HTML file.
 * @returns {object} Exports of the simulation core.
 */
function loadCore(file) {
  const src = readFileSync(file, 'utf8');
  const a = src.indexOf('// === SIM CORE START ===');
  const b = src.indexOf('// === SIM CORE END ===');
  if (a < 0 || b < 0) throw new Error('SIM CORE markers not found in ' + file);
  const core = src.slice(a, b) + '\nreturn { Simulation, DEFAULT_PARAMS, GENES, G, SIM_DT, derive };';
  return new Function(core)();
}

/**
 * Classifies a species prototype into a coarse niche label, used to count ecological variety.
 * @param {object} core - Simulation core exports.
 * @param {Float32Array} g - Prototype genome.
 * @returns {string} Niche label.
 */
function nicheOf(core, g) {
  const { G, derive } = core;
  const c = { g: Float32Array.from(g) };
  derive(c);
  const d = g[G.diet];
  const guild = d < 0.33 ? 'H' : d < 0.66 ? 'O' : 'C';
  let food = '';
  if (d < 0.6) {
    const plants = ['g', 'b', 'c', 'f'];
    let best = 0;
    for (let k = 1; k < 4; k++) if (c.share[k] > c.share[best]) best = k;
    food = plants[best];
  }
  const size = c.m > 2.5 ? 'L' : c.m < 0.6 ? 'S' : 'M';
  const move = c.fly > 0.35 ? 'f' : g[G.swim] > 0.5 ? 's' : g[G.climb] > 0.55 ? 'k' : '';
  return guild + food + size + move;
} // End of nicheOf()

/**
 * Runs one simulation and returns its time series and summary.
 * @param {object} job - {file, secs, seed, scenario, size, every, overrides}.
 * @returns {object} Result.
 */
function runOne(job) {
  const core = loadCore(job.file);
  const { Simulation, DEFAULT_PARAMS, G, SIM_DT } = core;
  // Tag lineages: newborns inherit their mother's founder tag
  const origSpawn = Simulation.prototype.spawn;
  Simulation.prototype.spawn = function (g, x, y, e, mother) {
    const c = origSpawn.call(this, g, x, y, e, mother);
    c.lin = mother ? mother.lin : (g[G.diet] > 0.5 ? 'H' : 'G');
    return c;
  };
  // Energy intake by source (grid foods by index, then carrion/kills), reset every sample
  let intake = [], carnIntake = [];
  const origGraze = Simulation.prototype.graze;
  Simulation.prototype.graze = function (c, dt) {
    const e0 = c.energy, p = c.plantKind;
    origGraze.call(this, c, dt);
    if (p >= 0 && c.energy > e0) {
      intake[p] = (intake[p] || 0) + c.energy - e0;
      if (c.g[G.diet] >= 0.66) carnIntake[p] = (carnIntake[p] || 0) + c.energy - e0;
    }
  };
  // Carcasses: 9 = from a kill this creature made, 10 = scavenged
  const origCorpse = Simulation.prototype.eatCorpse;
  Simulation.prototype.eatCorpse = function (c, o, dt) {
    const e0 = c.energy;
    origCorpse.call(this, c, o, dt);
    const src = o.killer === c.id ? 9 : 10;
    intake[src] = (intake[src] || 0) + c.energy - e0;
    if (c.g[G.diet] >= 0.66) carnIntake[src] = (carnIntake[src] || 0) + c.energy - e0;
  };
  const origAttack = Simulation.prototype.attack;
  Simulation.prototype.attack = function (c, t) {
    origAttack.call(this, c, t);
    if (c.target && c.state === 'carrion') c.target.killer = c.id;
  };
  const params = { ...DEFAULT_PARAMS, seed: job.seed, scenario: job.scenario, worldSize: job.size, ...(job.overrides || {}) };
  const sim = new Simulation(params);
  const series = [];
  let firstNovel = -1, next = 0;
  const t0 = Date.now();
  while (sim.time < job.secs) {
    sim.step(SIM_DT);
    if (sim.time >= next) {
      next += job.every;
      // Food fill per type and intake shares since the last sample
      const nf = sim.plants.length, fill = [], share = [];
      for (let p = 0; p < nf; p++) {
        let v = 0, cap = 0;
        for (const k of (sim.growLists ? sim.growLists[p] : sim.growCells)) { v += sim.plants[p][k]; cap += sim.caps[p][k]; }
        fill.push(cap ? Math.round(100 * v / cap) : 0);
      }
      const tot = intake.reduce((s, x) => s + (x || 0), 0) || 1;
      for (const i of [...Array(nf).keys(), 9, 10]) share.push(Math.round(100 * (intake[i] || 0) / tot));
      const ctot = carnIntake.reduce((s, x) => s + (x || 0), 0) || 1;
      const cshare = [];
      for (const i of [...Array(nf).keys(), 9, 10]) cshare.push(Math.round(100 * (carnIntake[i] || 0) / ctot));
      intake = []; carnIntake = [];
      const dietHist = [0, 0, 0, 0, 0];
      for (const c of sim.creatures) dietHist[Math.min(4, Math.floor(c.g[G.diet] * 5))]++;
      // Median size gene of plant eaters and of meat eaters
      const med = (arr) => { if (!arr.length) return -1; arr.sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; };
      const szH = med(sim.creatures.filter((c) => c.g[G.diet] < 0.33).map((c) => c.g[G.size]));
      const szC = med(sim.creatures.filter((c) => c.g[G.diet] >= 0.66).map((c) => c.g[G.size]));
      let H = 0, O = 0, C = 0, novel = 0, swim = 0, fly = 0, climb = 0, giant = 0;
      for (const c of sim.creatures) {
        const d = c.g[G.diet];
        if (d < 0.33) H++; else if (d < 0.66) O++; else C++;
        if (d >= 0.66 && c.lin === 'G') novel++;
        if (c.g[G.swim] > 0.5) swim++;
        if (c.fly > 0.35) fly++;
        if (c.g[G.climb] > 0.55) climb++;
        if (c.m > 2.5) giant++;
      }
      if (novel >= 10 && firstNovel < 0) firstNovel = sim.time;
      const live = [...sim.species.values()].filter((s) => !s.extinct && s.count >= 10);
      const niches = new Set(live.map((s) => nicheOf(core, s.proto)));
      const carnSp = live.filter((s) => s.proto[G.diet] >= 0.66).length;
      const pf = sim.history.length ? sim.history[sim.history.length - 1].plants : 0;
      series.push({ t: Math.round(sim.time), n: sim.creatures.length, H, O, C, novel, pf, sp: live.length, carnSp, niches: niches.size,
        swim, fly, climb, giant, nicheList: [...niches].sort().join(' '), fill, share, cshare, dietHist, szH, szC });
    }
  } // End of the simulation loop
  return { job, series, firstNovel, stats: sim.stats, wall: (Date.now() - t0) / 1000 };
} // End of runOne()

if (!isMainThread) {
  parentPort.postMessage(runOne(workerData));
} else {
  // Named options: --secs=1800 --seeds=1-8 --scen=twoFounders,single,random --file=index.html --size=Large --every=300 --set='{"plantGrowth":1.2}'
  const opt = { secs: '1800', seeds: '1-8', scen: 'twoFounders,single,random', file: 'index.html', size: 'Large', every: '300', set: '' };
  for (const a of process.argv.slice(2)) { const m = a.match(/^--(\w+)=(.*)$/); if (m) opt[m[1]] = m[2]; }
  const { secs, seeds: seedsArg, scen: scenArg, file: fileArg, size, every, set: overridesArg } = opt;
  const root = fileURLToPath(new URL('../', import.meta.url));
  const files = fileArg.split(',').map((f) => (isAbsolute(f) ? f : resolve(root, f)));
  const seeds = seedsArg.includes('-')
    ? Array.from({ length: Number(seedsArg.split('-')[1]) - Number(seedsArg.split('-')[0]) + 1 }, (_, i) => Number(seedsArg.split('-')[0]) + i)
    : seedsArg.split(',').map(Number);
  const overrides = overridesArg ? JSON.parse(overridesArg) : {};
  const jobs = [];
  for (const file of files) for (const scenario of scenArg.split(',')) for (const seed of seeds) jobs.push({ file, secs: Number(secs), seed, scenario, size, every: Number(every), overrides });
  const results = [];
  let running = 0, idx = 0;
  const limit = Math.max(1, availableParallelism() - 1);
  await new Promise((done) => {
    /**
     * Starts queued jobs until the worker limit is reached; resolves when all have finished.
     */
    const pump = () => {
      if (idx >= jobs.length && running === 0) { done(); return; }
      while (running < limit && idx < jobs.length) {
        const job = jobs[idx++];
        running++;
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: job });
        w.on('message', (r) => {
          results.push(r);
          const l = r.series[r.series.length - 1];
          console.error(`[done ${results.length}/${jobs.length}] ${r.job.file.split('/').pop()} ${r.job.scenario} seed ${r.job.seed}: `
            + r.series.map((s) => `${s.t}:${s.H}/${s.O}/${s.C}`).join(' ') + ` niches=${l.niches} sp=${l.sp} first=${Math.round(r.firstNovel)} size H/C=${l.szH.toFixed(2)}/${l.szC.toFixed(2)}`);
        });
        w.on('error', (e) => { console.error('job failed', job.scenario, job.seed, e); });
        w.on('exit', () => { running--; pump(); });
      }
    };
    pump();
  });
  results.sort((a, b) => a.job.file.localeCompare(b.job.file) || a.job.scenario.localeCompare(b.job.scenario) || a.job.seed - b.job.seed);
  for (const file of files) for (const scenario of scenArg.split(',')) {
    const mine = results.filter((x) => x.job.scenario === scenario && x.job.file === file);
    console.log(`\n=== ${files.length > 1 ? file.split('/').pop() + ' ' : ''}${scenario} (${size}, ${secs}s) ===`);
    console.log('seed  ' + results[0].series.map((s) => `t=${s.t}`.padEnd(34)).join(''));
    let novelWorlds = 0, carnWorlds = 0;
    for (const r of mine) {
      const cells = r.series.map((s) => `${s.n}:${s.H}/${s.O}/${s.C}(${s.novel}) p${Math.round(s.pf * 100)} sp${s.sp} n${s.niches}`.padEnd(34)).join('');
      console.log(String(r.job.seed).padEnd(6) + cells + ` first=${r.firstNovel < 0 ? '-' : Math.round(r.firstNovel)}`);
      const last = r.series[r.series.length - 1];
      if (r.firstNovel >= 0) novelWorlds++;
      if (last.C >= 10) carnWorlds++;
    }
    const finals = mine.map((r) => r.series[r.series.length - 1]);
    const avg = (k) => (finals.reduce((s, f) => s + f[k], 0) / finals.length).toFixed(1);
    console.log(`worlds with novel carnivores (10+ at some point): ${novelWorlds}/${finals.length}; carnivores (10+) at the end: ${carnWorlds}/${finals.length}`);
    console.log(`final averages: n=${avg('n')} species=${avg('sp')} carnSpecies=${avg('carnSp')} niches=${avg('niches')} swim=${avg('swim')} fly=${avg('fly')} climb=${avg('climb')} giant=${avg('giant')}`);
    for (const r of mine) {
      const l = r.series[r.series.length - 1];
      const st = r.stats;
      console.log(`  seed ${r.job.seed} fill g/b/c/f/bug/fish=${l.fill.join('/')} intake g/b/c/f/bug/fish/kill/scav=${l.share.join('/')} carnivores'=${l.cshare.join('/')} diet5=${l.dietHist.join('/')} size H/C=${l.szH.toFixed(2)}/${l.szC.toFixed(2)}`);
      console.log(`         deaths eaten/starved/old/cold=${st.eaten}/${st.starved}/${st.old}/${st.cold} niches: ${l.nicheList}`);
    }
  } // End of the per-scenario report
  console.log(`\nwall: ${results.map((r) => r.wall.toFixed(0)).join(' ')} s`);
}
