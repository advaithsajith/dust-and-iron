// Bandit hideouts (spawn, clear, loot, respawn), road encounters and bounty hunters, and town duels.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?combat');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const killTag = t => { for (const e of api.outlaws) if (!e.dead && e.tag === t) api.hurt(e, 999, false, e.pos.clone()); };
for (const id in api.QS) api.QS[id].state = 'done';
// hideouts
ok(api.HIDEOUTS.every(h => h.x !== undefined), 'hideouts: ' + api.HIDEOUTS.map(h => `${h.name} (${Math.round(h.x)},${Math.round(h.z)})`).join(' · '));
const h = api.HIDEOUTS[0], tag = 'hid_' + h.k; P.pos.set(h.x + 150, 0, h.z); step(2);
const n = api.outlaws.filter(e => e.tag === tag && !e.dead).length; ok(n === h.n + 1, `${h.name}: ${n} of ${h.gang} spawned when you rode near (boss ${h.boss})`);
const m0 = P.money; killTag(tag); step(2); ok(P.money > m0 && api.HID[h.k].cleared === P.day, `cleared · +$${P.money - m0} stash`);
P.pos.set(h.x + 150, 0, h.z + 10); step(2); ok(!api.outlaws.some(e => e.tag === tag && !e.dead), 'stays empty the same day');
P.pos.set(0, 0, 0); step(2); P.day += 2; api.onNewDay(); P.pos.set(h.x + 150, 0, h.z); step(2);
ok(api.outlaws.filter(e => e.tag === tag && !e.dead).length === h.n + 1, 'a new gang moved in two days later');
P.pos.set(0, 0, 0); step(3); ok(!api.outlaws.some(e => e.tag === tag && !e.dead), 'gang despawns when you ride far away');
// road encounters: ride the open desert
P.pos.set(250, 0, 280); P.yaw = 0; api.ENC.t = 0; step(2);
ok(api.ENC.active && api.outlaws.some(e => e.tag === 'enc' && !e.dead), `road encounter: ${api.outlaws.filter(e => e.tag === 'enc' && !e.dead).map(e => e.name).join(', ')}`);
killTag('enc'); step(2); ok(!api.ENC.active, 'encounter over after the fight');
P.bounty = 400; let hunters = false; for (let i = 0; i < 12 && !hunters; i++) { api.ENC.t = 0; step(1.2); hunters = api.outlaws.some(e => e.tag === 'enc' && e.name === 'Bounty hunter' && !e.dead); if (!hunters) { killTag('enc'); step(1.5); } }
ok(hunters, 'bounty hunters come after a $400 bounty'); killTag('enc'); step(2); P.bounty = 0;
// duel in town
P.pos.set(0, 0, 2); P.mounted = false; api.DUEL.t = 0; step(1.2); const d = api.DUEL.on;
ok(d && !d.alerted, `duel: ${d?.name} calls you out and waits`);
step(2); ok(d && !d.alerted, 'still waiting during the count');
step(4); ok(d && d.alerted, 'he draws at five');
const b0 = P.bounty, m1 = P.money; api.hurt(d, 999, false, d.pos.clone()); step(2);
ok(!api.DUEL.on && P.money > m1 && P.bounty === b0, `duel won: +$${P.money - m1}, no bounty for a fair fight`);
api.save(); const sv = JSON.parse(globalThis.localStorage.getItem('dust-iron-save-v1'));
ok(sv.late.hid && sv.late.hid[h.k] && sv.late.fights.d === 1, 'save holds hideouts and fight tallies');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
