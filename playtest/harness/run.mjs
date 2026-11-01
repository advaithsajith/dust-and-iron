// Plays N sessions in parallel worker threads and writes one JSON line per session.
// usage: node harness/run.mjs [sessions=300] [minutes=40] [out=data/sessions.jsonl]
import { Worker } from 'node:worker_threads';
import { createWriteStream, mkdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameModule } from './env.mjs';
import { PERSONAS, SKILLS } from './bot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const [n = 300, minutes = 40, outRel = 'data/sessions.jsonl'] = process.argv.slice(2);
const out = join(HERE, '..', outRel); mkdirSync(dirname(out), { recursive: true });
const url = buildGameModule();
const skills = Object.keys(SKILLS);
const jobs = Array.from({ length: +n }, (_, i) => ({ id: i, persona: PERSONAS[i % PERSONAS.length], skill: skills[Math.floor(i / PERSONAS.length) % skills.length],
  seed: 1000 + i * 7919, minutes: +minutes, url }));
const stream = createWriteStream(out);
const par = Math.max(1, cpus().length - 2);
let next = 0, done = 0, crashes = 0; const t0 = Date.now();
await new Promise(resolve => {
  const launch = () => {
    if (next >= jobs.length) { if (done === jobs.length) resolve(); return; }
    const job = jobs[next++], w = new Worker(join(HERE, 'session.mjs'), { workerData: job, resourceLimits: { maxOldGenerationSizeMb: 1024 } });
    w.once('message', r => { stream.write(JSON.stringify(r) + '\n'); if (r.crash) crashes++; done++;
      if (done % 20 === 0 || done === jobs.length) console.log(`${done}/${jobs.length} sessions · ${crashes} crashed · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      w.terminate(); launch(); });
    w.once('error', e => { stream.write(JSON.stringify({ id: job.id, crash: String(e) }) + '\n'); crashes++; done++; launch(); });
  };
  for (let i = 0; i < par; i++) launch();
});
stream.end();
console.log(`wrote ${out}`);
