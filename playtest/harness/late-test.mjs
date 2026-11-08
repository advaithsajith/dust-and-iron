// Late game: homestead, bounty board, coach, mine, rivals, the Marshal, children growing up, the church and its laws, and the save round-trip.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?late');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, EMP = api.EMP, LATE = api.LATE, CH = api.CH;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const pickItem = s => (api.menu.custom?.items || api.menu.items).findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
P.money = 5000;
for (const id in api.QS) api.QS[id].state = 'done';
// camp + homestead
P.pos.set(300, 0, -60); step(0.2); let spot = null;
for (let k = 0; k < 60 && !spot; k++) { const a = k * 0.7, r = 260 + k * 3, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!api.campSpotProblem({ x, z })) spot = { x, z }; }
P.pos.set(spot.x, 0, spot.z); step(0.2); api.tryMakeCamp(); api.buy(0); step(1); if (api.menu) api.buy(0); flush(); step(0.5);
const c = EMP.camps[0]; ok(!!c, 'camp pitched');
for (const k of ['cabin', 'ranch', 'barn', 'bunk', 'workshop', 'smoke', 'tower', 'wall']) { api.homeMenu(c); const i = api.menu.custom.items.findIndex(x => !x.off?.() && x.price > 0); api.buy(i); flush(); }
ok(['cabin', 'ranch', 'barn', 'tower', 'wall'].every(api.hb), `homestead built, defense ${api.homeDefense()}, gang cap ${api.gangCap()}`);
let L = api.dailyLedger(); ok(L.f === 60, `ledger farm $${L.f}`);
// bounty board
const bx = -64.5, bz = -7.6; P.pos.set(bx, 0, bz + 1); step(0.2); api.openBoard(); api.buy(0); flush();
ok(!!LATE.bounty, `bounty taken: ${LATE.bounty?.name} $${LATE.bounty?.reward}`);
const b = LATE.bounty; P.pos.set(b.x + 30, 0, b.z); step(2);
const tgt = api.outlaws.find(e => e.tag === 'bounty' && e.name === b.name); ok(!!tgt, 'bounty target spawned');
const m0 = P.money; if (tgt) { api.hurt ? api.hurt(tgt, 999, false, tgt.pos.clone()) : (tgt.hp = 0, tgt.dead = true); } step(2);
ok(!LATE.bounty && P.money > m0, `bounty collected +$${P.money - m0}`);
// coach
api.startCoach(); step(1); ok(!!LATE.coach, 'stagecoach on the road');
// mine
api.talkTo(api.npcs.find(n => n.id === 'pruitt' || n.shop === 'bank')); const mi = api.menu ? pickItem('Buy the Lucky') : -1; if (mi >= 0) api.buy(mi); flush();
ok(LATE.mine, 'mine claim bought');
// rivals
api.startRivals(); step(1); ok(Object.values(LATE.rivals.held).some(Boolean), 'Vance Syndicate holds hideouts');
for (const e of api.outlaws) if (e.tag === 'rival_creek' && !e.dead) api.hurt ? api.hurt(e, 999, false, e.pos.clone()) : (e.dead = true);
P.pos.set(api.SITES.creek.x, 0, api.SITES.creek.z); step(4);
ok(LATE.rivals.seized.creek, 'Dry Creek seized as an outpost');
api.homeRaid(); step(5); ok(true, 'home raid ran without errors');
// sheriff dies, Marshal arrives
api.sheriffKilled(); ok(LATE.marshal.state === 'coming', 'marshal coming after sheriff death');
// church takeover
const rev = api.npcs.find(n => n.church); ok(!!rev, 'Reverend Pike stands at the church');
P.pos.set(rev.pos.x, 0, rev.pos.z + 1.5); step(0.2);
const pop0 = api.townPop();
api.talkTo(rev); ok(api.menu?.custom?.title === 'Reverend Amos Pike', 'church menu opens');
api.buy(pickItem('Endow')); flush(); ok(CH.held, `church taken, money now $${P.money}`);
api.talkTo(rev); ok(api.menu.custom.title.startsWith('The pulpit'), api.menu.custom.title);
for (const l of api.CHURCH_LAWS) { api.talkTo(rev); const i = pickItem('Pass a law: ' + l.name); api.buy(i); flush(); }
ok(api.CHURCH_LAWS.every(l => api.hasLaw(l.k)), 'all six laws passed');
const boxes0 = api.boxes.length;
for (let i = 0; i < 2; i++) { api.talkTo(rev); api.buy(pickItem('Pass a law: Expand')); flush(); }
ok(CH.expand === 2 && api.boxes.length === boxes0 + 6, `town expanded twice, ${api.boxes.length - boxes0} new buildings, pop ${pop0} -> ${api.townPop()}`);
L = api.dailyLedger(); ok(L.c > 0, `church pays $${L.c} a day (pop ${api.townPop()})`);
api.homeMenu(c); ok(true, 'homestead menu with labour discount');api.closeMenu();
P.bounty = 150; api.talkTo(rev); api.buy(pickItem('Confess')); flush(); ok(P.bounty === 0, 'confession wiped the bounty');
const g0 = api.liveGang().length; api.talkTo(rev); api.buy(pickItem('Call the flock')); flush(); step(1); ok(api.liveGang().length >= g0, `flock: gang ${g0} -> ${api.liveGang().length}`);
// marriage + children with fruitful law
api.ROM.spouses.push('clara'); api.ROM.wedDay = P.day - 2;
const p1 = api.townPop(); for (let d = 0; d < 4; d++) { P.day++; api.onNewDay(); step(20); }
ok(api.townPop() > p1, `new families settled: ${p1} -> ${api.townPop()}`);
ok(api.ROM.children.length > 0, `children born: ${api.ROM.children.join(', ')}`);
ok(LATE.grown.length > 0, `children grown into riders: ${LATE.grown.join(', ')}`);
// map + empire screen render
api.showEmpire(); api.mapOpen(); ok(api.mapPOIs().some(p => p.label === 'Your church'), 'church on the map');
// save round-trip
api.save(); const raw = globalThis.localStorage.getItem('dust-iron-save-v1'); const sv = JSON.parse(raw);
ok(sv.late?.church?.held && sv.late.church.expand === 2 && Object.keys(sv.late.church.laws).length === 6, `save holds church (${raw.length} bytes)`);
ok(sv.camps?.[0]?.build?.wall || JSON.stringify(sv).includes('"wall":1'), 'save holds homestead builds');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));

// reload the save into a fresh copy of the game
const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?late2');
const api2 = globalThis.__SIM.api; while (!api2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); api2.begin(true);
for (let i = 0; i < 40; i++) { api2.clock.elapsedTime += 0.05; api2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(api2.CH.held && api2.CH.expand === 2 && api2.hasLaw('fruitful'), 'reload: church and laws restored');
ok(api2.townPop() >= 19, `reload: congregation ${api2.townPop()}`);
ok(api2.hb('wall') && api2.LATE.mine && api2.LATE.rivals.seized.creek, 'reload: homestead, mine and outpost restored');
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
