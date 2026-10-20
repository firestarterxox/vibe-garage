// Vibe Garage mockup interactions (demo only; nothing is sent anywhere)
(function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2200);}
  $$('[data-toast]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();toast(a.dataset.toast);}));

  // positive-only reactions
  $$('.react').forEach(b=>b.addEventListener('click',()=>{const n=b.querySelector('b');const on=b.classList.toggle('on');if(n)n.textContent=(+n.textContent)+(on?1:-1);}));

  // project filters
  const grid=$('#pgrid');
  if(grid){const state={tool:'all',tag:'all'};
    $$('.filters').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('.fbtn');if(!b)return;
      $$('.fbtn',g).forEach(x=>x.classList.remove('on'));b.classList.add('on');state[g.dataset.group]=b.dataset.v;
      let shown=0;$$('.card',grid).forEach(c=>{const ok=(state.tool==='all'||c.dataset.tools.split(' ').includes(state.tool))&&(state.tag==='all'||c.dataset.tags.split(' ').includes(state.tag));c.style.display=ok?'':'none';if(ok)shown++;});
      $('#pempty').style.display=shown?'none':'block';}));}

  // forum channels
  const tl=$('#tlist');
  if(tl){$$('.chan').forEach(b=>b.addEventListener('click',()=>{$$('.chan').forEach(x=>x.classList.remove('on'));b.classList.add('on');const c=b.dataset.chan;let n=0;
    $$('.thread',tl).forEach(t=>{const ok=c==='all'||t.dataset.chan===c;t.style.display=ok?'':'none';if(ok)n++;});$('#tempty').style.display=n?'none':'block';}));}

  // countdown (cosmetic)
  const cd=$('[data-countdown]');
  if(cd){const end=Date.now()+((4*24+11)*60+32)*60000;const tick=()=>{let s=Math.max(0,(end-Date.now())/60000|0);$('[data-d]',cd).textContent=s/1440|0;$('[data-h]',cd).textContent=(s%1440)/60|0;$('[data-m]',cd).textContent=s%60;};tick();setInterval(tick,30000);}

  // submit wizard
  const wiz=$('#wizard');
  if(wiz){let step=1;const max=3,next=$('#next'),back=$('#back');
    const f=$('#pfile');f&&f.addEventListener('change',()=>{$('#pfilename').textContent=f.files[0]?('✔ '+f.files[0].name+' (preview only)'):'Drop an image or clip';});
    function show(){$$('.wstep').forEach(s=>s.classList.toggle('on',+s.dataset.step===step));
      $$('.step-pill').forEach(p=>{const n=+p.dataset.pill;p.classList.toggle('on',n===step);p.classList.toggle('done',n<step);});
      back.style.visibility=step>1?'visible':'hidden';next.textContent=step<max?'Next →':'Publish ✨';
      $('#secretAlert').classList.remove('show');$('#okAlert').classList.remove('show');}
    // Patterns that look like secrets. Client-side heuristic only.
    const PATTERNS=[
      [/sk-(?:proj-|ant-)?[A-Za-z0-9_\-]{16,}/g,'OpenAI/Anthropic-style key (sk-…)'],
      [/xai-[A-Za-z0-9]{20,}/g,'xAI-style key (xai-…)'],
      [/gh[pousr]_[A-Za-z0-9]{20,}/g,'GitHub token (ghp_…)'],
      [/github_pat_[A-Za-z0-9_]{20,}/g,'GitHub fine-grained token'],
      [/AKIA[0-9A-Z]{16}/g,'AWS access key ID (AKIA…)'],
      [/AIza[0-9A-Za-z_\-]{30,}/g,'Google API key (AIza…)'],
      [/xox[abpr]-[A-Za-z0-9\-]{10,}/g,'Slack token (xox…)'],
      [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g,'Private key block'],
      [/\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{4,}/gi,'Hard-coded password/secret']];
    function scan(){const fields={'Project name':$('#pname'),'Pitch':$('#ppitch'),'Live link':$('#plink'),'Repo URL':$('#prepo'),'Code':$('#pcode'),'Prompts':$('#pprompts')};const hits=[];
      for(const [label,el] of Object.entries(fields)){const v=el.value||'';for(const [re,name] of PATTERNS){re.lastIndex=0;let m;while((m=re.exec(v))){const s=m[0];hits.push(`${label}: ${name} → ${s.slice(0,6)}${'•'.repeat(Math.min(10,Math.max(3,s.length-6)))}`);}}}
      return hits;}
    next.addEventListener('click',()=>{
      if(step===1&&!$('#pname').value.trim()){$('#pname').focus();toast('Give your project a name first ✨');return;}
      if(step<max){step++;show();window.scrollTo({top:0,behavior:'smooth'});return;}
      const hits=scan(),sa=$('#secretAlert'),ok=$('#okAlert');
      if(hits.length){$('#secretList').innerHTML=hits.map(h=>`<li>${h.replace(/</g,'&lt;')}</li>`).join('');sa.classList.add('show');ok.classList.remove('show');}
      else{sa.classList.remove('show');ok.classList.add('show');toast('Published! (demo, nothing was sent)');}
    });
    back.addEventListener('click',()=>{if(step>1){step--;show();}});
    show();}
})();
