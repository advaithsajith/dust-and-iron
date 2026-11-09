// Plays all eight side quests from offer to reward, the way a player would: ride to the target, fight, pick up, talk.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?sq');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, QS = api.QS, QDEF = api.QDEF;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 30 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else api.closeMenu(); step(0.3); } };
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const side = Object.keys(QDEF).filter(k => QDEF[k].side);
ok(side.length === 8 && side.every(k => QS[k].state === 'available'), `${side.length} side quests available: ${side.map(k => QDEF[k].title).join(', ')}`);
for (const k of side) {
  const giver = api.NPC[QDEF[k].giver]; P.pos.set(giver.pos.x + 1.5, 0, giver.pos.z); step(0.3);
  api.talkTo(giver); flush();
  if (QS[k].state !== 'active') { ok(false, `${QDEF[k].title}: did not start (${QS[k].state})`); continue; }
  const m0 = P.money; let guard = 0, log = [];
  while (QS[k].state === 'active' && guard++ < 40) {
    const st = api.curStage(k); log.push(api.objText(k).slice(0, 40));
    if (st.talk) { const n = api.NPC[st.talk]; P.pos.set(n.pos.x + 1.5, 0, n.pos.z); step(0.3); api.talkTo(n); flush(); continue; }
    if (k === 'ghosts' && api.curStage(k) === QDEF[k].stages[0]) { const s = api.SQ.spots.ghosts; P.pos.set(s.x + 5, 0, s.z + 5); while (!(api.gameHour >= 20 || api.gameHour < 4)) step(20); step(2); continue; }
    const t = api.stageTarget(k); if (t) { const near = st.on && st.on.pickup; P.pos.set(t.x + (near ? 1 : 3), 0, t.z + (near ? 0.5 : 3)); step(1.5); }
    // fight: finish whatever this stage asks for
    for (const e of api.outlaws) if (!e.dead && e.tag.startsWith('sq_')) api.hurt(e, 999, false, e.pos.clone());
    for (const a of api.animals) if (!a.dead && a.tag === 'sq_kids') { a.hp = 1; api.hurt(a, 999, false, a.pos.clone()); }
    step(1);
    const fi = api.findInteract(); if (fi && fi.label.startsWith('Pick up')) { fi.act(); step(0.5); }
  }
  ok(QS[k].state === 'done', `${QDEF[k].title}: ${QS[k].state} · +$${P.money - m0} · ${log.length} steps`);
  if (QS[k].state !== 'done') console.log('   stuck at:', log.slice(-3).join(' | '));
}
// reload mid-quest: a started quest resumes
api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?sq2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(side.every(k => a2.QS[k].state === 'done'), 'reload: all side quests stay done');
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
