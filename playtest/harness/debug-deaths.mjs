// Replays one pilot session and prints the circumstances of its first deaths.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
import { makeBot } from './bot.mjs';
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const [persona = 'storyteller', skill = 'novice', seed = 1000] = process.argv.slice(2);
installGlobals(); const rng = mulberry32(+seed); Math.random = mulberry32(+seed ^ 0x9e3779b9);
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?dbg'); const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const sim = { t: 0, dt: 0.05 }, bot = makeBot(api, { persona, skill, rng, sim }), P = api.P;
let alive = true, deaths = 0, hp = P.hp, lastHits = [];
while (sim.t < 900 && deaths < 4) {
  bot.beforeTick(0.05); api.clock.elapsedTime += 0.05; api.tick(0.05); api.camera.updateMatrixWorld(); globalThis.__SIM.clock.advance(50); bot.afterTick(); sim.t += 0.05;
  if (P.hp < hp - 0.5) lastHits.push(`${sim.t.toFixed(1)}s -${(hp - P.hp).toFixed(0)}`); hp = P.hp; if (lastHits.length > 6) lastHits.shift();
  if (alive && !P.alive) { deaths++;
    const near = api.outlaws.filter(e => !e.dead && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 90).map(e => `${e.tag}:${Math.round(Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z))}m${e.alerted ? '!' : ''}`);
    const wolves = api.animals.filter(a => a.kind === 'wolf' && !a.dead && Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) < 60).length;
    console.log(`death ${deaths} at t=${sim.t.toFixed(1)} pos ${P.pos.x.toFixed(0)},${P.pos.z.toFixed(0)} quest ${api.tracked}:${api.QS[api.tracked]?.stage} wanted ${api.WANTED.active} near [${near}] wolves ${wolves} hits ${lastHits.join(' ')}`); }
  alive = P.alive;
}
console.log('t', sim.t.toFixed(0), 'deaths', deaths, 'kills', P.stats.kills, 'pos', P.pos.x.toFixed(0), P.pos.z.toFixed(0), 'ammo', api.WEAPONS.map(w => w.ammo + '/' + w.reserve).join(' '));
