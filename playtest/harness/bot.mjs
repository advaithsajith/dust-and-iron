// Scripted playtesters. Each bot plays the real game through the same inputs a person uses (movement keys, camera
// angles, the trigger, the E-key interactions and menus) and a persona decides what it wants to do next.
// Telemetry is sampled from game state once per simulated second.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const PERSONAS = ['storyteller', 'outlaw', 'empire', 'explorer', 'settler'];
export const SKILLS = { novice: 0.045, average: 0.025, expert: 0.012 };

export function makeBot(api, { persona, skill, rng, sim }) {
  const P = api.P, K = api.K, mouse = api.mouse, cam = api.cam;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  const pick = a => a[Math.floor(rng() * a.length)];
  const T = () => sim.t;

  const ev = []; const log = (type, detail = {}) => ev.push({ t: +T().toFixed(1), type, ...detail });
  const time = {}; let goal = null, decideT = 0, dlgT = 0, aimNoise = { y: 0, p: 0 }, lastDay = P.day, chatDayDone = {};
  const prog = { at: { x: P.pos.x, z: P.pos.z }, t: 0, wanted: false }; let recoverT = 0, recoverDir = 1, stuck = 0, detour = null;
  // like a person, a bot that keeps dying on the same objective goes and does something else for a while
  const deathsAt = {}, avoidUntil = {}; let wasAlive = true, retreat = null, softT = 0, softLogged = false;
  const objKey = () => { const id = Object.keys(api.QS).find(q => api.QS[q].state === 'active'); return id ? `${id}:${api.QS[id].stage}` : 'free'; };
  const ammoLeft = () => api.WEAPONS.reduce((s, w) => s + (w.owned ? w.ammo + w.reserve : 0), 0);
  const suitor = pick(['clara', 'mateo', 'june']);
  let travelled = 0, lastPos = { x: P.pos.x, z: P.pos.z }, mountedTime = 0;

  // ---------- low-level control ----------
  function clearInputs() { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) K[k] = false; mouse.right = false; mouse.left = false; }
  function aimAt(p, y = 1.25) {
    const c = api.camera.position, dx = p.x - c.x, dy = (p.y ?? api.groundY(p.x, p.z)) + y - c.y, dz = p.z - c.z;
    cam.yaw = Math.atan2(-dx, -dz) + aimNoise.y; cam.pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)) + aimNoise.p, -1, 1.25);
  }
  function reroll() { const s = SKILLS[skill]; aimNoise = { y: gauss() * s, p: gauss() * s * 0.6 }; }
  function whistle() {
    const H = api.HORSE;
    if (dist(H.pos, P.pos) > 300) { const a = rng() * TAU; H.pos.set(P.pos.x + Math.sin(a) * 60, 0, P.pos.z + Math.cos(a) * 60); }
    H.called = true;
  }
  // returns true once within `arrive` metres
  function moveTo(x, z, o = {}) {
    const arrive = o.arrive ?? 2.5, careful = !!o.careful, H = api.HORSE, d = dist(P.pos, { x, z });
    sim.wantMove = true;
    if (d < arrive) { sim.wantMove = false; if (P.mounted && H.speed > 0.5) K.KeyS = true; return true; }
    if (recoverT > 0) {  // stuck: back off and swing round
      recoverT -= sim.dt; if (P.mounted) { K.KeyS = true; K[recoverDir > 0 ? 'KeyA' : 'KeyD'] = true; } else { K.KeyW = true; K[recoverDir > 0 ? 'KeyA' : 'KeyD'] = true; K.Space = true; }
      return false;
    }
    if (detour) { if (sim.t > detour.until || dist(P.pos, detour) < 6) detour = null; else { x = detour.x; z = detour.z; } }
    if (!P.mounted && d > 70 && !careful && !o.foot) {
      const hd = dist(H.pos, P.pos);
      if (hd < 3.2) { api.mount(); return false; }
      if (hd > 45) whistle();
      if (hd < 90) { steerFoot(H.pos.x, H.pos.z, hd > 20); return false; }
    }
    if (P.mounted && (d < (o.dismountAt ?? 10) || careful)) {
      if (H.speed > 5.5) { K.KeyS = true; return false; }
      api.dismount(); return false;
    }
    if (P.mounted) {
      const bearing = Math.atan2(x - P.pos.x, z - P.pos.z), diff = api.angDiff(H.yaw, bearing);
      K.KeyA = diff > 0.1; K.KeyD = diff < -0.1; K.KeyW = Math.abs(diff) < 1.7; K.ShiftLeft = d > 60 && H.stamina > 25 && Math.abs(diff) < 0.6;
    } else steerFoot(x, z, d > 15 && !careful && P.stamina > 20);
    return false;
  }
  function steerFoot(x, z, run) { cam.yaw = Math.atan2(-(x - P.pos.x), -(z - P.pos.z)); cam.pitch = 0.2; K.KeyW = true; K.ShiftLeft = run; }
  function trackStuck() {
    if (!sim.wantMove || !P.alive || api.dlg || api.menu) { prog.t = 0; prog.at = { x: P.pos.x, z: P.pos.z }; return; }
    prog.t += sim.dt;
    if (prog.t > 4) { const moved = dist(P.pos, prog.at); if (moved < 1.2) { stuck++; log('stuck', { mounted: P.mounted, x: Math.round(P.pos.x), z: Math.round(P.pos.z) }); recoverT = 1.4; recoverDir = rng() < 0.5 ? 1 : -1;
        // steer round the obstacle: a point 45 m off to one side, held for up to 8 s
        const a = P.yaw + recoverDir * Math.PI / 2; detour = { x: P.pos.x + Math.sin(a) * 45, z: P.pos.z + Math.cos(a) * 45, until: sim.t + 8 }; }
      prog.t = 0; prog.at = { x: P.pos.x, z: P.pos.z }; }
  }
  const talk = n => { if (!n || n.dead || n.koT > 0) return 'fail'; if (!moveTo(n.pos.x, n.pos.z, { arrive: 2.6 })) return 'running'; api.talkTo(n); return 'done'; };
  // Picks a menu item; true only if it went through (a paid item actually took the money).
  function menuPick(pred) { const m = api.menu; if (!m) return false; const i = m.items.findIndex(it => pred(it) && !(it.off && it.off())); if (i < 0) { api.closeMenu(); return false; }
    const it = m.items[i], m0 = P.money; api.buy(i); if (api.menu) api.closeMenu(); return !(it.price > 0 && !it.sell) || P.money < m0; }
  // shop prices follow the player's honor (notorious +30 %, respected −15 %), so plan with the real price
  const price = base => Math.round(base * (P.honor < -40 ? 1.3 : P.honor > 40 ? 0.85 : 1));
  const shopNpc = k => api.npcs.find(n => n.shop === k && !n.dead && !(n.koT > 0));
  function shop(k, pred, tag) { const n = shopNpc(k); if (!n) return 'fail'; if (!moveTo(n.pos.x, n.pos.z, { arrive: 2.6 })) return 'running';
    const m0 = P.money; api.talkTo(n); const ok = menuPick(pred); if (ok) log('purchase', { what: tag, cost: m0 - P.money }); return ok ? 'done' : 'fail'; }

  // ---------- threats & combat ----------
  function hostiles(r = 50) {
    const out = [];
    for (const e of api.outlaws) { if (e.dead) continue; const law = e.tag === 'law'; if (law ? !api.WANTED.active : !e.alerted) continue; const d = dist(e.pos, P.pos); if (d < r) out.push({ e, d }); }
    for (const a of api.animals) if (a.kind === 'wolf' && !a.dead && a.alerted) { const d = dist(a.pos, P.pos); if (d < r) out.push({ e: a, d }); }
    return out.sort((a, b) => a.d - b.d);
  }
  let shotGap = 0;
  function fight(list) {
    const { e, d } = list[0];
    if (P.mounted && d < 45) { if (api.HORSE.speed > 5.5) K.KeyS = true; else api.dismount(); return; }
    if (d > 38) { moveTo(e.pos.x, e.pos.z, { arrive: 30, foot: true }); return; }
    // expert players use Focus against a crowd
    if (skill === 'expert' && list.length >= 3 && P.focus > 40 && !api.focusOn && api.WEAPONS[P.weapon].ammo >= 3) { api.setFocus(true); sim.focusMarks = 0; }
    mouse.right = true; const y = e.q ? 1.4 * e.q.s : e.mounted ? 2.3 : 1.25; aimAt(e.pos, y);
    sim.pendingFire = { e };
  }
  function afterTick() {  // actions that need the camera updated by this tick
    if (api.focusOn && !api.FOCUS.firing) {
      const list = hostiles(60); const w = api.WEAPONS[P.weapon];
      if (list.length && api.FOCUS.marks.length < Math.min(w.ammo, list.length)) { api.focusMark(); }
      else api.focusRelease();
      return;
    }
    if (sim.pendingFire && P.fireCd <= 0) {
      const w = api.WEAPONS[P.weapon];
      if (w.ammo > 0) { api.fire(); reroll(); } else if (w.reserve > 0) api.startReload();
      else if (api.WEAPONS.some((x, i) => x.owned && (x.ammo || x.reserve) && i !== P.weapon)) { P.weapon = api.WEAPONS.findIndex(x => x.owned && (x.ammo || x.reserve)); }
    }
    sim.pendingFire = null;
    if (sim.afterAct) { const f = sim.afterAct; sim.afterAct = null; f(); }
  }

  // ---------- goals ----------
  const G = {
    talkTo: g => talk(g.npc),
    goto: g => (moveTo(g.x, g.z, { arrive: g.arrive ?? 12 }) ? 'done' : 'running'),
    clear: g => { const tgt = g.at(); if (!tgt) return 'done';
      if (!moveTo(tgt.x, tgt.z, { arrive: 25 })) return 'running';
      // an outlaw who hasn't noticed you still has to go: walk up and take the shot
      const id = activeQuest(), tag = id && { creek: 'creek', coach: 'ambush', hollow: 'hollow', howls: 'ridge' }[id];
      const left = api.outlaws.filter(e => !e.dead && e.tag === tag).concat(api.animals.filter(a => !a.dead && a.tag === tag));
      if (!left.length) return 'done';
      const e = left.sort((a, b) => dist(a.pos, P.pos) - dist(b.pos, P.pos))[0];
      fight([{ e, d: dist(e.pos, P.pos) }]); return 'running'; },
    loot: g => { const e = g.e; if (e.looted) return 'done'; if (!moveTo(e.pos.x, e.pos.z, { arrive: 1.8, foot: true })) return 'running';
      const it = api.findInteract(); if (it && it.label === 'Loot body') { const m0 = P.money; it.act(); log('loot', { gain: P.money - m0 }); return 'done'; } return 'running'; },
    pickup: g => { const p = api.pickups[0]; if (!p.active) return 'done'; if (!moveTo(p.pos.x, p.pos.z, { arrive: 1.8 })) return 'running'; const it = api.findInteract(); if (it && it.label.startsWith('Pick up')) { it.act(); return 'done'; } return 'running'; },
    hunt: g => {
      const dead = api.animals.find(a => a.kind === 'deer' && a.dead && !a.skinned && dist(a.pos, P.pos) < 120);
      if (dead) { if (!moveTo(dead.pos.x, dead.pos.z, { arrive: 2, careful: dist(dead.pos, P.pos) < 60 })) return 'running';
        const it = api.findInteract(); if (it && it.label === 'Skin deer') { it.act(); log('skin'); g.n = (g.n || 0) + 1; } return g.n >= (g.want || 2) ? 'done' : 'running'; }
      let best = null, bd = 1e9; for (const a of api.animals) if (a.kind === 'deer' && !a.dead) { const d = dist(a.pos, P.pos); if (d < bd) { bd = d; best = a; } }
      if (!best) return 'fail';
      if (bd > 28) { moveTo(best.pos.x, best.pos.z, { arrive: 26, careful: bd < 80, dismountAt: 80 }); return 'running'; }
      if (P.mounted) { if (api.HORSE.speed > 5) K.KeyS = true; else api.dismount(); return 'running'; }
      mouse.right = true; aimAt(best.pos, 1.4 * best.q.s); sim.pendingFire = { e: best }; return 'running';
    },
    rob: g => {
      const n = g.npc; if (!n || n.dead || n.koT > 0) return 'fail';
      if (!moveTo(n.pos.x, n.pos.z, { arrive: 6 })) return 'running';
      mouse.right = true; aimAt(n.pos, 1.2); g.held = (g.held || 0) + sim.dt;
      if (g.held > 0.4) sim.afterAct = () => { const it = api.findInteract(); if (it && /^Rob|^Seize/.test(it.label)) { const m0 = P.money; it.act(); log(it.label.startsWith('Seize') ? 'raid_start' : 'robbery', { target: n.id || n.shop || 'civilian', gain: P.money - m0 }); g.done = true; } };
      return g.done ? 'done' : g.held > 3 ? 'fail' : 'running';
    },
    stealHorse: g => { const h = api.horses.find(h => !h.owned); if (!h) return 'fail'; if (!moveTo(h.pos.x, h.pos.z, { arrive: 2.2 })) return 'running'; if (api.mount()) { log('horse_theft'); return 'done'; } return 'running'; },
    punch: g => { const n = g.npc; if (!n || n.dead || n.koT > 0) return 'fail'; if (!moveTo(n.pos.x, n.pos.z, { arrive: 1.3, foot: true })) return 'running';
      cam.yaw = Math.atan2(-(n.pos.x - P.pos.x), -(n.pos.z - P.pos.z)); P.punchT = 0; api.punch(); g.n = (g.n || 0) + 1; return g.n > 3 ? 'done' : 'running'; },
    flee: g => { if (!api.WANTED.active) return 'done'; return moveTo(g.x, g.z, { arrive: 20 }) ? 'done' : 'running'; },
    shop: g => shop(g.k, g.pred, g.tag),
    makeCamp: g => {
      if (api.EMP.camps.length > g.had) { log('camp'); return 'done'; }
      if (P.money < 50) return 'fail';
      if (!moveTo(g.x, g.z, { arrive: 3 })) return 'running';
      if (P.mounted) { api.dismount(); return 'running'; }
      if (api.campSpotProblem(P.pos)) return 'fail';
      if (!api.menu) api.tryMakeCamp(); return 'running';
    },
    campMenu: g => { const c = g.camp; if (!moveTo(c.x, c.z, { arrive: 4.5 })) return 'running'; api.openCampMenu(c); const m0 = P.money, ok = menuPick(g.pred); if (ok) log(g.tag, { cost: m0 - P.money }); return ok ? 'done' : 'fail'; },
    raid: g => { if (!api.RAID.active) return api.EMP.town ? 'done' : g.started ? 'fail' : G.rob(g); g.started = true; moveTo(0, 0, { arrive: 25 }); return 'running'; },
    court: g => { const n = api.NPC[suitor]; if (!moveTo(n.pos.x, n.pos.z, { arrive: 2.6 })) return 'running'; api.talkTo(n); const ok = menuPick(it => g.pick(it.label)); if (ok) log('court', { act: g.tag, aff: Math.round(api.ROM.aff[suitor]) }); return ok ? 'done' : 'fail'; },
    explore: g => moveTo(g.x, g.z, { arrive: 30 }) ? 'done' : 'running',
    payBounty: g => shop('telegraph', it => it.label.startsWith('Pay off'), 'bounty_paid'),
    travel: g => { api.fastTravel(g.poi); log('fast_travel', { to: g.poi.label }); return 'done'; },
    solicit: g => { const n = g.npc; if (!n || n.dead) return 'fail'; if (!moveTo(n.pos.x, n.pos.z, { arrive: 2.6 })) return 'running'; api.talkTo(n);
      const before = api.liveGang().length; menuPick(it => it.label.startsWith('Talk them into')); if (api.liveGang().length > before) log('solicit_success'); else log('solicit_fail'); return 'done'; },
    wait: g => (g.until < T() ? 'done' : 'running'),
  };

  // ---------- persona planners ----------
  const activeQuest = () => Object.keys(api.QS).find(id => api.QS[id].state === 'active');
  const availQuest = () => Object.keys(api.QS).find(id => api.QS[id].state === 'available');
  function questGoal() {
    const id = activeQuest();
    if (id && avoidUntil[`${id}:${api.QS[id].stage}`] > T()) return null;
    if (id) { const st = api.curStage(id);
      // get ammo and a tonic before riding into a fight
      const fightAhead = st.on?.kill || (st.reach && ['creek', 'hollow', 'ridge', 'wreck'].includes(st.reach));
      if (fightAhead && ammoLeft() < 30) { if (P.money >= price(4)) return { kind: 'shop', k: 'store', pred: it => it.label.startsWith('Revolver cartridges'), tag: 'ammo', cat: 'shopping' }; return { kind: 'hunt', want: 2, cat: 'hunting' }; }
      if (fightAhead && P.tonics < 1 && P.money >= price(10)) return { kind: 'shop', k: 'store', pred: it => it.label === 'Health tonic', tag: 'tonic', cat: 'shopping' };
      if (st.talk) return { kind: 'talkTo', npc: api.NPC[st.talk], cat: 'story' };
      if (st.reach) { const s = api.SITES[st.reach]; return { kind: 'goto', x: s.x, z: s.z, arrive: s.r, cat: 'story' }; }
      if (st.on?.skin) return { kind: 'hunt', want: 3, cat: 'hunting' };
      if (st.on?.pickup) return { kind: 'pickup', cat: 'story' };
      if (st.on?.kill) return { kind: 'clear', at: () => api.stageTarget(id), cat: 'story' };
    }
    const av = availQuest(); if (av) return { kind: 'talkTo', npc: api.NPC[api.QDEF[av].giver], cat: 'story' };
    return null;
  }
  function supplies() {
    const w0 = api.WEAPONS[0];
    if (w0.reserve < 18 && P.money >= price(8)) return { kind: 'shop', k: 'store', pred: it => it.label.startsWith('Revolver cartridges'), tag: 'ammo', cat: 'shopping' };
    if (P.tonics < 1 && P.money >= price(20)) return { kind: 'shop', k: 'store', pred: it => it.label === 'Health tonic', tag: 'tonic', cat: 'shopping' };
    if (P.pelts >= 2) return { kind: 'shop', k: 'store', pred: it => it.sell, tag: 'sell_hides', cat: 'shopping' };
    if (!api.WEAPONS[1].owned && P.money >= price(90)) return { kind: 'shop', k: 'store', pred: it => it.label === 'Lever-action rifle', tag: 'rifle', cat: 'shopping' };
    return null;
  }
  function campSpot() {
    for (let k = 0; k < 40; k++) { const a = rng() * TAU, r = 230 + rng() * 260, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) > 700 || Math.abs(z) > 700) continue; const p = { x, z, y: api.groundY(x, z) }; if (!api.campSpotProblem(p)) return { x, z }; }
    return null;
  }
  function unexplored() {
    const N = api.FOG_N, C = 1600 / N; let best = null, bs = -1;
    for (let k = 0; k < 60; k++) { const i = Math.floor(rng() * N), j = Math.floor(rng() * N); if (api.fog[j * N + i]) continue;
      const x = -800 + (i + 0.5) * C, z = -800 + (j + 0.5) * C; if (Math.abs(x) > 680 || Math.abs(z) > 680) continue;
      const d = Math.hypot(x - P.pos.x, z - P.pos.z), s = 1 / (1 + d / 300) + rng() * 0.3; if (s > bs) { bs = s; best = { x, z }; } }
    return best;
  }
  const civilians = () => api.npcs.filter(n => !n.important && !n.dead && !(n.koT > 0));
  const myCamp = () => api.EMP.camps[0];

  function planEmpire() {
    const E = api.EMP, gang = api.liveGang().length, c = myCamp();
    if (!c) { if (P.money >= price(55)) { const s = campSpot(); if (s) return { kind: 'makeCamp', ...s, had: 0, cat: 'empire' }; } return questGoal() || { kind: 'hunt', want: 2, cat: 'hunting' }; }
    if (!c.still && P.money >= price(30)) return { kind: 'campMenu', camp: c, pred: it => it.label.startsWith('Build a moonshine still'), tag: 'still', cat: 'empire' };
    if (gang < 3 && gang < api.gangCap()) {
      if (rng() < 0.5) { const n = pick(civilians()); if (n) return { kind: 'solicit', npc: n, cat: 'empire' }; }
      if (P.money >= price(30)) return { kind: 'campMenu', camp: c, pred: it => it.label.startsWith('Hire a gun'), tag: 'hire', cat: 'empire' };
    }
    if (c.stock >= 4) return { kind: 'campMenu', camp: c, pred: it => it.label.startsWith('Load moonshine'), tag: 'collect_shine', cat: 'empire' };
    if (P.crates > 0) return { kind: 'shop', k: 'saloon', pred: it => it.label.startsWith('Sell moonshine'), tag: 'sell_shine', cat: 'empire' };
    const biz = ['store', 'saloon', 'hotel', 'doctor', 'telegraph', 'bank'].filter(k => !E.rackets[k]);
    if (gang >= 2 && biz.length && rng() < 0.6) { const k = pick(biz); return { kind: 'shop', k, pred: it => it.label.startsWith('Offer them'), tag: 'racket', cat: 'empire' }; }
    if (Object.keys(E.dirt).length < 3 && P.money >= price(15)) return { kind: 'shop', k: 'saloon', pred: it => it.label.startsWith('Buy dirt'), tag: 'dirt', cat: 'empire' };
    const bm = Object.keys(E.dirt).filter(k => !E.blackmail[k]); if (bm.length) { const k = pick(bm); return { kind: 'shop', k, pred: it => it.label.startsWith('Blackmail'), tag: 'blackmail', cat: 'empire' }; }
    if (gang >= 3 && !E.town && !api.WANTED.active) return { kind: 'raid', npc: api.NPC.sheriff, cat: 'empire' };
    if (c.still < 3 && P.money >= price(120)) return { kind: 'campMenu', camp: c, pred: it => it.label.startsWith('Upgrade the still'), tag: 'still_upgrade', cat: 'empire' };
    return questGoal() || { kind: 'hunt', want: 2, cat: 'hunting' };
  }
  function planOutlaw() {
    if (api.WANTED.active) { const away = { x: api.WANTED.last.x, z: api.WANTED.last.z }; const a = Math.atan2(P.pos.x - away.x || 1, P.pos.z - away.z || 1);
      return { kind: 'flee', x: clamp(P.pos.x + Math.sin(a) * 320, -680, 680), z: clamp(P.pos.z + Math.cos(a) * 320, -680, 680), cat: 'law' }; }
    if (P.bounty > 0 && P.money > P.bounty + 40 && rng() < 0.3) return { kind: 'payBounty', cat: 'law' };
    const r = rng();
    if (r < 0.3) return questGoal() || { kind: 'hunt', want: 2, cat: 'hunting' };
    const civ = civilians();
    if (r < 0.55 && civ.length) return { kind: 'rob', npc: pick(civ), cat: 'crime' };
    if (r < 0.68) { const k = pick(['store', 'saloon', 'hotel', 'doctor']); const n = shopNpc(k); if (n && n.robbedDay !== P.day) return { kind: 'rob', npc: n, cat: 'crime' }; }
    if (r < 0.75 && api.NPC.pruitt.robbedDay !== P.day) return { kind: 'rob', npc: api.NPC.pruitt, cat: 'crime' };
    if (r < 0.85 && api.horses.some(h => !h.owned)) return { kind: 'stealHorse', cat: 'crime' };
    if (civ.length) return { kind: 'punch', npc: pick(civ), cat: 'crime' };
    return { kind: 'hunt', want: 2, cat: 'hunting' };
  }
  function planExplorer() {
    const r = rng();
    if (r < 0.15) { const pois = api.mapPOIs().filter(p => p.travel && dist(p, P.pos) > 250); if (pois.length && P.money >= price(3) && !api.WANTED.active) return { kind: 'travel', poi: pick(pois), cat: 'exploration' }; }
    if (r < 0.4) return { kind: 'hunt', want: 1, cat: 'hunting' };
    if (r < 0.55) { const q = questGoal(); if (q) return q; }
    const u = unexplored(); if (u) return { kind: 'explore', ...u, cat: 'exploration' };
    return { kind: 'hunt', want: 2, cat: 'hunting' };
  }
  function planSettler() {
    const R = api.ROM, g = P.gifts;
    if (!R.spouse) {
      const aff = R.aff[suitor];
      if (aff >= 100) { if (!g.ring) { if (P.money >= price(40)) return { kind: 'shop', k: 'store', pred: it => it.label === 'Gold wedding ring', tag: 'ring', cat: 'romance' }; }
        else return { kind: 'court', pick: l => l.startsWith('Propose marriage'), tag: 'propose', cat: 'romance' }; }
      else if (P.day * 24 + api.gameHour - (R.chatDay[suitor] ?? -99) >= 4) return { kind: 'court', pick: l => l === 'Talk a while', tag: 'chat', cat: 'romance' };
      else if (g.locket) return { kind: 'court', pick: l => l.startsWith('Give a silver locket'), tag: 'locket', cat: 'romance' };
      else if (g.flowers) return { kind: 'court', pick: l => l.startsWith('Give wildflowers'), tag: 'flowers', cat: 'romance' };
      else if (P.money >= price(15) && aff < 70) return { kind: 'shop', k: 'store', pred: it => it.label.startsWith('Silver locket'), tag: 'locket', cat: 'romance' };
      else if (P.money >= price(3)) return { kind: 'shop', k: 'store', pred: it => it.label.startsWith('Wildflower'), tag: 'flowers', cat: 'romance' };
    }
    if (!myCamp() && P.money >= price(60)) { const s = campSpot(); if (s) return { kind: 'makeCamp', ...s, had: 0, cat: 'empire' }; }
    if (myCamp() && !myCamp().still && P.money >= price(30)) return { kind: 'campMenu', camp: myCamp(), pred: it => it.label.startsWith('Build a moonshine still'), tag: 'still', cat: 'empire' };
    return questGoal() || { kind: 'hunt', want: 2, cat: 'hunting' };
  }
  function plan() {
    // pick over bodies after a fight; it's where the game hands out ammo and cash
    const body = api.outlaws.filter(e => e.dead && !e.looted && dist(e.pos, P.pos) < 70).sort((a, b) => dist(a.pos, P.pos) - dist(b.pos, P.pos))[0];
    if (body) return { kind: 'loot', e: body, cat: 'looting' };
    if (ammoLeft() < 12 && P.money >= price(4)) return { kind: 'shop', k: 'store', pred: it => it.label.startsWith('Revolver cartridges'), tag: 'ammo', cat: 'shopping' };
    const s = supplies(); if (s && rng() < 0.5) return s;
    switch (persona) {
      case 'storyteller': return questGoal() || (rng() < 0.6 ? { kind: 'hunt', want: 2, cat: 'hunting' } : { kind: 'explore', ...(unexplored() || { x: 0, z: 0 }), cat: 'exploration' });
      case 'outlaw': return planOutlaw();
      case 'empire': return planEmpire();
      case 'explorer': return planExplorer();
      case 'settler': return planSettler();
    }
  }

  // ---------- per-tick entry points ----------
  function beforeTick(dt) {
    sim.dt = dt; sim.wantMove = false; clearInputs();
    const dx = P.pos.x - lastPos.x, dz = P.pos.z - lastPos.z, step = Math.hypot(dx, dz); if (step < 50) travelled += step; lastPos = { x: P.pos.x, z: P.pos.z };
    if (P.mounted) mountedTime += dt;
    if (!P.alive) { if (wasAlive) { const k = objKey(); deathsAt[k] = (deathsAt[k] || 0) + 1; if (deathsAt[k] % 3 === 0) { avoidUntil[k] = T() + 300; log('gave_up', { objective: k }); } goal = null; }
      wasAlive = false; time.dead = (time.dead || 0) + dt; return; }
    wasAlive = true;
    // soft-lock watch: no bullets, too poor to buy any, nothing to sell
    if (ammoLeft() === 0 && P.money < 4 && P.pelts === 0 && P.crates === 0) { softT += dt; if (softT > 60 && !softLogged) { softLogged = true; log('softlock', { money: P.money }); } } else { softT = 0; softLogged = false; }
    if (retreat) { if (T() > retreat.until) retreat = null; else { time.retreat = (time.retreat || 0) + dt; moveTo(retreat.x, retreat.z, { arrive: 5 }); trackStuck(); return; } }
    if (api.dlg) { dlgT -= dt; if (dlgT <= 0) { dlgT = 0.6; api.advanceDlg(); } time.dialogue = (time.dialogue || 0) + dt; return; }
    if (api.menu) { const m = api.menu, title = m.custom?.title || '';
      if (title === 'Name your gang') api.buy(Math.floor(rng() * 4)); else if (title === 'Pitch a camp') api.buy(0);
      // a purchase that fails (not enough money) leaves the same menu open: back out of it
      if (api.menu === m) { if (title === 'Pitch a camp') log('goal_failed', { kind: 'camp_cost' }); api.closeMenu(); } return; }
    if (P.hp < 40 && P.tonics > 0) { P.tonics--; P.hp = Math.min(100, P.hp + 60); log('tonic'); }
    if (api.focusOn) { time.combat = (time.combat || 0) + dt; return; }
    const threats = hostiles(persona === 'outlaw' && api.WANTED.active ? 22 : 45);
    if (threats.length && !(persona === 'outlaw' && api.WANTED.active && threats[0].d > 22)) {
      // out of bullets, or badly hurt with no tonic: break off and ride away from the fight
      if (ammoLeft() === 0 || (P.hp < 30 && P.tonics === 0)) { const e = threats[0].e, a = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
        retreat = { x: clamp(P.pos.x + Math.sin(a) * 150, -680, 680), z: clamp(P.pos.z + Math.cos(a) * 150, -680, 680), until: T() + 20 }; log('retreat', { why: ammoLeft() ? 'hurt' : 'no_ammo' }); goal = null; return; }
      time.combat = (time.combat || 0) + dt; fight(threats); trackStuck(); return; }
    decideT -= dt;
    if (!goal || decideT <= 0 && goal.kind === 'wait') { goal = plan(); goal.t0 = T(); decideT = 2; }
    const r = G[goal.kind](goal);
    time[goal.cat || goal.kind] = (time[goal.cat || goal.kind] || 0) + dt;
    if (r !== 'running' || T() - goal.t0 > (goal.kind === 'explore' || goal.kind === 'hunt' ? 180 : 120)) { if (r === 'fail') log('goal_failed', { kind: goal.kind }); goal = null; }
    trackStuck();
  }

  return { beforeTick, afterTick, ev, time, stats: () => ({ stuck, travelled: Math.round(travelled), mountedTime: Math.round(mountedTime), suitor }), log };
}
