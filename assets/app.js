/* Vibe Garage front end. Vanilla JS, no framework.
   Data comes through VG.api so the sample data (assets/data.js) can be swapped for real JSON later. */
(function(){
  document.documentElement.classList.remove('no-js');
  const D=window.VG_DATA, I=window.VG_ICONS||{};
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ic=(n,cls='')=>`<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]||''}</svg>`;
  const qs=k=>new URLSearchParams(location.search).get(k);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt=n=>n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'k':String(n);

  /* ---------- data layer ---------- */
  async function tryJSON(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():null;}catch(e){return null;}}
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const C=window.VG_CONFIG||{};let _disc=null,_proj=null;
  const disc=()=>_disc||(_disc=tryJSON('data/discussions.json').then(j=>j||{threads:[],categories:[]}));
  const projJSON=()=>_proj||(_proj=tryJSON('data/projects.json').then(j=>j||{projects:[]}));
  const api={
    // Real GitHub submissions replace the sample projects as soon as at least one exists.
    async projects(){const [real]=await Promise.all([projJSON(),wait(250)]);const r=real.projects||[];return r.length?r:D.projects;},
    async project(id){const all=[...((await projJSON()).projects||[]),...D.projects];return all.find(p=>p.id===id);},
    // Real discussions replace sample threads once any non-announcement discussion exists; announcements (welcome/rules) always show.
    async threads(){const [j]=await Promise.all([disc(),wait(250)]);const r=j.threads||[];return r.some(t=>t.channel!=='announcements')?r:[...r,...D.threads];},
    async thread(id){const all=[...((await disc()).threads||[]),...D.threads];const t=all.find(t=>t.id===id);return t&&{...t,posts:t.posts||D.posts[t.id]||[]};},
    async categorySlug(chan){const j=await disc();const name=chan==='projects'?(j.projectsCategory||(C.projectsCategory||[]).slice(-1)[0]):(j.channelCategory||{})[chan]||((C.channels||{})[chan]||[]).find(n=>(C.fallbackSlugs||{})[n]);
      const c=(j.categories||[]).find(c=>c.name===name);return c?c.slug:((C.fallbackSlugs||{})[name]||'general');},
    newDiscussionUrl(slug,title,body){const u=new URL(`https://github.com/${C.repo}/discussions/new`);u.searchParams.set('category',slug);if(title)u.searchParams.set('title',title);if(body)u.searchParams.set('body',body);return u.toString();},
    channels:()=>D.channels, member:h=>D.members.find(m=>m.handle===h)||{handle:h}
  };
  const ago=iso=>{if(!iso)return '';const s=(Date.now()-new Date(iso))/1000;if(s<60)return 'just now';const u=[[31536000,'y'],[2592000,'mo'],[86400,'d'],[3600,'h'],[60,'m']].find(([n])=>s>=n);return Math.floor(s/u[0])+u[1]+' ago';};
  function giscus(number){if(!(C.giscus&&C.giscus.enabled))return '';return `<div class="panel glass reveal" id="comments"><h3>${ic('message-circle')} Replies &amp; reactions</h3><p class="muted" style="margin-top:0;font-size:.9rem">Sign in with GitHub to reply or react. Comments live in this project’s GitHub Discussions.</p><div class="giscus"></div></div>`;}
  function mountGiscus(number){const box=$('.giscus');if(!box)return;const sc=document.createElement('script');sc.src='https://giscus.app/client.js';sc.async=true;sc.crossOrigin='anonymous';
    Object.entries({repo:C.repo,'repo-id':C.repoId,mapping:'number',term:String(number),'reactions-enabled':'1','emit-metadata':'0','input-position':'top',theme:C.giscus.theme,lang:'en',loading:'lazy',strict:'0'}).forEach(([k,v])=>sc.setAttribute('data-'+k,v));box.appendChild(sc);}
  window.VG={api,ic,esc};

  /* ---------- UI atoms ---------- */
  const PAL=['#ff4fa3','#2ee6d6','#ff9a3d','#9b7bff','#ffd166','#3ef0b0'];
  function hash(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h);}
  function av(handle,cls='',img=''){if(img)return `<span class="av ${cls}" title="@${esc(handle)}"><img src="${esc(img)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></span>`;const h=hash(handle),a=PAL[h%6],b=PAL[(h>>3)%6===h%6?(h+1)%6:(h>>3)%6];
    return `<span class="av ${cls}" style="background:linear-gradient(135deg,${a},${b})" title="@${esc(handle)}">${esc(handle[0].toUpperCase())}</span>`;}
  const FB={vibes:['Just vibes','💜','No critique, hype only','fb'],gentle:['Gentle tips','🌱','Kind suggestions welcome','fb gentle'],tear:['Tear it apart','🔥','Brutal honesty, please','fb tear']};
  const toolColor=n=>(D.tools.find(t=>t.name===n)||{}).color||'#a19db2';
  const toolTag=n=>`<span class="tag tool"><span class="dot" style="color:${toolColor(n)}"></span>${esc(n)}</span>`;
  const fbTag=f=>{const x=FB[f]||FB.gentle;return `<span class="tag ${x[3]}">${x[1]} ${x[0]}</span>`;};
  const art=(p,ribbon='')=>`<div class="art">${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`:window.vgArt(p.id,p.kind,p.name)}${ribbon}</div>`;
  function card(p,cls='',opts={}){const ribbon=opts.ribbon||(p.real?`<span class="ribbon">${ic('sparkles')} new submission</span>`:'');
    return `<a class="card reveal ${cls}" href="project.html?id=${encodeURIComponent(p.id)}">${art(p,ribbon+(opts.rank?`<span class="rank">0${opts.rank}</span>`:''))}
