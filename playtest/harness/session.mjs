// Runs one bot through one fresh copy of the game and returns its telemetry.
import { workerData, parentPort } from 'node:worker_threads';
import { installGlobals, makeClock, FakeRenderer } from './env.mjs';
import { makeBot } from './bot.mjs';

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function run({ id, persona, skill, seed, minutes, url }) {
  installGlobals();
  const rng = mulberry32(seed), gameRng = mulberry32(seed ^ 0x9e3779b9);
  Math.random = gameRng;  // the game's own randomness (AI, loot, spawns) is seeded per session too
  globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
  await import(`${url}?session=${id}`);
  const api = globalThis.__SIM.api;
  while (!api.built) await new Promise(r => setTimeout(r, 5));
  api.begin(false);

  const sim = { t: 0, dt: 1 / 20 }, dt = sim.dt, P = api.P;
  const bot = makeBot(api, { persona, skill, rng, sim });
  const samples = [];
  const snap = () => ({ quests: Object.fromEntries(Object.entries(api.QS).map(([k, v]) => [k, v.state + ':' + v.stage])), alive: P.alive, wanted: api.WANTED.active,
    crimes: api.crimeLog.length, kills: P.stats.kills, rank: api.rankInfo().idx, gang: api.liveGang().length, camps: api.EMP.camps.length,
    rackets: Object.keys(api.EMP.rackets).length, blackmail: Object.keys(api.EMP.blackmail).length, town: api.EMP.town, spouse: api.ROM.spouse,
    children: api.ROM.children.length, stills: api.EMP.camps.reduce((s, c) => s + c.still, 0), sites: Object.keys(api.SITES).filter(k => { const s = api.SITES[k], N = api.FOG_N, C = 1600 / N; return api.fog[Math.floor((s.z + 800) / C) * N + Math.floor((s.x + 800) / C)]; }) });
  let prev = snap(), pollT = 0, sampleT = 0, peakBounty = 0, wantedCount = 0, escapes = 0;
  const total = minutes * 60;
  while (sim.t < total) {
    bot.beforeTick(dt);
    api.clock.elapsedTime += dt; api.tick(dt); api.camera.updateMatrixWorld();
    globalThis.__SIM.clock.advance(dt * 1000);
    bot.afterTick();
    sim.t += dt; pollT += dt; sampleT += dt;
    peakBounty = Math.max(peakBounty, P.bounty);
    if (pollT >= 1) { pollT = 0; const now = snap(), L = bot.log;
      for (const q in now.quests) if (now.quests[q] !== prev.quests[q]) { const [s] = now.quests[q].split(':'), [ps] = prev.quests[q].split(':');
        if (s !== ps) L(s === 'active' ? 'quest_start' : s === 'done' ? 'quest_complete' : 'quest_unlock', { quest: q }); else L('quest_stage', { quest: q }); }
      if (prev.alive && !now.alive) { const law = api.WANTED.active, wolf = api.animals.some(a => a.kind === 'wolf' && a.alerted && !a.dead && Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) < 30);
        L('death', { cause: law ? 'lawmen' : wolf ? 'wolves' : api.RAID.active ? 'raid' : 'outlaws' }); }
      if (!prev.wanted && now.wanted) { wantedCount++; L('wanted_start', { bounty: P.bounty }); }
      if (prev.wanted && !now.wanted) { const died = !P.alive || prev.alive !== now.alive; if (!died && !api.EMP.town) escapes++; L('wanted_end', { how: died ? 'died' : api.EMP.town ? 'took_town' : 'escaped' }); }
      for (let i = 0; i < now.crimes - prev.crimes; i++) { const c = api.crimeLog[i]; if (c) L('crime', { crime: c.name, seen: c.seen }); }
      if (now.kills > prev.kills) L('kill', { n: now.kills - prev.kills });
      if (now.rank > prev.rank) L('rank_up', { rank: api.rankInfo().name });
      if (now.gang !== prev.gang) L(now.gang > prev.gang ? 'gang_join' : 'gang_loss', { size: now.gang });
      if (now.camps > prev.camps) L('camp_built');
      if (now.stills > prev.stills) L('still_level', { total: now.stills });
      if (now.rackets > prev.rackets) L('racket');
      if (now.blackmail > prev.blackmail) L('blackmail');
      if (now.town && !prev.town) L('town_taken'); if (!now.town && prev.town) L('town_lost');
      if (now.spouse && !prev.spouse) L('married', { to: now.spouse });
      if (now.children > prev.children) L('child_born');
      for (const s of now.sites) if (!prev.sites.includes(s)) L('discovered', { site: s });
      prev = now; }
    if (sampleT >= 30) { sampleT = 0; const fogN = api.fog.reduce((a, b) => a + b, 0);
      samples.push({ t: Math.round(sim.t), money: P.money, rank: api.rankInfo().idx, influence: api.rankInfo().inf, quests: Object.values(api.QS).filter(q => q.state === 'done').length,
        explored: +(fogN / api.fog.length * 100).toFixed(1), bounty: P.bounty, gang: api.liveGang().length, hp: Math.round(P.hp) }); }
  }
  return { id, persona, skill, seed, minutes, events: bot.ev, time: Object.fromEntries(Object.entries(bot.time).map(([k, v]) => [k, Math.round(v)])), samples,
    final: { money: P.money, rank: api.rankInfo().name, influence: api.rankInfo().inf, questsDone: Object.values(api.QS).filter(q => q.state === 'done').length,
      honor: P.honor, bounty: P.bounty, peakBounty, wantedCount, escapes, kills: P.stats.kills, heads: P.stats.heads, gang: api.liveGang().length, camps: api.EMP.camps.length,
      town: api.EMP.town, spouse: api.ROM.spouse, children: api.ROM.children.length, explored: +(api.fog.reduce((a, b) => a + b, 0) / api.fog.length * 100).toFixed(1), ...bot.stats() },
    errors: [...new Set(globalThis.__SIM.errors)].slice(0, 5) };
}

run(workerData).then(r => parentPort.postMessage(r), e => parentPort.postMessage({ id: workerData.id, crash: String(e && e.stack || e) }));
