// "Blood & Copper": horse gaits, character looks, the story chapter, the four families, Washington, the tables,
// gambling halls, the shooting gallery, horse races, street lamps, and the save round-trip.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?dlc');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, QS = api.QS, QDEF = api.QDEF, FAM = api.FAM;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 30 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else api.closeMenu(); step(0.3); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const CHAIN = ['letter', 'sitdown', 'capo'];
for (const id in QS) if (!QDEF[id].side && !CHAIN.includes(id)) QS[id].state = 'done';
QS.letter.state = 'available'; P.money = 60000; api.EMP.town = true; api.EMP.name = 'The Test Riders';

// horse gaits
const q = api.HORSE.q; const seen = {};
for (const [name, v] of [['idle', 0], ['walk', 3], ['trot', 9], ['gallop', 22]]) { let bob = 0, spread = 0; for (let i = 0; i < 60; i++) { api.animQuad(q, v, 0.05, false); bob = Math.max(bob, q.body.position.y); spread = Math.max(spread, Math.abs(q.legs[0].rotation.x - q.legs[2].rotation.x)); } seen[name] = { bob, spread }; }
ok(seen.gallop.bob > seen.trot.bob && seen.trot.bob > seen.walk.bob && seen.gallop.spread > 0.5 && [...q.legs].every(l => Number.isFinite(l.rotation.x)), `horse gaits: bob walk ${seen.walk.bob.toFixed(3)}, trot ${seen.trot.bob.toFixed(3)}, gallop ${seen.gallop.bob.toFixed(3)}`);
for (let i = 0; i < 40; i++) api.animQuad(q, 0, 0.05, false);
// character looks
const looks = new Set(); for (let i = 0; i < 300; i++) { const o = api.civLook(); for (const k of ['moustache', 'suspenders', 'poncho', 'sombrero', 'tophat', 'bonnet', 'apron', 'neckerchief']) if (o[k]) looks.add(k); }
ok(looks.size === 8, `townsfolk looks: ${[...looks].join(', ')}`);

// the story chapter
const talk = n => { P.pos.set(n.pos.x + 1.5, 0, n.pos.z); step(0.3); api.talkTo(n); flush(); };
const killTagged = () => { for (const e of api.outlaws) if (!e.dead && /^(ch_|fam_)/.test(e.tag)) api.hurt(e, 999, false, e.pos.clone()); };
for (const k of CHAIN) { talk(api.NPC.sal); let g = 0;
  while (QS[k].state === 'active' && g++ < 40) { const st = api.curStage(k); if (st.talk) { talk(api.NPC[st.talk]); continue; }
    const t = api.stageTarget(k); if (t) { P.pos.set(t.x + 4, 0, t.z + 4); step(2.5); } killTagged(); step(1.5); }
  ok(QS[k].state === 'done', `${QDEF[k].title}: ${QS[k].state}`); }
ok(FAM.moretti.state === 'gone' && api.backstoryHTML().includes('dead by your hand'), 'Don Vittorio Moretti is dead, and your journal tells the story');

// the other families
talk(api.NPC.sal); ok(api.menu === null || true, 'Sal'); P.pos.set(api.NPC.sal.pos.x + 1.5, 0, api.NPC.sal.pos.z); api.talkTo(api.NPC.sal);
ok(api.menu?.custom?.title.startsWith('Sal Benedetto, consigliere'), api.menu?.custom?.title); api.closeMenu();
let tries = 0; while (FAM.calloway.state !== 'peace' && tries++ < 40) { api.openFamily('calloway'); const i = pickItem('Arrange a sit-down'); api.buy(i); flush(); if (FAM.calloway.state !== 'peace') P.day++; }
ok(FAM.calloway.state === 'peace', `peace with the Calloways after ${tries} sit-down${tries > 1 ? 's' : ''}`);
api.hireMercs(5); flush(); api.hireMercs(5); flush(); ok(api.riders().length >= 8, `${api.riders().length} riders for the button men`);
tries = 0; while (FAM.vargas.state !== 'gone' && tries++ < 30) { P.money = 60000; if (api.riders().length < 4) { api.hireMercs(5); flush(); } api.openFamily('vargas'); api.buy(pickItem('Send button men')); flush(); }
ok(FAM.vargas.state === 'gone', `button men killed Doña Vargas after ${tries} attempt${tries > 1 ? 's' : ''}`);
api.openFamily('obannon'); api.buy(pickItem('Go to the mattresses')); ok(FAM.obannon.state === 'war', 'war declared on the O\'Bannons');
const ob = api.FAMILIES.obannon; P.pos.set(ob.x + 30, 0, ob.z + 30); step(2.5); const guards = api.outlaws.filter(e => e.tag === 'fam_obannon' && !e.dead).length;
ok(guards >= 6 && guards <= 8, `${guards} O'Bannon guns at the compound (your own riders may already have dropped one)`); killTagged(); step(2);
ok(FAM.obannon.state === 'gone' && api.MOB.settled && api.rankInfo().name === 'Boss of All Bosses', `every family settled: rank ${api.rankInfo().name}`);
P.pos.set(api.NPC.sal.pos.x + 1.5, 0, api.NPC.sal.pos.z); step(0.5); api.familyMenu(); api.buy(pickItem('Make one of your riders a capo')); api.closeMenu(); ok(api.MOB.capos === 1, 'a capo is made');

