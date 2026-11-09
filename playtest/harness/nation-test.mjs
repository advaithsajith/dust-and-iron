// The Red Water People: the village, villagers who can't be harmed, trade, both side quests, the treaty,
// and all three answers to the removal order (defend, bribe, sign), each played from the same saved moment.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
let run = 0;
async function boot(saveText) {
  globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
  await import(buildGameModule() + '?nation' + (run++));
  const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5));
  if (saveText) { globalThis.localStorage.setItem('dust-iron-save-v1', saveText); api.begin(true); } else api.begin(false);
  return api;
}
let api = await boot(); let P = api.P;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 30 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else api.closeMenu(); step(0.3); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const N = api.NATION;
for (const id in api.QS) if (!api.QDEF[id].side) api.QS[id].state = 'done';
P.money = 5000;
const folk = api.npcs.filter(n => n.safe && !n.kid), kids = api.npcs.filter(n => n.safe && n.kid);
ok(folk.length >= 14 && kids.length === 4, `Red Water village at (${Math.round(N.x)},${Math.round(N.z)}): ${folk.length} people, ${kids.length} children, speaker ${api.NPC.kehala?.name}`);
// villagers can't be harmed
const v = folk.find(n => !n.important); api.hurt(v, 999, true, v.pos.clone()); ok(!v.dead && P.bounty === 0, 'villagers cannot be harmed by bullets');
// trade
const ena = api.npcs.find(n => n.shop === 'village'); P.pelts = 4; const m0 = P.money; api.talkTo(ena); api.buy(0); api.closeMenu(); ok(P.money - m0 >= 20, `sold 4 hides to Ena for $${P.money - m0}`);
// quest: Toshane's horses
const play = k => { let g = 0; const kehalaTalk = (n) => { P.pos.set(n.pos.x + 1.5, 0, n.pos.z); step(0.3); api.talkTo(n); flush(); };
  kehalaTalk(api.NPC[api.QDEF[k].giver]);
  while (api.QS[k].state === 'active' && g++ < 30) { const st = api.curStage(k); if (st.talk) { kehalaTalk(api.NPC[st.talk]); continue; }
    const t = api.stageTarget(k); if (t) { P.pos.set(t.x + 3, 0, t.z + 3); step(1.5); } for (const e of api.outlaws) if (!e.dead && e.tag === 'sq_hthief') api.hurt(e, 999, false, e.pos.clone()); step(1); }
  return api.QS[k].state; };
ok(play('rwhorses') === 'done' && N.rel >= 20, `Horses of the Red Water done · trust ${N.rel}`);
ok(play('rwfever') === 'done' && N.rel >= 45, `Fever in the Lodges done · trust ${N.rel}`);
// treaty
P.pos.set(api.NPC.kehala.pos.x + 1.5, 0, api.NPC.kehala.pos.z); step(0.2); api.talkTo(api.NPC.kehala); api.buy(pickItem('Make a treaty')); flush();
ok(N.treaty && api.dailyLedger().n === 25, `treaty signed: +$${api.dailyLedger().n} a day in trade`);
// the crisis arrives
P.day = Math.max(P.day, 3); api.crisisCheck(); ok(N.crisis === 'arrived' && api.NPC.pell, `${api.NPC.pell?.name} arrives with a removal order`);
api.save(); const atCrisis = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('errors so far:', globalThis.__SIM.errors.length);
// path 1: defend
P.pos.set(16, 0, 6); step(0.2); api.talkTo(api.NPC.pell); api.buy(pickItem('Tear up the order')); flush();
ok(N.crisis === 'army', 'the army sends soldiers to the village');
P.pos.set(N.x + 20, 0, N.z + 20); step(3); const troopers = api.outlaws.filter(e => e.tag === 'rw_army' && !e.dead); ok(troopers.length === 6 && troopers.every(e => e.alerted), `${troopers.length} soldiers attack`);
for (const e of troopers) api.hurt(e, 999, false, e.pos.clone()); step(2);
ok(N.crisis === 'defended' && !N.left, `valley defended · trust ${N.rel}`);
console.log('defend errors:', globalThis.__SIM.errors.length);
// path 2: bribe
api = await boot(atCrisis); P = api.P; step(1);
ok(api.NATION.crisis === 'arrived' && api.NPC.pell && api.npcs.includes(api.NPC.pell), 'reload at the crisis: Pell is waiting in town');
P.money = 5000; api.talkTo(api.NPC.pell); api.buy(items().findIndex(x => x.label.startsWith('Pay him'))); flush(); ok(api.NATION.crisis === 'bribe' && !api.NATION.left, 'bribed: the order is "lost"');
// path 3: sign
api = await boot(atCrisis); P = api.P; step(1);
const h0 = P.honor, m1 = P.money; api.talkTo(api.NPC.pell); api.buy(items().findIndex(x => x.label.startsWith('Sign the order'))); api.buy(0); flush();
ok(api.NATION.left && P.money === m1 + 1500 && P.honor <= h0 - 40, `signed: +$1,500, honor ${h0} -> ${P.honor}, the village is marched north`);
step(100); ok(!api.npcs.some(n => n.safe && !n.kid) || api.npcs.filter(n => n.safe).length === 0, 'the village stands empty');
ok(!api.holdings().some(h => h.n.includes('Red Water')), 'no treaty to hold any more');
api.save(); const after = globalThis.localStorage.getItem('dust-iron-save-v1');
api = await boot(after); step(1); ok(api.NATION.left && !api.npcs.some(n => n.safe && !n.kid), 'reload: the village stays empty');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
