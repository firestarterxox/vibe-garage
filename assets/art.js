/* Generative cover art for projects: gradient-mesh glow + mock app window with fake UI.
   Pure SVG, deterministic per seed, no external images. */
(function(){
  let uid=0;
  function rng(seed){let h=1779033703^seed.length;for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
    return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};}
  const PAL=["#ff4fa3","#2ee6d6","#ff9a3d","#9b7bff","#ffd166","#ff6a73"];
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const bar=(x,y,w,h,f,o=1,r)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r??h/2}" fill="${f}" opacity="${o}"/>`;
  const KINDS={
    todo(R,c,id){let s=`<text x="0" y="26" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="30" fill="#fff">Today</text>${bar(420,8,110,22,c[0],.9)}`;
      for(let i=0;i<5;i++){const y=60+i*48,done=i<2;s+=`<rect x="0" y="${y}" width="540" height="38" rx="12" fill="#fff" opacity=".05"/><rect x="12" y="${y+9}" width="20" height="20" rx="6" fill="${done?c[1]:"none"}" stroke="${done?c[1]:"#fff"}" stroke-opacity=".5" stroke-width="2"/>${done?`<path d="M17 ${y+19}l4 4 7-8" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round"/>`:""}${bar(46,y+14,120+R()*250,10,"#fff",done?.25:.7)}${bar(470,y+12,52,14,c[i%3],.6)}`;}return s;},
    chat(R,c){let s="";const rows=[[0,260],[1,200],[0,300],[1,160],[0,220]];rows.forEach(([me,w],i)=>{const y=i*60,x=me?540-w:44;
      if(!me)s+=`<circle cx="16" cy="${y+22}" r="16" fill="${c[1]}"/><text x="16" y="${y+28}" font-size="16" text-anchor="middle">🌿</text>`;
      s+=`<rect x="${x}" y="${y}" width="${w}" height="46" rx="18" fill="${me?`url(#g${uid})`:"#fff"}" opacity="${me?1:.09}"/>${bar(x+16,y+14,w*.7,8,me?"#1a0f14":"#fff",me?.5:.6)}${bar(x+16,y+28,w*.45,6,me?"#1a0f14":"#fff",me?.35:.35)}`;});return s;},
    music(R,c){let s="";for(let i=0;i<54;i++){const h=10+Math.abs(Math.sin(i*.45+R()*2))*120*R()+20;s+=bar(i*10,150-h/2,6,h,i<30?c[0]:"#fff",i<30?.9:.25,3);}
      let p="M0 260";for(let x=0;x<=540;x+=30)p+=` Q${x+15} ${230+R()*60-30} ${x+30} ${250+R()*30-15}`;
      return s+`<path d="${p}" stroke="${c[1]}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="270" cy="150" r="34" fill="#fff"/><path d="M260 132v36l30-18z" fill="#1a0f14"/>`;},
    game(R,c){let s="";const cols=12,rows=7,t=44;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const wall=x==0||y==0||x==cols-1||y==rows-1||R()<.12;s+=`<rect x="${x*t+2}" y="${y*t+2}" width="${t-4}" height="${t-4}" rx="8" fill="${wall?c[3]:"#fff"}" opacity="${wall?.55:.05}"/>`;}
      for(let i=0;i<5;i++)s+=`<circle cx="${(2+Math.floor(R()*8))*t+22}" cy="${(1+Math.floor(R()*5))*t+22}" r="8" fill="${c[4]}"/>`;
      return s+`<rect x="${3*t+8}" y="${3*t+8}" width="28" height="28" rx="8" fill="${c[0]}" filter="url(#glow${uid})"/><rect x="${9*t+4}" y="${2*t+4}" width="36" height="36" rx="6" fill="${c[1]}"/><text x="${9*t+22}" y="${2*t+28}" font-size="18" text-anchor="middle">📺</text>`;},
    poem(R,c){let s=`<path d="M0 0h190v300l-12-10-12 10-12-10-12 10-12-10-12 10-12-10-12 10-12-10-12 10-12-10-12 10-12-10-12 10-12-10-10 10z" fill="#f4efe6"/>`;
      for(let i=0;i<9;i++)s+=bar(18,22+i*28,60+R()*60,7,"#3a3340",.55)+bar(150,22+i*28,22,7,"#3a3340",.55);
      return s+`<g font-family="Space Grotesk,sans-serif" font-weight="700" fill="#fff"><text x="230" y="80" font-size="30">oat milk, again,</text><text x="230" y="130" font-size="30" fill="${c[0]}">three limes for a sad</text><text x="230" y="180" font-size="30">taco tuesday</text></g>${bar(230,220,140,10,c[1],.8)}`;},
    chart(R,c){let s=`<rect x="0" y="0" width="120" height="300" rx="14" fill="#fff" opacity=".05"/>`;for(let i=0;i<6;i++)s+=bar(18,22+i*36,60+R()*30,10,i==1?c[1]:"#fff",i==1?.9:.3);
      for(let i=0;i<8;i++){const h=40+R()*170;s+=bar(150+i*48,280-h,30,h,i==5?c[0]:c[1],i==5?1:.35,8);}
      let p="M150 200";for(let i=1;i<8;i++)p+=` L${165+i*48} ${80+R()*120}`;return s+`<path d="${p}" stroke="${c[2]}" stroke-width="3" fill="none"/>`;},
    weather(R,c){const px=(x,y,f)=>`<rect x="${300+x*16}" y="${120+y*16}" width="16" height="16" fill="${f}"/>`;let pet="";
      const m=["..1111..",".122221.","12322321","12222221","12444421",".122221.","..1..1.."];m.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch!=".")pet+=px(x,y,{1:"#2a2333",2:c[1],3:"#111",4:c[0]}[ch]);}));
      return `<circle cx="90" cy="90" r="60" fill="${c[4]}" filter="url(#glow${uid})"/><text x="0" y="260" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="70" fill="#fff">72°</text>${bar(150,232,90,10,"#fff",.4)}${pet}${bar(296,108,136,16,c[0],1,4)}`;},
    cards(R,c){let s="";[[-8,c[3],.5],[4,c[1],.7],[0,"#fff",1]].forEach(([rot,f,o],i)=>{s+=`<g transform="rotate(${rot} 270 150)"><rect x="110" y="${30+i*6}" width="320" height="220" rx="22" fill="${f}" opacity="${i==2?.95:o*.6}"/></g>`;});
      return s+`<text x="270" y="120" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="22" fill="#1a1622">What does SM-2 schedule?</text>${bar(190,150,160,10,"#1a1622",.25)}<rect x="200" y="196" width="140" height="36" rx="18" fill="${c[0]}"/><text x="270" y="220" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600" font-size="15" fill="#1a0f14">Flip card</text>`;},
    generic(R,c){let s="";for(let i=0;i<3;i++)s+=`<rect x="${i*184}" y="0" width="172" height="110" rx="14" fill="#fff" opacity=".06"/>${bar(i*184+16,20,70,8,"#fff",.4)}<text x="${i*184+16}" y="80" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="34" fill="${c[i]}">${Math.floor(R()*90+10)}</text>`;
      return s+`<rect x="0" y="130" width="540" height="170" rx="14" fill="#fff" opacity=".05"/>`+Array.from({length:6},(_,i)=>bar(20,152+i*24,200+R()*300,8,"#fff",.25)).join("");}
  };
  window.vgArt=function(seed,kind,label){uid++;const R=rng(seed||"x");const off=Math.floor(R()*PAL.length);const c=PAL.slice(off).concat(PAL.slice(0,off));
    let blobs="";for(let i=0;i<4;i++)blobs+=`<circle cx="${R()*800}" cy="${R()*500}" r="${160+R()*160}" fill="${c[i]}" opacity="${.55+R()*.3}"/>`;
    const tilt=(R()*6-3).toFixed(1),k=KINDS[kind]?kind:"generic";
    return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label||"")} cover art">