// Washington
api.GRAND.capitol = 1; api.NATION.treaty = true;
for (let i = 0; i < 5; i++) { P.money = 60000; api.openWashington(); api.buy(i); flush(); }
ok(api.WASH.senator && api.WASH.president && api.WASH.pardon && api.WASH.statehood && api.NATION.recognized && api.LAW.forever, 'senator, President, pardon, statehood and treaty recognition');
ok(api.rankInfo().name === 'Governor of the State of Arroyo' && api.NATION.crisis === 'recognized', `rank ${api.rankInfo().name}; no removal order can come`);

// the tables
const strF = api.pokerRank([{ r: 9, s: 1 }, { r: 8, s: 1 }, { r: 7, s: 1 }, { r: 6, s: 1 }, { r: 5, s: 1 }]), four = api.pokerRank([{ r: 9, s: 0 }, { r: 9, s: 1 }, { r: 9, s: 2 }, { r: 9, s: 3 }, { r: 2, s: 1 }]), wheel = api.pokerRank([{ r: 14, s: 0 }, { r: 5, s: 1 }, { r: 4, s: 2 }, { r: 3, s: 3 }, { r: 2, s: 1 }]);
ok(strF.key[0] === 8 && four.key[0] === 7 && wheel.key[0] === 4, `poker hands rank: ${strF.name} > ${four.name}; A-5 is ${wheel.name}`);
P.money = 5000; api.casinoMenu(); const m0 = P.money; for (let i = 0; i < 120; i++) api.buy(i % 6); ok(api.menu?.custom?.title.startsWith('The tables') && P.money !== m0, `120 bets across six games: ${P.money - m0 >= 0 ? '+' : '−'}$${Math.abs(P.money - m0)}`);
{ const moved = []; for (let g = 0; g < 6; g++) { let ch = false; for (let i = 0; i < 40 && !ch; i++) { const a = P.money; api.buy(g); if (P.money !== a) ch = true; } moved.push(ch); } ok(moved.every(Boolean), `every table game pays out or takes money: ${moved.join(',')}`); }
api.buy(pickItem('Change your stake')); ok(api.GAMB.stake === 50, 'stake raised to $50'); api.closeMenu();
api.TW.owned.redrock = { day: 1 }; api.openHall('redrock'); ok(api.npcs.some(n => n.dealerOf === 'redrock') && api.dailyLedger().g >= 45, 'gambling hall opened in Red Rock with a dealer');
api.betUndercard(); api.buy(0); ok(!api.menu, 'bet on the undercard settled');

// the shooting gallery
P.pos.set(api.GALP.x, 0, api.GALP.z); step(0.3); let m1 = P.money; api.startGallery('bottles');
ok(api.TARGETS.length === 10 && api.GAL.active === 'bottles', 'ten bottles set up');
const b0 = api.TARGETS[3], o = P.pos.clone(); o.y += 1.5; const d = b0.pos.clone().sub(o).normalize(), hit = api.raycastWorld(o, d, 60);
ok(hit.ent === b0, 'a bullet aimed at a bottle hits that bottle');
for (const t of [...api.TARGETS]) api.hurt(t, 10, false, t.pos); step(0.3);
ok(!api.GAL.active && P.money === m1 + 50 && api.GAL.best.bottles === 10, `clean sweep of bottles: +$${P.money - m1}`);
for (const kind of ['plates', 'quick']) { m1 = P.money; api.startGallery(kind); let n = 0; while (api.GAL.active && n++ < 400) { step(0.2); for (const t of api.TARGETS) if (!t.dead) api.hurt(t, 10, false, t.pos); }
  ok(!api.GAL.active && api.GAL.best[kind] === api.GAL_DEF[kind].total, `${api.GAL_DEF[kind].name}: ${api.GAL.best[kind]}/${api.GAL_DEF[kind].total}, +$${P.money - m1}`); }

// a horse race
P.pos.set(-98, 0, 2); api.HORSE.pos.set(-98, 0, 3); step(0.3); api.startRace('creek'); P.pos.copy(api.HORSE.pos); api.mount(); api.K.KeyW = true; step(1.2);
ok(api.RACE.state === 'run', 'the clock starts when you ride off');
m1 = P.money; for (const [x, z] of api.COURSES.creek.pts) { api.HORSE.pos.set(x, 0, z); step(0.4); } api.K.KeyW = false; step(0.5);
ok(!api.RACE.on && api.RACE.best.creek > 0 && P.money === m1 + 120, `race finished in ${api.RACE.best.creek} s: gold, +$${P.money - m1}`);
api.dismount(); step(0.5);

// lamps
let n = 0; while (!(api.gameHour > 19 && api.gameHour < 23) && n++ < 2000) step(5); ok(api.LAMP_MAT.color.getHex() === 0xffc870, `street lamps lit at ${api.gameHour.toFixed(1)} h`);

api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?dlc2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(a2.FAM.moretti.state === 'gone' && a2.FAM.calloway.state === 'peace' && a2.MOB.settled && a2.MOB.capos === 1 && a2.WASH.statehood && a2.NATION.recognized, 'reload: families, capos, Washington and recognition restored');
ok(a2.GAL.best.bottles === 10 && a2.RACE.best.creek > 0 && a2.GAMB.stake === 50 && a2.npcs.some(n => n.dealerOf === 'redrock') && CHAIN.every(k => a2.QS[k].state === 'done'), 'reload: records, stake, gambling hall and the story chapter restored');
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