<div class="body">${opts.cover?`<div class="cover-tag">${ic('star')} Cover story · this week</div>`:''}<h3>${esc(p.name)}</h3><p>${esc(p.pitch)}</p>
<div class="tags">${(p.tools||[]).map(toolTag).join('')}${opts.noFb?'':fbTag(p.fb)}${p.example?'<span class="tag ex">example</span>':''}</div>
<div class="meta"><span class="who">${av(p.by,'',p.avatar)}@${esc(p.by)}</span><span>${ic('heart')} ${p.likes??0}</span><span>${ic('message-circle')} ${p.comments??0}</span></div></div></a>`;}
  const skel=(n,cls='')=>Array.from({length:n},()=>`<div class="card skel ${cls}"><div class="art"></div><div class="body"><div class="ln h"></div><div class="ln"></div><div class="ln w60"></div><div class="ln w40"></div></div></div>`).join('');
  const ANN={id:'announcements',name:'Announcements',icon:'pin',blurb:'News and house rules from the garage.'};
  const chan=id=>id==='announcements'?ANN:D.channels.find(c=>c.id===id)||{id,name:id,icon:'message-circle'};
  function threadRow(t){const c=chan(t.channel),others=D.members.slice(hash(t.id)%5,hash(t.id)%5+3);
    return `<a class="thread reveal" href="thread.html?id=${encodeURIComponent(t.id)}" data-chan="${esc(t.channel)}"><span class="chan-ico">${ic(c.icon)}</span>