<defs><filter id="b${uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter><filter id="glow${uid}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="8" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="g${uid}" x1="0" x2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ff9a3d"/></linearGradient>
<linearGradient id="w${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2533" stop-opacity=".92"/><stop offset="1" stop-color="#15121b" stop-opacity=".96"/></linearGradient>
<pattern id="d${uid}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" opacity=".12"/></pattern></defs>
<rect width="800" height="500" fill="#16121c"/><g filter="url(#b${uid})">${blobs}</g><rect width="800" height="500" fill="url(#d${uid})"/>
<g transform="rotate(${tilt} 400 270)"><rect x="104" y="74" width="592" height="396" rx="22" fill="#000" opacity=".35" transform="translate(0 16)"/>
<rect x="104" y="64" width="592" height="396" rx="22" fill="url(#w${uid})" stroke="#fff" stroke-opacity=".14"/>
<circle cx="132" cy="90" r="6" fill="#ff5f57"/><circle cx="152" cy="90" r="6" fill="#febc2e"/><circle cx="172" cy="90" r="6" fill="#28c840"/>
<rect x="290" y="78" width="220" height="24" rx="12" fill="#fff" opacity=".07"/><text x="400" y="95" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="12" fill="#fff" opacity=".6">${esc((label||"app").toLowerCase().replace(/[^a-z0-9]+/g,"-"))}.app</text>
<line x1="104" y1="116" x2="696" y2="116" stroke="#fff" stroke-opacity=".08"/><g transform="translate(130 140)">${KINDS[k](R,c,uid)}</g></g></svg>`;};
})();
