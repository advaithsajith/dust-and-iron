// Replays one session and prints the bot's situation every 60 simulated seconds.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
import { makeBot, PERSONAS, SKILLS } from './bot.mjs';
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const id = +(process.argv[2] ?? 12), persona = PERSONAS[id % 5], skill = Object.keys(SKILLS)[Math.floor(id / 5) % 3], seed = 1000 + id * 7919;
installGlobals(); const rng = mulberry32(seed); Math.random = mulberry32(seed ^ 0x9e3779b9);
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?stall' + id); const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const sim = { t: 0, dt: 0.05 }, bot = makeBot(api, { persona, skill, rng, sim }), P = api.P; let next = 60;
while (sim.t < 600) {
  bot.beforeTick(0.05); api.clock.elapsedTime += 0.05; api.tick(0.05); api.camera.updateMatrixWorld(); globalThis.__SIM.clock.advance(50); bot.afterTick(); sim.t += 0.05;
  if (sim.t >= next) { next += 60; const q = Object.keys(api.QS).find(k => api.QS[k].state === 'active');
    console.log(`t=${sim.t.toFixed(0)} ${persona}/${skill} pos ${P.pos.x.toFixed(0)},${P.pos.z.toFixed(0)} mounted ${P.mounted} alive ${P.alive} dlg ${!!api.dlg} menu ${api.menu?.custom?.title || api.menu?.k || '-'} quest ${q}:${q && api.QS[q].stage} ${q ? api.objText(q) : ''} money ${P.money} creekLeft ${api.outlaws.filter(e => e.tag === 'creek' && !e.dead).map(e => `${e.pos.x.toFixed(0)},${e.pos.z.toFixed(0)}${e.alerted ? '!' : ''}`).join(' ')} keys ${Object.keys(api.K).filter(k => api.K[k]).join('+')}`); }
}