<div><h4>${t.pinned?`<span class="badge" style="margin-right:6px">${ic('pin')} pinned</span>`:''}${esc(t.title)}</h4><small><span>${esc(c.name)}</span>·<span class="who" style="display:inline-flex;align-items:center;gap:6px">${t.avatar?av(t.by,'',t.avatar).replace('class="av ','class="av xs '):''}@${esc(t.by)}</span>·<span>${esc(t.ago||ago(t.createdAt))}</span>${t.channel==='announcements'?'':fbTag(t.fb)}${t.example?'<span class="tag ex">example</span>':''}</small></div>
<div class="count">${t.replies?`${t.real?'':`<span class="avatars">${others.map(m=>av(m.handle)).join('')}</span>`}<span>${t.replies} repl${t.replies===1?'y':'ies'}</span>`:'<span class="badge new">no replies yet</span>'}</div></a>`;}
  const emptyIll=`<svg class="ill" viewBox="0 0 150 110" fill="none"><rect x="20" y="20" width="110" height="74" rx="14" stroke="#2ee6d6" stroke-opacity=".5" stroke-width="2" stroke-dasharray="6 6"/><circle cx="60" cy="54" r="4" fill="#ff4fa3"/><circle cx="90" cy="54" r="4" fill="#ff4fa3"/><path d="M62 72q13 -8 26 0" stroke="#f1eff7" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/><circle cx="128" cy="20" r="8" fill="#ff9a3d" opacity=".7"/><circle cx="18" cy="96" r="5" fill="#9b7bff" opacity=".7"/></svg>`;
  const empty=(title,msg,action='')=>`<div class="empty">${emptyIll}<h3>${title}</h3><p>${msg}</p>${action}</div>`;

  /* ---------- toasts ---------- */
  function toast(msg,kind='ok'){let box=$('.toasts');if(!box){box=document.createElement('div');box.className='toasts';box.setAttribute('aria-live','polite');document.body.appendChild(box);}
    const t=document.createElement('div');t.className='toast '+kind;t.innerHTML=ic(kind==='warn'?'triangle-alert':kind==='info'?'info':'circle-check')+`<span>${esc(msg)}</span>`;box.appendChild(t);
    setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),350);},2600);}
  window.VG.toast=toast;

  /* ---------- reveal ---------- */
  let io=null;
  function reveal(root=document){const els=$$('.reveal:not(.in)',root);if(reduce||!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in'));return;}
    io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -6% 0px'});
    els.forEach((e,i)=>{e.style.transitionDelay=Math.min(i%6*60,300)+'ms';io.observe(e);});}

  /* ---------- global bits ---------- */
  function globals(){
    $('.burger')?.addEventListener('click',()=>{const n=$('nav.main');const o=n.classList.toggle('open');$('.burger').setAttribute('aria-expanded',o);});
    const ds=$('.demo-strip');if(ds){if(sessionStorage.getItem('vg-strip')==='x')ds.remove();else ds.querySelector('button')?.addEventListener('click',()=>{sessionStorage.setItem('vg-strip','x');ds.remove();});}
    document.addEventListener('click',e=>{const a=e.target.closest('[data-toast]');if(a){e.preventDefault();toast(a.dataset.toast,'info');}
      const r=e.target.closest('.react');if(r){const n=r.querySelector('b');const on=r.classList.toggle('on');if(n)n.textContent=(+n.textContent)+(on?1:-1);r.classList.remove('pop');void r.offsetWidth;r.classList.add('pop');}});
    $$('[data-avatars]').forEach(el=>el.innerHTML=D.members.slice(0,+el.dataset.avatars||6).map(m=>av(m.handle)).join(''));
    $$('[data-count]').forEach(el=>{const end=+el.dataset.count;if(reduce){el.textContent=end.toLocaleString();return;}const t0=performance.now();
      const step=t=>{const k=Math.min(1,(t-t0)/1400);el.textContent=Math.round(end*(1-Math.pow(1-k,3))).toLocaleString();if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);});
    const online=$('[data-online]');if(online)setInterval(()=>{const v=+online.textContent.replace(/\D/g,'')||D.stats.online;online.textContent=Math.max(90,v+Math.round(Math.random()*6-3));},3500);
    $$('[data-tools-marquee]').forEach(el=>{const chips=D.tools.map(t=>`<span class="tool-chip"><i style="background:${t.color}"></i>${esc(t.name)}</span>`).join('');el.innerHTML=chips+chips;});
    const cd=$('[data-countdown]');if(cd){const end=Date.now()+((4*24+11)*60+32)*60000;const tick=()=>{const s=Math.max(0,(end-Date.now())/1000|0);$('[data-d]',cd).textContent=s/86400|0;$('[data-h]',cd).textContent=String((s%86400)/3600|0).padStart(2,'0');$('[data-m]',cd).textContent=String((s%3600)/60|0).padStart(2,'0');};tick();setInterval(tick,15000);}
    $('#joinform')?.addEventListener('submit',e=>{e.preventDefault();const v=$('#joinemail').value.trim();if(!/^\S+@\S+\.\S+$/.test(v)){toast('Pop in a valid email first','warn');return;}toast('You\u2019re on the list! (demo, nothing was sent)');e.target.reset();});
  }

  /* ---------- pages ---------- */
  const pages={
    async home(){const b=$('#bento'),h=$('#hot'),t=$('#home-threads');b.innerHTML=skel(1,'cover')+skel(5);h.innerHTML=skel(4);t.innerHTML='';
      const ps=await api.projects();const top=[...ps].sort((a,b)=>b.likes-a.likes);
      b.innerHTML=card(ps[0],'cover',{cover:true})+ps.slice(1,6).map(p=>card(p)).join('');
      h.innerHTML=top.slice(0,5).map((p,i)=>card(p,'',{rank:i+1,noFb:true,ribbon:`<span class="ribbon hot">${ic('flame')} hot</span>`})).join('');
      t.innerHTML=(await api.threads()).slice(0,4).map(threadRow).join('');const hf=$('#hero-float');if(hf)hf.innerHTML=`<div class="fc">${art(top[1])}</div><div class="fc">${art(top[3])}</div><div class="float-badge glass">${av(top[1].by)}<span><b>@${esc(top[1].by)}</b> got 💜 ${top[1].likes}</span></div>`;reveal();},
    async projects(){const grid=$('#pgrid');grid.innerHTML=skel(6);const ps=await api.projects();const st={tool:'all',tag:'all',q:''};
      const tools=[...new Set(ps.flatMap(p=>p.tools||[]))].sort(),tags=[...new Set(ps.flatMap(p=>p.tags||[]))].sort();
      $('#f-tool').innerHTML+=['all',...tools].map(t=>`<button class="fbtn ${t==='all'?'on':''}" data-v="${esc(t)}">${t==='all'?'All':esc(t)}</button>`).join('');
      $('#f-tag').innerHTML+=['all',...tags].map(t=>`<button class="fbtn ${t==='all'?'on':''}" data-v="${esc(t)}">${t==='all'?'All':'#'+esc(t)}</button>`).join('');
      const draw=()=>{const q=st.q.toLowerCase();const list=ps.filter(p=>(st.tool==='all'||p.tools.includes(st.tool))&&(st.tag==='all'||p.tags.includes(st.tag))&&(!q||(p.name+' '+p.pitch+' '+p.by).toLowerCase().includes(q)));
        $('#pcount').textContent=`${list.length} project${list.length===1?'':'s'}`;
        grid.innerHTML=list.length?list.map(p=>card(p)).join(''):empty('Nothing here… yet','No projects match that combo. Maybe you\u2019re the one to build it?',`<p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn ghost sm" id="reset">${ic('x')} Clear filters</button><a class="btn sm" href="submit.html">${ic('rocket')} Submit a project</a></p>`);
        $('#reset')?.addEventListener('click',()=>{st.tool=st.tag='all';st.q='';$('#psearch').value='';$$('.filters').forEach(g=>$$('.fbtn',g).forEach((b,i)=>b.classList.toggle('on',i===0)));draw();});reveal(grid);};
      $$('.filters').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('.fbtn');if(!b)return;$$('.fbtn',g).forEach(x=>x.classList.remove('on'));b.classList.add('on');st[g.dataset.group]=b.dataset.v;draw();}));
      $('#psearch').addEventListener('input',e=>{st.q=e.target.value;draw();});draw();},
    async project(){const root=$('#pdetail');root.innerHTML=`<div class="grid2">${skel(2)}</div>`;const id=qs('id')||D.projects[0].id;const p=await api.project(id);
      if(!p){root.innerHTML=empty('Project not found','That link might be old, or the project moved.',`<a class="btn sm" href="projects.html">${ic('arrow-left')} Back to projects</a>`);return;}
      document.title=p.name+' · Vibe Garage';const f=FB[p.fb]||FB.gentle;const all=await api.projects();
      const code=p.code||(p.real?'// no code pasted':`# ${p.name}: main entry (sample)\ndef main():\n    print("hello from the garage ✨")\n\nif __name__ == "__main__":\n    main()`);
      root.innerHTML=`<div class="page-head" style="padding-top:30px"><a class="kicker" href="projects.html">${ic('arrow-left')} all projects</a><h1 style="margin-top:.3em">${esc(p.name)}</h1><p>${esc(p.pitch)}</p><div class="tags">${(p.tools||[]).map(toolTag).join('')}${(p.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}${p.example?'<span class="tag ex">example project</span>':''}</div></div>
<div class="detail"><div><div class="hero-art reveal">${art(p)}</div>
<div class="panel reveal" style="margin-top:22px"><h3>${ic('code')} The code</h3><p class="muted" style="margin-top:0">${p.repo?`${ic('git-branch')} <a class="mono" href="https://github.com/${esc(p.repo)}" target="_blank" rel="noopener">github.com/${esc(p.repo)}</a>${p.example?' <small>(sample link)</small>':''}`:'No repo linked.'}</p><div style="position:relative"><pre class="code">${esc(code)}</pre><button class="btn ghost sm copy" data-copy>${ic('code')} Copy</button></div></div>
<div class="panel reveal"><h3>${ic('wand-sparkles')} Prompts they shared</h3><p class="muted" style="margin-top:0">The secret sauce. Steal freely.</p>${(p.prompts||[]).map(x=>`<div class="prompt">${ic('terminal')}${esc(x)}</div>`).join('')||'<p class="muted">No prompts shared.</p>'}</div></div>
<aside><div class="panel glass"><div class="fbbig ${p.fb}"><span class="em">${f[1]}</span><div><b>Feedback wanted: ${f[0]}</b><br><small class="muted">${f[2]}</small></div></div>
${p.url?`<p style="margin:18px 0 6px"><a class="btn" style="width:100%" href="${esc(p.url)}" target="_blank" rel="noopener">${ic('external-link')} Open live demo</a></p>`:''}${p.example?'<small class="muted">Sample link, this is an example project.</small>':''}${p.discussionUrl?`<p style="margin:10px 0 0"><a class="btn ghost sm" style="width:100%" href="${esc(p.discussionUrl)}" target="_blank" rel="noopener">${ic('message-circle')} Discuss on GitHub</a></p>`:''}</div>
${p.real?'':`<div class="panel"><h3>${ic('heart')} Show some love</h3><div class="reacts"><button class="react">💜 love this vibe <b>${p.likes}</b></button><button class="react">🙌 this helped <b>${p.comments}</b></button><button class="react">🤯 how?! <b>${p.comments>>1}</b></button></div><small class="muted" style="display:block;margin-top:12px">Positive reactions only. No downvotes, ever.</small></div>`}
<div class="panel"><h3>${ic('user')} Builder</h3><div style="display:flex;gap:12px;align-items:center">${av(p.by,'sq',p.avatar)}<div><b>@${esc(p.by)}</b><br><span class="badge">🛠 builder</span></div></div><p style="margin:14px 0 0"><a href="${p.real?'https://github.com/'+esc(p.by):'profile.html'}"${p.real?' target="_blank" rel="noopener"':''}>View profile ${ic('arrow-right')}</a></p></div></aside></div>
${p.real?giscus(p.number):''}
<section><div class="sec-h"><h2>More from the garage</h2></div><div class="grid3">${all.filter(o=>o.id!==p.id).slice(0,3).map(o=>card(o)).join('')}</div></section>`;
      if(p.real)mountGiscus(p.number);
      $('[data-copy]')?.addEventListener('click',()=>{navigator.clipboard?.writeText(code).then(()=>toast('Code copied'),()=>toast('Copy not allowed here','warn'));});reveal();},
    async forum(){const list=$('#tlist');list.innerHTML=Array.from({length:5},()=>'<div class="thread skel"><span class="chan-ico ln" style="width:44px;height:44px"></span><div><div class="ln h"></div><div class="ln w40"></div></div><div></div></div>').join('');
      const ts=await api.threads();let cur=qs('c')||'all';
      const chList=[{id:'all',name:'All channels',icon:'sparkles'},...(ts.some(t=>t.channel==='announcements')?[ANN]:[]),...D.channels];$('#chans').innerHTML=chList.map(c=>`<button class="chan ${c.id===cur?'on':''}" data-chan="${c.id}">${ic(c.icon)}<span>${esc(c.name)}</span><small>${c.id==='all'?ts.length:ts.filter(t=>t.channel===c.id).length}</small></button>`).join('');
      const draw=()=>{const c=cur==='announcements'?ANN:D.channels.find(x=>x.id===cur);$('#chan-title').innerHTML=c?`${ic(c.icon)} ${esc(c.name)} <small class="muted" style="font:500 .95rem var(--body)">· ${esc(c.blurb)}</small>`:`${ic('sparkles')} Everything`;
        const l=ts.filter(t=>cur==='all'||t.channel===cur);const ch=cur==='all'||cur==='announcements'?'newbie-corner':cur;
        api.categorySlug(ch).then(slug=>{const url=api.newDiscussionUrl(slug,'',`Feedback level: Gentle tips 🌱\n\n<!-- What's up? Share what you built, what you're stuck on, or what you learned. Change the feedback level to "Just vibes" or "Tear it apart" if you like. -->\n`);$$('[data-newthread]').forEach(a=>{a.href=url;a.removeAttribute('data-toast');});});
        list.innerHTML=l.length?l.map(threadRow).join(''):empty('Quiet in here','No threads in this channel yet. Start the first one!',`<a class="btn sm" data-newthread target="_blank" rel="noopener" href="https://github.com/${esc(C.repo)}/discussions">${ic('send')} Start a thread</a>`);reveal(list);};
      $('#chans').addEventListener('click',e=>{const b=e.target.closest('.chan');if(!b)return;$$('.chan').forEach(x=>x.classList.remove('on'));b.classList.add('on');cur=b.dataset.chan;history.replaceState(null,'',cur==='all'?'forum.html':'forum.html?c='+cur);draw();});draw();},
    async thread(){const root=$('#thread');root.innerHTML=skel(2);const t=await api.thread(qs('id')||D.threads[0].id);
      if(!t){root.innerHTML=empty('Thread not found','It may have been moved or removed.',`<a class="btn sm" href="forum.html">${ic('arrow-left')} Back to forum</a>`);return;}
      document.title=t.title+' · Vibe Garage';const c=chan(t.channel);
      if(t.real){root.innerHTML=`<div class="page-head" style="padding-top:30px"><a class="kicker" href="forum.html?c=${c.id}">${ic('arrow-left')} ${esc(c.name)}</a><h1 style="font-size:clamp(2rem,5vw,3.6rem);margin-top:.35em">${esc(t.title)}</h1>
<div class="tags">${t.pinned?`<span class="tag fb">${ic('pin')} pinned</span>`:''}${t.channel==='announcements'?'':fbTag(t.fb).replace('</span>',' feedback</span>')}<span class="tag">${esc(t.category)}</span></div></div>
<article class="post op reveal ${t.pinned?'pinned':''}"><div class="who">${av(t.by,'sq',t.avatar)}<b>@${esc(t.by)}</b><span class="badge">author</span><small class="muted">${esc(ago(t.createdAt))}</small><a class="react" style="margin-left:auto" href="${esc(t.url)}" target="_blank" rel="noopener">${ic('external-link')} open on GitHub</a></div><div class="gh-body">${t.bodyHTML}</div></article>
${giscus(t.number)}`;mountGiscus(t.number);reveal();return;}
      const posts=t.posts.length?t.posts:[{by:t.by,badges:['🌱 member'],ago:t.ago,html:'<p>(Sample opening post. In the full version this is the author\u2019s message.)</p>',helped:0,love:2}];
      const post=(p,i)=>`<article class="post reveal ${p.pinned?'pinned':''} ${i===0?'op':''}">${p.pinned?`<div class="pin">${ic('pin')} pinned helpful answer</div>`:''}<div class="who">${av(p.by,'sq')}<b>@${esc(p.by)}</b>${(p.badges||[]).map(b=>`<span class="badge ${/mod/.test(b)?'mod':/newbie/.test(b)?'new':''}">${esc(b)}</span>`).join('')}${i===0?'<span class="badge">author</span>':''}<small class="muted">${esc(p.ago||'')}</small></div>${p.html}
<div class="reacts"><button class="react">🙌 this helped <b>${p.helped||0}</b></button><button class="react">💜 love this vibe <b>${p.love||0}</b></button><a class="react" href="guidelines.html#report" style="margin-left:auto;color:var(--dim)">${ic('flag')} report</a></div></article>`;
      root.innerHTML=`<div class="page-head" style="padding-top:30px"><a class="kicker" href="forum.html?c=${c.id||''}">${ic('arrow-left')} ${esc(c.name)}</a><h1 style="font-size:clamp(2rem,5vw,3.6rem);margin-top:.35em">${esc(t.title)}</h1>
<div class="tags">${fbTag(t.fb).replace('</span>',' feedback</span>')}${(t.tools||[]).map(toolTag).join('')}${t.example?'<span class="tag ex">example thread</span>':''}</div></div>
${posts.map(post).join('')}${posts.length<2?empty('No replies yet','Be the first to help out. Remember: this thread asked for <b>'+FB[t.fb][0].toLowerCase()+'</b>.',''):''}
<div class="panel glass reveal"><h3>${ic('message-circle')} Reply</h3><textarea placeholder="Be kind. This thread asked for ${esc(FB[t.fb][0].toLowerCase())} ${FB[t.fb][1]}"></textarea><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap"><small class="muted">No downvotes here. Something off? <a href="guidelines.html#report">Report it</a>.</small><button class="btn" data-toast="Replies are disabled in this demo">${ic('send')} Post reply</button></div></div>`;reveal();},
    challenges(){$('#chgrid').innerHTML=D.challenges.map(c=>`<div class="card hov reveal">${`<div class="art">${window.vgArt(c.seed,c.kind,'challenge-'+c.num)}<span class="ribbon ${c.status==='live'?'hot':''}">${c.status==='live'?ic('flame')+' live now':c.status==='judging'?ic('clock')+' judging':ic('trophy')+' winners picked'}</span></div>`}<div class="body"><span class="kicker">challenge #${c.num}</span><h3>${esc(c.title)}</h3><p>${esc(c.blurb)}</p><div class="meta"><span class="avatars">${D.members.slice(c.num%5,c.num%5+4).map(m=>av(m.handle)).join('')}</span><span>${40+c.num*7} entries</span></div><a class="btn sm ${c.status==='live'?'':'ghost'}" style="margin-top:10px;align-self:flex-start" href="#" data-toast="Challenge pages are placeholders in this mockup">${c.status==='live'?'Join now':'See entries'} ${ic('arrow-right')}</a></div></div>`).join('');reveal();},
    learn(){$('#lgrid').innerHTML=D.guides.map(g=>`<a class="card guide reveal" href="#" data-toast="Guides are placeholders in this mockup"><div class="body"><div class="gi" style="color:${g.color};background:${g.color}1a">${ic(g.icon)}</div><span class="kicker" style="color:${g.color}">${esc(g.cat)}</span><h3>${esc(g.title)}</h3><div class="meta"><span>${ic('clock')} ${esc(g.time)}</span><span>${ic('book-open')} guide</span></div></div></a>`).join('');reveal();},
    async profile(){const m=D.members[0];$('#pav').outerHTML=av(m.handle,'lg');$('#pbadges').innerHTML=m.badges.map(b=>`<span class="badge">${esc(b)}</span>`).join('');
      const ps=await api.projects();$('#pprojects').innerHTML=ps.filter(p=>p.by===m.handle).concat(ps.slice(3,5)).map(p=>card(p)).join('');
      const ts=await api.threads();$('#pthreads').innerHTML=[ts[2],ts[0]].map(threadRow).join('');reveal();},
    submit(){wizard();}
  };

  /* ---------- submit wizard ---------- */
  const PATTERNS=[[/sk-(?:proj-|ant-)?[A-Za-z0-9_\-]{16,}/g,'OpenAI/Anthropic-style key (sk-…)'],[/xai-[A-Za-z0-9]{20,}/g,'xAI-style key (xai-…)'],[/gh[pousr]_[A-Za-z0-9]{20,}/g,'GitHub token (ghp_…)'],[/github_pat_[A-Za-z0-9_]{20,}/g,'GitHub fine-grained token'],[/AKIA[0-9A-Z]{16}/g,'AWS access key ID (AKIA…)'],[/AIza[0-9A-Za-z_\-]{30,}/g,'Google API key (AIza…)'],[/xox[abpr]-[A-Za-z0-9\-]{10,}/g,'Slack token (xox…)'],[/-----BEGIN [A-Z ]*PRIVATE KEY-----/g,'Private key block'],[/\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{4,}/gi,'Hard-coded password/secret']];
  function scanSecrets(fields){const hits=[];for(const [label,v] of Object.entries(fields))for(const [re,name] of PATTERNS){re.lastIndex=0;let m;while((m=re.exec(v||''))){const s=m[0];hits.push(`${label}: ${name} → ${s.slice(0,6)}${'•'.repeat(Math.min(10,Math.max(3,s.length-6)))}`);}}return hits;}
  window.VG.scanSecrets=scanSecrets;
  function wizard(){const wiz=$('#wizard');let step=1;const max=3,next=$('#next'),back=$('#back');
    $('#tools-opts').innerHTML=D.tools.map(t=>`<label><input type="checkbox" name="tools" value="${esc(t.name)}"><span><i style="width:8px;height:8px;border-radius:50%;background:${t.color};display:inline-block"></i>${esc(t.name)}</span></label>`).join('');
    $('#tags-opts').innerHTML=['web app','game','bot','ai','music','creative','productivity','learning','fun','mobile','api','hardware'].map(t=>`<label><input type="checkbox" name="tags" value="${t}"><span>#${t}</span></label>`).join('');
    const pitch=$('#ppitch');pitch.addEventListener('input',()=>$('#pitchcount').textContent=`${pitch.value.length}/120`);
    const drop=$('#drop'),file=$('#pfile');drop.addEventListener('click',()=>file.click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();}});
    ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
    const preview=f=>{if(!f)return;$('#pfilename').textContent='✔ '+f.name+' (preview only, stays on your device)';const old=$('img',drop);old&&old.remove();if(f.type.startsWith('image/')){const im=new Image();im.src=URL.createObjectURL(f);im.alt='preview';drop.appendChild(im);}};
    drop.addEventListener('drop',e=>preview(e.dataTransfer.files[0]));file.addEventListener('change',()=>preview(file.files[0]));
    const val=()=>({name:$('#pname').value.trim(),pitch:pitch.value.trim(),link:$('#plink').value.trim(),repo:$('#prepo').value.trim(),code:$('#pcode').value,prompts:$('#pprompts').value,
      tools:$$('input[name=tools]:checked').map(i=>i.value),tags:$$('input[name=tags]:checked').map(i=>i.value),fb:($('input[name=fb]:checked')||{}).value||'vibes'});
    function show(){$$('.wstep').forEach(s=>s.classList.toggle('on',+s.dataset.step===step));$$('.step-pill').forEach(p=>{const n=+p.dataset.pill;p.classList.toggle('on',n===step);p.classList.toggle('done',n<step);});
      $('.progress i').style.width=(step/max*100)+'%';back.style.visibility=step>1?'visible':'hidden';next.innerHTML=step<max?`Next ${ic('arrow-right')}`:`${ic('rocket')} Publish`;
      $('#secretAlert').classList.remove('show');$('#okAlert').classList.remove('show');
      if(step===3){const v=val();$('#review').innerHTML=`<dt>name</dt><dd>${esc(v.name)}</dd><dt>pitch</dt><dd>${esc(v.pitch)||'<span class="muted">none</span>'}</dd><dt>link</dt><dd>${esc(v.link)||'<span class="muted">none</span>'}</dd><dt>code</dt><dd>${v.repo?esc(v.repo):v.code?`${v.code.split('\n').length} lines pasted`:'<span class="muted">none</span>'}</dd>`;}}
    const fieldErr=(id,msg)=>{const w=$('#'+id).closest('.inp');w.classList.toggle('err',!!msg);const h=w.parentElement.querySelector('.hint');if(h){h.textContent=msg||h.dataset.def||'';h.classList.toggle('err',!!msg);}};
    next.addEventListener('click',()=>{const v=val();
      if(step===1){fieldErr('pname',v.name?'':'Give your project a name ✨');const bad=v.link&&!/^https?:\/\/\S+\.\S+/.test(v.link);fieldErr('plink',bad?'That doesn\u2019t look like a link (start with https://)':'');if(!v.name||bad){toast('A couple of things need a look','warn');return;}}
      if(step===2){const bad=v.repo&&!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(v.repo);fieldErr('prepo',bad?'Use a full GitHub URL like https://github.com/you/project':'');if(bad)return;}
      if(step<max){step++;show();wiz.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});return;}
      const hits=scanSecrets({'Project name':v.name,'Pitch':v.pitch,'Live link':v.link,'Repo URL':v.repo,'Code':v.code,'Prompts':v.prompts});
      if(hits.length){$('#secretList').innerHTML=hits.map(h=>`<li>${esc(h)}</li>`).join('');$('#secretAlert').classList.add('show');$('#okAlert').classList.remove('show');toast('Possible secret found. Not published','warn');return;}
      $('#secretAlert').classList.remove('show');window.VG.onPublish?window.VG.onPublish(v):($('#okAlert').classList.add('show'),toast('Published! (demo, nothing was sent)'));});
    back.addEventListener('click',()=>{if(step>1){step--;show();}});show();
    window.VG.onPublish=async v=>{const fbName=FB[v.fb][0];let code=v.code.trim();const limit=3500;let cut=false;if(code.length>limit){code=code.slice(0,limit);cut=true;}
      const body=[C.projectMarker,'','### Pitch',v.pitch||'_No response_','','### Live link',v.link||'_No response_','','### Repo',v.repo||'_No response_','','### Tools',v.tools.join(', ')||'_No response_','','### Tags',v.tags.join(', ')||'_No response_','','### Feedback wanted',`${FB[v.fb][1]} ${fbName}`,'','### Code',code?'```\n'+code+'\n```'+(cut?'\n_(trimmed, paste the rest below)_':''):'_No response_','','### Prompts',v.prompts.trim()?v.prompts.trim().split(/\n+/).map(x=>'- '+x).join('\n'):'_No response_','','---','_Posted from the Vibe Garage submit form. Add a screenshot by dragging it into this box!_'].join('\n');
      const url=api.newDiscussionUrl(await api.categorySlug('projects'),'[Project] '+v.name,body);
      $('#okAlert div').innerHTML=`<b>Looks clean! One last step on GitHub.</b> No secrets spotted. We opened a pre-filled post in a new tab. Sign in with GitHub, add your screenshot, and hit <b>Start discussion</b>. Your project shows up in the gallery shortly after.<p style="margin:12px 0 0"><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">${ic('external-link')} Open the GitHub post</a></p>`;
      $('#okAlert').classList.add('show');window.VG.lastSubmitUrl=url;const w=window.open(url,'_blank');if(w)w.opener=null;toast(!w?'Pop-up blocked. Use the button below':'Opened GitHub to finish posting',w===null?'warn':'ok');};}

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded',()=>{globals();const p=document.body.dataset.page;(pages[p]||(()=>reveal()))();reveal();});
})();
