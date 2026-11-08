// Checks courtship speed, marrying all three suitors, clan growth, and the one-step moonshine camp.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?family');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, ROM = api.ROM;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const choose = (n, s) => { api.talkTo(n); const i = api.menu.items.findIndex(x => x.label.startsWith(s) && !(x.off && x.off())); if (i >= 0) api.buy(i); if (api.menu && !api.menu.custom?.title?.startsWith('Name')) api.closeMenu(); flush(); return i >= 0; };
P.money = 1000;
for (const id of ['clara', 'mateo', 'june']) {
  const n = api.NPC[id]; P.pos.set(n.pos.x + 1.5, 0, n.pos.z); step(0.2);
  let actions = 0; P.gifts.flowers = 1; P.gifts.locket = 1; P.gifts.ring = 1;
  if (choose(n, 'Talk a while')) actions++; if (ROM.aff[id] < 100 && choose(n, 'Give a silver')) actions++; if (ROM.aff[id] < 100 && choose(n, 'Give wildflowers')) actions++;
  choose(n, 'Propose'); step(3); flush(); step(1);
  console.log(`${n.name}: 100 affection after ${actions} actions Â· married ${api.ROM.spouses.includes(id)}`);
}
const kin = api.liveGang().filter(a => a.kin).length;
console.log(`spouses ${ROM.spouses.length} Â· kin riders ${kin} Â· gang cap ${api.gangCap()} Â· rank ${api.rankInfo().name}`);
for (let d = 0; d < 4; d++) { P.day++; api.onNewDay(); step(15); }
console.log(`children after 4 days: ${ROM.children.length} (${ROM.children.join(', ')})`);
// one-step moonshine camp
P.pos.set(300, 0, -60); step(0.2); let spot = null;
for (let k = 0; k < 60 && !spot; k++) { const a = k * 0.7, r = 260 + k * 3, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!api.campSpotProblem({ x, z })) spot = { x, z }; }
P.pos.set(spot.x, 0, spot.z); step(0.2); const m0 = P.money; api.tryMakeCamp(); api.buy(0); flush(); step(0.5);
const c = api.EMP.camps[0]; console.log(`camp with still: still level ${c.still} Â· crates ready ${c.stock} Â· cost $${m0 - P.money}`);
step(60); console.log(`after 60 real seconds: ${c.stock} crates`);
P.pos.set(c.x + 1, 0, c.z + 1); api.openCampMenu(c); api.buy(api.menu.custom.items.findIndex(x => x.label.startsWith('Load moonshine'))); flush();
const lou = api.npcs.find(n => n.shop === 'saloon'); P.pos.set(lou.pos.x + 1.5, 0, lou.pos.z); const m1 = P.money; const cr = P.crates;
api.talkTo(lou); const si = api.menu.items.findIndex(x => x.label.startsWith('Sell moonshine')); api.buy(si); flush();
console.log(`sold ${cr} crates for $${P.money - m1}`);
api.talkTo(lou); const hi = api.menu.items.findIndex(x => x.label.startsWith('Ask Lou how')); api.buy(hi); console.log(`Lou explains: "${api.dlg && api.dlg.lines[1].slice(0, 70)}..." (${api.dlg && api.dlg.lines.length} lines)`); flush();
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 2));
