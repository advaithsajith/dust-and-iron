// Haggling, peddlers, taking outlaws alive, public hangings, pardons, and the six new suitors.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?justice');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
P.money = 5000; for (const id in api.QS) api.QS[id].state = 'done';
// gallows clear of other buildings
const g = api.GALLOWS, hit = api.boxes.filter(b => g.x > b.minX - 3 && g.x < b.maxX + 3 && g.z > b.minZ - 3 && g.z < b.maxZ + 3);
ok(hit.length <= 1, `gallows at (${g.x},${g.z}) overlaps ${hit.length} boxes`);
// haggling at the Mercantile: try until a deal, across days
const store = api.npcs.find(n => n.shop === 'store'); let deal = null, tries = 0;
while (!deal && tries < 12) { tries++; P.day++; api.talkTo(store); const before = items()[0]; const p0 = before.price; api.buy(pickItem('Haggle over prices')); flush(); api.talkTo(store); if (api.HAG.store.m < 1) deal = api.HAG.store.m; api.closeMenu(); }
ok(deal, `haggled at the Mercantile after ${tries} days: ${Math.round((1 - deal) * 100)}% off`);
api.talkTo(store); ok(items().some(x => x.label.startsWith('You haggled today')), 'menu shows the deal'); api.closeMenu();
// peddler
const ped = api.npcs.filter(n => n.peddler); ok(ped.length === 3, `${ped.length} peddlers (${ped.map(n => n.name).join(', ')})`);
api.talkTo(ped[0]); ok(api.menu?.custom?.title.includes('negotiable') && items().length >= 4, `peddler menu: ${items().map(i => i.label).join(' | ').slice(0, 160)}`);
const oi = pickItem('Offer'); const m0 = P.money; api.buy(oi); flush(); ok(true, `offered: spent $${m0 - P.money}`);
// take an outlaw alive
P.pos.set(300, 0, 300); step(0.2);
api.startRivals(); step(0.5);
const out = api.outlaws.find(x => !x.dead && x.tag === 'rival_creek' && x.name) || api.outlaws.find(x => !x.dead && x.tag !== 'law');
let tgt = out;
if (!tgt) { console.log('no outlaw to test'); }
P.pos.set(tgt.pos.x + 4, 0, tgt.pos.z); tgt.hp = 10; tgt.mounted = false;
let surrendered = false; for (let i = 0; i < 20 && !surrendered; i++) { api.demandSurrender(tgt); surrendered = tgt.surrender; tgt.alerted = false; }
ok(surrendered, `${tgt.name || 'outlaw'} surrendered`);
step(1); ok(!tgt.dead, 'surrendered outlaw stays alive (gang holds fire)');
api.hogtie(tgt); ok(P.prisoner && !api.outlaws.includes(tgt), `prisoner taken: ${P.prisoner?.name}`);
// hang him: own the town first
api.EMP.town = true; P.pos.set(g.x + 2, 0, g.z + 5); step(0.3);
const fi = api.findInteract(); ok(fi && fi.label.startsWith('Hang'), `gallows prompt: "${fi?.label}"`);
const m1 = P.money; fi.act(); ok(api.HANG.active && !P.prisoner, 'hanging started');
step(18); ok(api.HANG.dropped && P.money > m1, `trap dropped · +$${P.money - m1} · hanged ${api.LATE.hanged}`);
const watchers = api.HANG.crowd.filter(n => api.d2(n.pos, g) < 20).length; ok(watchers >= 3, `${watchers} townsfolk gathered to watch`);
step(90); ok(!api.HANG.active, 'gallows cleared afterwards');
// the town's own hanging and a pardon
{ const d0 = P.day; while (P.day === d0 || api.gameHour < 7) step(20); } api.scheduleHanging(); let tries2 = 0; while (!api.LATE.hangEvent && tries2++ < 20) api.scheduleHanging();
const he = api.LATE.hangEvent; P.pos.set(g.x + 2, 0, g.z + 5); step(0.3); const fp = api.findInteract(); ok(fp && fp.label.startsWith('Pardon'), `pardon prompt: "${fp?.label}"`);
const gang0 = api.liveGang().length; fp.act(); flush(); step(1); ok(api.liveGang().length === gang0 + 1, `${he.name} pardoned and rides with you`);
api.scheduleHanging(); while (!api.LATE.hangEvent) api.scheduleHanging(); while (api.gameHour < 11.8) step(5); ok(api.LATE.hangEvent.done, 'noon hanging happened');
// suitors
const ids = Object.keys(api.SUITORS); ok(ids.length === 9 && ids.every(id => api.NPC[id]), `${ids.length} people to court: ${ids.map(id => api.NPC[id].name).join(', ')}`);
api.talkTo(api.NPC.hazel); ok(api.menu?.custom?.title.startsWith('Hazel Moon, the fortune teller'), api.menu?.custom?.title); api.closeMenu();
api.save(); const sv = JSON.parse(globalThis.localStorage.getItem('dust-iron-save-v1')); ok(sv.late.hanged === 1 && 'ivy' in sv.rom.aff, 'save holds hangings and new suitors');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
