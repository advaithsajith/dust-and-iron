// Land deeds, every business type, kids that bullets pass, more camps, territory control, and the save round-trip.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?land');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, LAND = api.LAND;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
P.money = 20000;
ok(LAND.plots.length === 8, 'plots: ' + LAND.plots.map(p => `${p.name} (${Math.round(p.x)},${Math.round(p.z)}) $${p.price}`).join(' Â· '));
const near = []; for (const p of LAND.plots) for (const b of api.boxes) if (p.x > b.minX - 20 && p.x < b.maxX + 20 && p.z > b.minZ - 20 && p.z < b.maxZ + 20) near.push(p.name);
ok(near.length === 0, 'no plot overlaps existing buildings ' + near.join(','));
const kids = api.npcs.filter(n => n.kid && !n.townOf), adults = api.npcs.filter(n => !n.important && !n.kid && !n.area && !n.peddler);
ok(kids.length === 6 && adults.length >= 16, `town has ${adults.length} pedestrians and ${kids.length} children`);
// shoot at a kid: no harm, no crime
const k = kids[0]; api.hurt(k, 999, false, k.pos.clone()); ok(!k.dead && P.bounty === 0, 'children cannot be harmed');
// bank land office
const bank = api.npcs.find(n => n.shop === 'bank'); api.talkTo(bank); api.buy(pickItem('Land office')); ok(api.menu?.custom?.title.startsWith('Land office'), api.menu?.custom?.title);
api.closeMenu();
P.pos.set(LAND.plots[0].x + 1, 0, LAND.plots[0].z + 1); step(0.3); const fi = api.findInteract(); ok(fi && fi.label.startsWith('Land for sale'), `stake prompt: "${fi?.label}"`);
const types = Object.keys(api.LAND_TYPES); const boxes0 = api.boxes.length, n0 = api.npcs.length;
LAND.plots.forEach((p, i) => { api.talkTo(bank); api.buy(pickItem('Land office')); api.buy(i); flush();
  api.landMenu(p); const t = types[i % types.length]; api.buy(items().findIndex(x => x.label.startsWith(api.LAND_TYPES[t].name))); flush(); });
ok(Object.values(LAND.owned).every(o => o.type), 'all 8 plots bought and built: ' + LAND.plots.map(p => api.plotOf(p).type).join(','));
ok(api.boxes.length > boxes0 && api.npcs.length > n0, `+${api.boxes.length - boxes0} colliders, +${api.npcs.length - n0} people (madams, preachers, workers, kids)`);
const parlor = LAND.plots.find(p => api.plotOf(p).type === 'parlor'); const madam = api.npcs.find(n => n.landBoss === parlor);
api.talkTo(madam); ok(api.menu?.custom?.title.includes('Parlor house'), `madam ${madam?.name} opens: ${api.menu?.custom?.title}`);
api.buy(pickItem('Expand to level 2')); flush(); ok(api.plotOf(parlor).level === 2, 'parlor house expanded');
const L = api.dailyLedger(); ok(L.l > 300, `land pays $${L.l} a day Â· gang cap ${api.gangCap()}`);
// control
const miss = api.holdings().filter(h => !h.h).map(h => h.n); ok(true, `control ${Math.round(api.territoryControl() * 100)}%, missing: ${miss.join(', ')}`);
api.EMP.town = true; api.CH.held = true; api.LATE.mine = true; api.LATE.rivals.seized.creek = true; api.LATE.rivals.seized.hollow = true; for (const k in api.TOWNS) api.TW.owned[k] = { day: 1 };
step(3); ok(api.territoryControl() === 1 && api.rankInfo().name === 'Lord of the Arroyo', `full control: ${api.rankInfo().name}`);
// workers stay on their land
step(30); const strays = api.npcs.filter(n => n.area && Math.hypot(n.pos.x - n.area.x, n.pos.z - n.area.z) > n.area.r + 8);
ok(strays.length === 0, `plot folk stay home (${strays.length} strays${strays.map(n => ' ' + n.name + ' ' + Math.round(Math.hypot(n.pos.x - n.area.x, n.pos.z - n.area.z)) + '/' + n.area.r + (n.townOf ? ' town ' + n.townOf : '') + (n.peddler ? ' peddler' : '')).join(',')})`);
// camps: six allowed
ok(/>=6/.test(api.tryMakeCamp.toString()), 'camp cap is six');
api.showEmpire(); api.mapOpen(); ok(api.mapPOIs().filter(p => p.label.includes('(')).length >= 8, 'plots on the map');
api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
// reload
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?land2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(Object.values(a2.LAND.owned).filter(o => o.type).length === 8 && a2.plotOf(a2.LAND.plots.find(p => p.name === parlor.name)).level === 2, 'reload: all land and levels restored');
ok(a2.npcs.filter(n => n.landBoss).length >= 2 && a2.rankInfo().name === 'Lord of the Arroyo', `reload: ${a2.npcs.filter(n => n.area).length} plot folk, rank ${a2.rankInfo().name}`);
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
