// Variance decomposition and interval checks used in the paper's limitations (written during methods review).
// usage: node analysis/variance.mjs analysis/per-session.csv
import { readFileSync } from 'node:fs';
const L=readFileSync(process.argv[2],'utf8').trim().split('\n');const H=L[0].split(',');
const rows=L.slice(1).map(l=>{const v=l.match(/("[^"]*"|[^,]*)(,|$)/g).map(s=>s.replace(/,$/,'').replace(/"/g,''));return Object.fromEntries(H.map((h,i)=>[h,v[i]]));});
rows.forEach(r=>{r.quit=r.would_quit_min===''?0:1;});
const PERS=['storyteller','outlaw','empire','explorer','settler'],SK=['novice','average','expert'];
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function eta(key){const y=rows.map(r=>+r[key]),g=mean(y),SST=y.reduce((s,x)=>s+(x-g)**2,0);
 const ss=f=>{const grp={};rows.forEach(r=>{(grp[f(r)]=grp[f(r)]||[]).push(+r[key])});return Object.values(grp).reduce((s,a)=>s+a.length*(mean(a)-g)**2,0)};
 const P=ss(r=>r.persona),S=ss(r=>r.skill),C=ss(r=>r.persona+r.skill);return {persona:P/SST,skill:S/SST,inter:(C-P-S)/SST,resid:1-C/SST};}
for(const k of ['missions','quit','epm','breadth','deaths_per_hr','stuck_per_hr','explored'])console.log(k.padEnd(14),Object.entries(eta(k)).map(([a,b])=>a+'='+(100*b).toFixed(0)+'%').join(' '));
console.log('\ncell table: missions mean | quit% | deaths/hr');
for(const p of PERS)console.log(p.padEnd(12),SK.map(s=>{const c=rows.filter(r=>r.persona===p&&r.skill===s);return `${mean(c.map(r=>+r.missions)).toFixed(1)} | ${(100*mean(c.map(r=>r.quit))).toFixed(0)}% | ${mean(c.map(r=>+r.deaths_per_hr)).toFixed(1)}`}).join('   '));
// skill effect on missions within persona (expert-novice)
console.log('\nexpert-novice missions by persona',PERS.map(p=>{const m=s=>mean(rows.filter(r=>r.persona===p&&r.skill===s).map(r=>+r.missions));return p+':'+(m('expert')-m('novice')).toFixed(2)}).join(' '));
// bootstrap vs normal CI, missions by persona; also Wilson for quit
let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
for(const p of PERS){const a=rows.filter(r=>r.persona===p).map(r=>+r.missions);const m=mean(a);const s=Math.sqrt(mean(a.map(x=>(x-m)**2)));
 const bs=[];for(let i=0;i<5000;i++){let t=0;for(let j=0;j<a.length;j++)t+=a[Math.floor(rnd()*a.length)];bs.push(t/a.length);}bs.sort((x,y)=>x-y);
 const q=rows.filter(r=>r.persona===p).map(r=>r.quit),n=q.length,ph=mean(q),z=1.96,c=(ph+z*z/(2*n))/(1+z*z/n),hw=z*Math.sqrt(ph*(1-ph)/n+z*z/(4*n*n))/(1+z*z/n);
 const uniq=new Set(a).size;
 console.log(p.padEnd(12),'missions',m.toFixed(2),'normal ±',(1.96*s/Math.sqrt(a.length)).toFixed(2),'boot',bs[125].toFixed(2)+'-'+bs[4875].toFixed(2),'distinct values',uniq,'| quit',(100*ph).toFixed(1),'Wilson',(100*(c-hw)).toFixed(1)+'-'+(100*(c+hw)).toFixed(1));}
// engagement proxies correlation
const corr=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){n+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2}return n/Math.sqrt(da*db)};
const col=k=>rows.map(r=>+r[k]);
console.log('\nr(epm,quit)',corr(col('epm'),rows.map(r=>r.quit)).toFixed(2),'r(breadth,quit)',corr(col('breadth'),rows.map(r=>r.quit)).toFixed(2),'r(stuck,quit)',corr(col('stuck_per_hr'),rows.map(r=>r.quit)).toFixed(2),'r(explored,stuck)',corr(col('explored'),col('stuck_per_hr')).toFixed(2));
// within persona r(stuck,quit)
console.log('within-persona r(stuck,quit)',PERS.map(p=>{const c=rows.filter(r=>r.persona===p);return p+':'+corr(c.map(r=>+r.stuck_per_hr),c.map(r=>r.quit)).toFixed(2)}).join(' '));
