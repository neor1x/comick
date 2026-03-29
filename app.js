// ComicK — Webtoon/Manga reader for Blogger (Preact + htm)
;(function(){
'use strict';
var h=preact.h,render=preact.render;
var useState=preactHooks.useState,useEffect=preactHooks.useEffect,useRef=preactHooks.useRef,useCallback=preactHooks.useCallback;
var html=htm.bind(h);

/* ── Config ─────────────────────────────────────── */
var C={
  blogUrl:location.origin,
  secs:[
    {label:'Ongoing',title:'Last Added Chapters',badge:'ON AIR'},
    {label:'Completed',title:'Completed Series',badge:'END'},
    {label:'Manhwa',title:'Popular Manhwa',badge:'MANHWA'},
    {label:'Manga',title:'Popular Manga',badge:'MANGA'}
  ],
  max:50,
  labels:['Ongoing','Completed','Manhwa','Manga'],
  bmCats:['Reading','Completed','On Hold','Dropped']
};

/* ── Router ─────────────────────────────────────── */
function route(){return location.hash.slice(1)||'/';}
function go(p){location.hash=p;}
function useRouter(){
  var s=useState(route()),r=s[0],set=s[1];
  useEffect(function(){var f=function(){set(route());};addEventListener('hashchange',f);return function(){removeEventListener('hashchange',f);};},[]);
  return r;
}

/* ── Storage ────────────────────────────────────── */
var SK='comick_u';
function ld(){try{return JSON.parse(localStorage.getItem(SK))||{};}catch(e){return {};}}
function sv(d){try{localStorage.setItem(SK,JSON.stringify(d));}catch(e){}}
function udata(){
  var d=ld();
  if(!d.bm||Array.isArray(d.bm)){var o=Array.isArray(d.bm)?d.bm:[];d.bm={};C.bmCats.forEach(function(c){d.bm[c]=[];});if(o.length)d.bm.Reading=o;sv(d);}
  C.bmCats.forEach(function(c){if(!d.bm[c])d.bm[c]=[];});
  if(!d.hist)d.hist=[];
  return d;
}
function addBm(slug,title,thumb,cat){
  var d=udata();C.bmCats.forEach(function(c){d.bm[c]=d.bm[c].filter(function(b){return b.s!==slug;});});
  if(!d.bm[cat])d.bm[cat]=[];d.bm[cat].unshift({s:slug,t:title,i:thumb,a:Date.now()});sv(d);return d;
}
function rmBm(slug){var d=udata();C.bmCats.forEach(function(c){d.bm[c]=d.bm[c].filter(function(b){return b.s!==slug;});});sv(d);return d;}
function getBmCat(slug){var d=udata();for(var i=0;i<C.bmCats.length;i++){var c=C.bmCats[i];if(d.bm[c].some(function(b){return b.s===slug;}))return c;}return null;}
function addHist(slug,title,thumb,ch){var d=udata();d.hist=d.hist.filter(function(h){return h.s!==slug;});d.hist.unshift({s:slug,t:title,i:thumb,c:ch,d:Date.now()});if(d.hist.length>50)d.hist=d.hist.slice(0,50);sv(d);return d;}

/* ── Blogger Feed ───────────────────────────────── */
var fc={},apc=null;
function fetchLabel(label){
  if(fc[label])return Promise.resolve(fc[label]);
  var u=C.blogUrl+'/feeds/posts/default/-/'+encodeURIComponent(label)+'?alt=json&max-results='+C.max;
  return fetch(u).then(function(r){return r.json();}).then(function(j){
    var p=(j.feed.entry||[]).map(parse);fc[label]=p;return p;
  }).catch(function(){return[];});
}
function fetchAll(){
  if(apc)return Promise.resolve(apc);
  return Promise.all(C.secs.map(function(s){return fetchLabel(s.label);})).then(function(res){
    var a=[],seen={};res.forEach(function(ps){ps.forEach(function(p){if(!seen[p.id]){seen[p.id]=1;a.push(p);}});});
    apc=a;return a;
  });
}

/* ── Parser ─────────────────────────────────────── */
function parse(e){
  var t=e.title.$t||'',raw=e.content?e.content.$t:'';
  var pub=e.published.$t||'',upd=e.updated?e.updated.$t:pub;
  var labels=e.category?e.category.map(function(c){return c.term;}):[],id=e.id.$t||'';
  var images=[],links=[];
  var m=raw.match(/<div[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if(m){try{var j=JSON.parse(m[1].trim()),d=j.data||j;images=Array.isArray(d.images)?d.images:[];links=Array.isArray(d.links)?d.links:[];}catch(x){}}
  var thumb='';
  if(e['media$thumbnail'])thumb=e['media$thumbnail'].url.replace(/\/s\d+(-c)?\//,'/s400/');
  if(!thumb){var im=raw.match(/<img[^>]+src=["']([^"']+)["']/i);if(im)thumb=im[1];}
  if(thumb)thumb=thumb.replace(/\/s\d+(-c)?\//,'/s400/');
  var slug=t.replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
  return {id:id,title:t,pub:pub,upd:upd,labels:labels,thumb:thumb,images:images,links:links,slug:slug};
}
function fmtDate(s){if(!s)return'';var d=new Date(s),m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return m[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();}
function baseName(t){return t.replace(/\s*[-–]\s*\d+.*$/i,'').replace(/\s*ch(?:apter)?\s*\d+.*$/i,'').replace(/\s*ep(?:isode)?\s*\d+.*$/i,'').trim()||t;}
function group(posts){
  var map={};
  posts.forEach(function(p){
    var b=baseName(p.title),k=b.toLowerCase();
    if(!map[k])map[k]={title:b,slug:b.replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF]+/g,'-').replace(/^-|-$/g,'').toLowerCase(),thumb:p.thumb,labels:p.labels.slice(),pub:p.pub,upd:p.upd,chs:[]};
    map[k].chs.push(p);
    p.labels.forEach(function(l){if(map[k].labels.indexOf(l)===-1)map[k].labels.push(l);});
    if(p.pub>map[k].pub||p.upd>map[k].upd){map[k].pub=p.pub;map[k].upd=p.upd;if(p.thumb)map[k].thumb=p.thumb;}
  });
  Object.keys(map).forEach(function(k){map[k].chs.sort(function(a,b){return(parseInt((a.title.match(/(\d+)/)||[])[1])||0)-(parseInt((b.title.match(/(\d+)/)||[])[1])||0);});});
  return Object.keys(map).map(function(k){return map[k];});
}
function pmatch(t,q){if(!q)return false;t=t.toLowerCase();q=q.toLowerCase().trim();var qw=q.split(/\s+/);return qw.every(function(w){return t.indexOf(w)!==-1;});}

/* ── Drag helper ────────────────────────────────── */
function useDrag(ref){
  var st=useRef({down:false,sx:0,sl:0,moved:false});
  var down=useCallback(function(e){var el=ref.current;if(!el)return;st.current={down:true,moved:false,sx:e.pageX-el.offsetLeft,sl:el.scrollLeft};el.style.cursor='grabbing';},[]);
  var up=useCallback(function(){st.current.down=false;if(ref.current)ref.current.style.cursor='grab';},[]);
  var move=useCallback(function(e){if(!st.current.down)return;e.preventDefault();var el=ref.current;if(!el)return;var w=(e.pageX-el.offsetLeft-st.current.sx)*1.5;if(Math.abs(w)>5)st.current.moved=true;el.scrollLeft=st.current.sl-w;},[]);
  var dragged=useCallback(function(){return st.current.moved;},[]);
  return{down:down,up:up,leave:up,move:move,dragged:dragged};
}

/* ── Lazy image ─────────────────────────────────── */
function Img(p){
  var s=useState(false),ok=s[0],set=s[1];var s2=useState(false),iv=s2[0],siv=s2[1];var r=useRef();
  useEffect(function(){if(!r.current)return;if(!('IntersectionObserver' in window)){siv(true);return;}var o=new IntersectionObserver(function(e){if(e[0].isIntersecting){siv(true);o.disconnect();}},{rootMargin:'200px'});o.observe(r.current);return function(){o.disconnect();};},[]);
  return html`<img ref=${r} class=${p.c||''} src=${iv?p.s:''} alt=${p.a||''} style=${ok?'opacity:1;transition:opacity .3s':'opacity:0'} onLoad=${function(){set(true);}} loading="lazy"/>`;
}

/* ── Hero Carousel ──────────────────────────────── */
function Hero(p){
  var items=p.items||[];var s=useState(0),idx=s[0],si=s[1];var tm=useRef();
  useEffect(function(){if(items.length<2)return;tm.current=setInterval(function(){si(function(i){return(i+1)%items.length;});},5000);return function(){clearInterval(tm.current);};},[items.length]);
  if(!items.length)return html`<div class="sec"><div class="sk" style="height:28rem;border-radius:12px"></div></div>`;
  var it=items[idx],img=it.thumb?it.thumb.replace(/\/s\d+(-c)?\//,'/s800/'):'';
  var st=it.labels.find(function(l){return C.labels.indexOf(l)!==-1;})||'';
  var gl=it.labels.filter(function(l){return C.labels.indexOf(l)===-1;}).slice(0,3);
  var cls=['tag-blue','tag-green','tag-purple'];
  return html`<div class="sec" style="padding-top:20px">
    <div class="slider-item" style=${'background-image:url('+img+')'} onClick=${function(){go('/title/'+encodeURIComponent(it.slug));}}>
      <div class="slider-overlay"></div>
      <div class="slider-body">
        <div class="slider-tags">
          ${st&&html`<span class="tag tag-green">${st}</span>`}
          ${gl.map(function(l,i){return html`<span class="tag ${cls[i%3]}" key=${l}>${l}</span>`;})}
          <span class="tag tag-blue">${it.chs.length} Ch</span>
        </div>
        <h1>${it.title}</h1>
        <p>${it.title} — ${it.chs.length} chapters available. Updated ${fmtDate(it.upd||it.pub)}.</p>
        <button class="slider-btn" onClick=${function(e){e.stopPropagation();go('/title/'+encodeURIComponent(it.slug));}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          View Detail
        </button>
      </div>
    </div>
    ${items.length>1&&html`<div class="dots">${items.map(function(_,i){return html`<div class=${'dot'+(i===idx?' on':'')} key=${i} onClick=${function(){si(i);clearInterval(tm.current);}}></div>`;})}</div>`}
  </div>`;
}

/* ── Cards ──────────────────────────────────────── */
function MangaCard(p){
  var it=p.item,oc=p.onClick;
  var st=it.labels.find(function(l){return C.labels.indexOf(l)!==-1;})||'Ongoing';
  var tp=it.labels.find(function(l){return l==='Manhwa'||l==='Manga'||l==='Manhua';})||'Manga';
  return html`<div class="mc" onClick=${function(){oc(it);}}>
    <${Img} s=${it.thumb} a=${it.title} c=""/>
    <div class="mc-body"><div class="mc-info">
      <h3>${it.title}</h3>
      <p>${it.title} — ${it.chs.length} chapters. Updated ${fmtDate(it.upd||it.pub)}.</p>
    </div>
    <div class="mc-foot">
      <span class="mc-tag"><b class="c-green"></b> ${st}</span>
      <span class="mc-tag"><b class="c-gray"></b> ${it.chs.length} Ch</span>
      <span class="mc-tag"><b class="c-blue"></b> ${tp}</span>
    </div></div>
  </div>`;
}
function MiniCard(p){
  var it=p.item,oc=p.onClick;
  var st=it.labels.find(function(l){return C.labels.indexOf(l)!==-1;})||'Ongoing';
  var tp=it.labels.find(function(l){return l==='Manhwa'||l==='Manga'||l==='Manhua';})||'Manga';
  return html`<div class="mi" onClick=${function(){oc(it);}}>
    <${Img} s=${it.thumb} a=${it.title} c=""/>
    <div class="mi-body"><h3>${it.title}</h3>
      <div class="mi-tags">
        <span class="mi-tag"><b class="c-green"></b> ${st}</span>
        <span class="mi-tag"><b class="c-gray"></b> ${it.chs.length} Ch</span>
        <span class="mi-tag"><b class="c-blue"></b> ${tp}</span>
      </div>
    </div>
  </div>`;
}
function BrowseCard(p){
  var it=p.item,oc=p.onClick;
  return html`<div class="bc" onClick=${function(){oc(it);}}>
    <${Img} s=${it.thumb} a=${it.title} c=""/>
    <h3>${it.title}</h3>
    <span>${it.chs.length} Chapter${it.chs.length!==1?'s':''}</span>
  </div>`;
}
function Skel(p){var n=p.n||4,w=p.w||'160px',ht=p.h||'260px';return html`${Array.from({length:n},function(_,i){return html`<div key=${i} class="sk" style=${'width:'+w+';height:'+ht+';flex-shrink:0'}></div>`;})}`;}

/* ── Slider Section ─────────────────────────────── */
function Sec(p){
  var Card=p.card||MangaCard,items=p.items,loading=p.loading,oc=p.onClick,skW=p.skW||'400px',skH=p.skH||'250px';
  var ref=useRef(),dr=useDrag(ref);
  var scroll=useCallback(function(d){var el=ref.current;if(el)el.scrollBy({left:d*380,behavior:'smooth'});},[]);
  var click=useCallback(function(it){if(!dr.dragged())oc(it);},[oc]);
  if(!loading&&(!items||!items.length))return null;
  return html`<div class="sec">
    <div class="sec-head"><h2>${p.title}</h2></div>
    <div class="track-wrap">
      <button class="arr arr-l" onClick=${function(){scroll(-1);}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
      <div class="track" ref=${ref} onMouseDown=${dr.down} onMouseLeave=${dr.leave} onMouseUp=${dr.up} onMouseMove=${dr.move}>
        ${loading?html`<${Skel} n=${4} w=${skW} h=${skH}/>`:items.map(function(it){return html`<${Card} key=${it.slug} item=${it} onClick=${click}/>`;})}
      </div>
      <button class="arr arr-r" onClick=${function(){scroll(1);}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>
  </div>`;
}

/* ── Home ───────────────────────────────────────── */
function Home(p){
  var oc=p.onClick;
  var s1=useState([]),hero=s1[0],sh=s1[1];
  var s2=useState([]),last=s2[0],sl=s2[1];
  var s3=useState([]),pop=s3[0],sp=s3[1];
  var s4=useState([]),added=s4[0],sa=s4[1];
  var s5=useState(true),ld=s5[0],sld=s5[1];
  useEffect(function(){
    fetchAll().then(function(all){
      var g=group(all);
      var byCh=g.slice().sort(function(a,b){return b.chs.length-a.chs.length;});
      sh(byCh.slice(0,5));
      var byUpd=g.slice().sort(function(a,b){return b.upd>a.upd?1:-1;});
      sl(byUpd.slice(0,12));
      sp(byCh.slice(0,12));
      var byPub=g.slice().sort(function(a,b){return b.pub>a.pub?1:-1;});
      sa(byPub.slice(0,12));
      sld(false);
    });
  },[]);
  return html`<div class="wrap">
    <${Hero} items=${hero}/>
    <${Sec} title="Last Added Chapters" items=${last} loading=${ld} onClick=${oc} card=${MangaCard} skW="400px" skH="250px"/>
    <${Sec} title="Popular Series" items=${pop} loading=${ld} onClick=${oc} card=${MiniCard} skW="340px" skH="80px"/>
    <${Sec} title="Last Added Mangas" items=${added} loading=${ld} onClick=${oc} card=${MangaCard} skW="400px" skH="250px"/>
  </div>`;
}

/* ── Browse ─────────────────────────────────────── */
function Browse(p){
  var oc=p.onClick;
  var s1=useState([]),all=s1[0],sa=s1[1];
  var s2=useState(true),ld=s2[0],sld=s2[1];
  var s3=useState(''),q=s3[0],sq=s3[1];
  var s4=useState(null),al=s4[0],sal=s4[1];
  useEffect(function(){fetchAll().then(function(a){sa(group(a));sld(false);});},[]);
  var lc={};all.forEach(function(g){g.labels.forEach(function(l){lc[l]=(lc[l]||0)+1;});});
  var labs=Object.keys(lc).sort();
  var fil=all.filter(function(g){
    var mq=!q.trim()||pmatch(g.title,q)||g.labels.some(function(l){return pmatch(l,q);});
    var ml=!al||g.labels.indexOf(al)!==-1;
    return mq&&ml;
  });
  return html`<div class="browse wrap">
    <div class="br-banner">
      <div class="ov"></div>
      <div class="cnt">
        <h1>Find the series you're looking for!</h1>
        <p>The series you're looking for is just a few steps away.</p>
        <div class="br-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Discover the Series!" value=${q} onInput=${function(e){sq(e.target.value);}}/>
        </div>
      </div>
    </div>
    <div class="br-body">
      <div class="br-side">
        <div class=${'br-si'+(!al?' on':'')} onClick=${function(){sal(null);}}><span>All Series</span><em>${all.length}</em></div>
        <div class="br-div"></div>
        ${labs.map(function(l){return html`<div class=${'br-si'+(al===l?' on':'')} key=${l} onClick=${function(){sal(al===l?null:l);}}><span>${l}</span><em>${lc[l]}</em></div>`;})}
      </div>
      <div class="grid">
        ${ld?html`<${Skel} n=${12} w="100%" h="260px"/>`:fil.length?fil.map(function(it){return html`<${BrowseCard} key=${it.slug} item=${it} onClick=${oc}/>`;}):html`<p style="color:#52525b;grid-column:1/-1;padding:20px">No results</p>`}
      </div>
    </div>
  </div>`;
}

/* ── Mangas (all, alphabetical) ─────────────────── */
function Mangas(p){
  var oc=p.onClick;
  var s1=useState([]),all=s1[0],sa=s1[1];
  var s2=useState(true),ld=s2[0],sld=s2[1];
  useEffect(function(){fetchAll().then(function(a){var g=group(a);g.sort(function(a,b){return a.title.localeCompare(b.title);});sa(g);sld(false);});},[]);
  return html`<div class="browse wrap">
    <div class="br-banner"><div class="ov"></div><div class="cnt"><h1>All our series</h1><p>You can see all our translated series in alphabetical order here.</p></div></div>
    <div class="grid">${ld?html`<${Skel} n=${18} w="100%" h="260px"/>`:all.map(function(it){return html`<${BrowseCard} key=${it.slug} item=${it} onClick=${oc}/>`})}</div>
  </div>`;
}

/* ── Detail Page ────────────────────────────────── */
function Detail(p){
  var slug=p.slug;
  var s1=useState(null),it=s1[0],si=s1[1];
  var s2=useState(true),ld=s2[0],sld=s2[1];
  var s3=useState(null),bm=s3[0],sbm=s3[1];
  var s4=useState(false),bmm=s4[0],sbmm=s4[1];

  useEffect(function(){
    sld(true);si(null);
    fetchAll().then(function(a){
      var g=group(a),f=null;
      for(var i=0;i<g.length;i++){if(g[i].slug===slug){f=g[i];break;}}
      si(f);sbm(getBmCat(slug));sld(false);
    });
  },[slug]);
  useEffect(function(){scrollTo(0,0);},[slug]);

  var toggleBm=useCallback(function(cat){
    if(cat===bm){rmBm(slug);sbm(null);}
    else if(it){addBm(slug,it.title,it.thumb,cat);sbm(cat);}
    sbmm(false);
  },[bm,it,slug]);

  var readCh=useCallback(function(ch){
    if(it)addHist(slug,it.title,it.thumb,ch.title);
    go('/read/'+encodeURIComponent(ch.slug));
  },[it,slug]);

  if(ld)return html`<div class="det"><div class="sk" style="width:100%;height:16rem;border-radius:12px;margin-top:20px"></div></div>`;
  if(!it)return html`<div class="det" style="padding-top:40px"><h1 style="color:#fff">Not found</h1><p><a href="#/">← Home</a></p></div>`;

  var banner=it.thumb?it.thumb.replace(/\/s\d+(-c)?\//,'/s800/'):'';
  var cover=it.thumb?it.thumb.replace(/\/s\d+(-c)?\//,'/s400/'):'';
  var stLabel=it.labels.find(function(l){return C.labels.indexOf(l)!==-1;})||'Ongoing';
  var genres=it.labels.filter(function(l){return C.labels.indexOf(l)===-1;});

  return html`<div class="det">
    <div class="det-banner">
      ${banner&&html`<img src=${banner} alt=""/>`}
      <div class="ov"></div>
    </div>

    <div class="det-desk">
      <div class="det-cover">
        <img src=${cover} alt=${it.title}/>
        <div class="det-cover-actions">
          <div class="bm-wrap" style="flex:1">
            <div class="det-cover-btn" onClick=${function(){sbmm(!bmm);}}>${bm||'+ Add to List'}</div>
            ${bmm&&html`<div class="bm-menu">
              ${C.bmCats.map(function(c){return html`<button class=${'bm-opt'+(c===bm?' on':'')} key=${c} onClick=${function(){toggleBm(c);}}>${c}</button>`;})}
              ${bm&&html`<button class="bm-opt rm" onClick=${function(){toggleBm(bm);}}>Remove</button>`}
            </div>`}
          </div>
          <div class="det-cover-btn heart" onClick=${function(){toggleBm('Reading');}}>♥</div>
        </div>
        <div class="det-tags">${genres.map(function(l){return html`<div class="det-tag" key=${l}>${l}</div>`;})}</div>
        <div class="det-info">
          <div class="det-info-row"><span>Status</span><span>${stLabel}</span></div>
          <div class="det-info-row"><span>Chapters</span><span>${it.chs.length}</span></div>
          <div class="det-info-row"><span>Updated</span><span>${fmtDate(it.upd||it.pub)}</span></div>
        </div>
      </div>
      <div class="det-main">
        <h1>${it.title}</h1>
        <h2>Synopsis</h2>
        <p class="syn">${it.title} — ${it.chs.length} chapters available.</p>
        <h2>Chapters</h2>
        <div class="ch-grid">
          ${it.chs.map(function(ch,i){
            var n=(ch.title.match(/(\d+)/)||[])[1]||(i+1);
            return html`<div class="ch-card" key=${ch.id} onClick=${function(){readCh(ch);}}>
              <span>Chapter ${n}</span>
              <i>→</i>
            </div>`;
          })}
        </div>
      </div>
    </div>

    <div class="det-mob">
      <img class="cover" src=${cover} alt=${it.title}/>
      <h1>${it.title}</h1>
      <div class="tags">${genres.map(function(l){return html`<div class="det-tag" key=${l}>${l}</div>`;})}</div>
      <p class="syn">${it.title} — ${it.chs.length} chapters available.</p>
      <div style="width:100%;margin-top:20px;padding:0 8px">
        <h2 style="font-size:18px;color:#e4e4e7;margin-bottom:10px">Chapters</h2>
        <div class="ch-grid">
          ${it.chs.map(function(ch,i){
            var n=(ch.title.match(/(\d+)/)||[])[1]||(i+1);
            return html`<div class="ch-card" key=${ch.id} onClick=${function(){readCh(ch);}}>
              <span>Chapter ${n}</span><i>→</i>
            </div>`;
          })}
        </div>
      </div>
    </div>
  </div>`;
}

/* ── Reader ─────────────────────────────────────── */
function Reader(p){
  var slug=p.slug;
  var s1=useState(null),post=s1[0],sp=s1[1];
  var s2=useState(true),ld=s2[0],sld=s2[1];
  useEffect(function(){sld(true);fetchAll().then(function(a){sp(a.find(function(x){return x.slug===slug;})||null);sld(false);});},[slug]);
  useEffect(function(){scrollTo(0,0);},[slug]);
  if(ld)return html`<div class="reader"><div class="sk" style="width:100%;height:500px;border-radius:12px;margin-top:20px"></div></div>`;
  if(!post)return html`<div class="reader" style="padding-top:40px"><h1 style="color:#fff">Chapter not found</h1><p><a href="#/">← Home</a></p></div>`;
  var bn=baseName(post.title),ts=bn.replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
  return html`<div class="reader">
    <div class="reader-hdr">
      <a href=${'#/title/'+encodeURIComponent(ts)} style="color:#71717a;font-size:13px">← Back</a>
      <h3>${post.title}</h3>
    </div>
    <div class="reader-imgs">
      ${post.images.length?post.images.map(function(src,i){return html`<${Img} key=${i} s=${src} a=${'Page '+(i+1)} c=""/>`;}):html`<p style="color:#52525b;padding:40px;text-align:center">No images found for this chapter.</p>`}
    </div>
  </div>`;
}

/* ── Search ─────────────────────────────────────── */
function Search(p){
  var iq=p.q||'';var s1=useState(iq),q=s1[0],sq=s1[1];
  var s2=useState([]),res=s2[0],sr=s2[1];var s3=useState(false),ld=s3[0],sld=s3[1];
  var ag=useRef([]);
  useEffect(function(){sld(true);fetchAll().then(function(a){ag.current=group(a);if(iq)fil(iq);sld(false);});},[]);
  var fil=useCallback(function(v){if(!v.trim()){sr([]);return;}sr(ag.current.filter(function(g){return pmatch(g.title,v)||g.labels.some(function(l){return pmatch(l,v);});}));},[]);
  var inp=useCallback(function(e){var v=e.target.value;sq(v);fil(v);},[]);
  var oc=useCallback(function(it){go('/title/'+encodeURIComponent(it.slug));},[]);
  return html`<div class="srch wrap">
    <div class="srch-bar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#52525b" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input placeholder="Search titles, labels..." value=${q} onInput=${inp} autofocus/>
    </div>
    <div class="grid">${ld?html`<${Skel} n=${6} w="100%" h="260px"/>`:res.length?res.map(function(it){return html`<${BrowseCard} key=${it.slug} item=${it} onClick=${oc}/>`;}):q.trim()?html`<p style="color:#52525b;grid-column:1/-1;padding:20px">No results for "${q}"</p>`:html`<p style="color:#52525b;grid-column:1/-1;padding:20px">Start typing to search…</p>`}</div>
  </div>`;
}

/* ── Profile ────────────────────────────────────── */
function Profile(){
  var s1=useState(udata()),d=s1[0],sd=s1[1];
  var s2=useState('Reading'),tab=s2[0],st=s2[1];
  var s3=useState('bm'),sec=s3[0],ss=s3[1];
  var rf=useCallback(function(){sd(udata());},[]);
  return html`<div class="prof">
    <h1>My Library</h1>
    <div class="tabs">
      <button class=${'tab'+(sec==='bm'?' on':'')} onClick=${function(){ss('bm');}}>Bookmarks</button>
      <button class=${'tab'+(sec==='hist'?' on':'')} onClick=${function(){ss('hist');}}>History (${d.hist.length})</button>
    </div>
    ${sec==='bm'&&html`
      <div class="tabs" style="margin-bottom:10px">${C.bmCats.map(function(c){var n=(d.bm[c]||[]).length;return html`<button class=${'tab'+(tab===c?' on':'')} key=${c} onClick=${function(){st(c);}}>${c} (${n})</button>`;})}</div>
      <div class="rows">${!(d.bm[tab]||[]).length?html`<p style="color:#52525b;padding:16px 0">Empty</p>`:d.bm[tab].map(function(b){return html`<div class="row" key=${b.s}><a href=${'#/title/'+encodeURIComponent(b.s)} style="display:contents;color:inherit"><img src=${b.i} alt=""/><div class="row-info"><h4>${b.t}</h4></div></a><button style="background:none;border:none;color:#52525b;cursor:pointer;font-size:14px" onClick=${function(){rmBm(b.s);rf();}}>✕</button></div>`;})}</div>
    `}
    ${sec==='hist'&&html`
      ${d.hist.length>0&&html`<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="tab" onClick=${function(){var x=udata();x.hist=[];sv(x);rf();}}>Clear</button></div>`}
      <div class="rows">${!d.hist.length?html`<p style="color:#52525b;padding:16px 0">No history</p>`:d.hist.map(function(h){return html`<a class="row" href=${'#/title/'+encodeURIComponent(h.s)} key=${h.s+h.d}><img src=${h.i} alt=""/><div class="row-info"><h4>${h.t}</h4><small>${h.c||''} · ${fmtDate(new Date(h.d).toISOString())}</small></div></a>`;})}</div>
    `}
  </div>`;
}

/* ── Navbar ─────────────────────────────────────── */
function Nav(p){
  var r=p.route;var s=useState(false),mo=s[0],smo=s[1];
  var links=[{h:'#/',l:'Home'},{h:'#/browse',l:'Browse'},{h:'#/mangas',l:'Mangas'}];
  return html`<header class="hdr">
    <a href="#/" class="hdr-logo"><i>C</i> ComicK</a>
    <nav class=${'hdr-nav'+(mo?' open':'')}>
      ${links.map(function(lk){var on=r===lk.h.slice(1)||(lk.h==='#/'&&r==='/');return html`<a href=${lk.h} class=${on?'on':''} onClick=${function(){smo(false);}}>${lk.l}</a>`;})}
    </nav>
    <div class="hdr-right">
      <a href="#/search" class="hdr-icon" aria-label="Search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></a>
      <a href="#/profile" class="hdr-icon" aria-label="Library"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg></a>
    </div>
    <button class="hdr-toggle" onClick=${function(){smo(!mo);}}><span></span><span></span><span></span></button>
  </header>`;
}

/* ── App ────────────────────────────────────────── */
function App(){
  var r=useRouter();
  var oc=useCallback(function(it){go('/title/'+encodeURIComponent(it.slug));},[]);
  var pg;
  if(r==='/'||r==='')pg=html`<${Home} onClick=${oc}/>`;
  else if(r==='/browse')pg=html`<${Browse} onClick=${oc}/>`;
  else if(r==='/mangas')pg=html`<${Mangas} onClick=${oc}/>`;
  else if(r==='/profile')pg=html`<${Profile}/>`;
  else if(r.indexOf('/search')===0){var sq=decodeURIComponent(r.replace('/search/','').replace('/search',''));pg=html`<${Search} q=${sq}/>`;}
  else if(r.indexOf('/title/')===0)pg=html`<${Detail} slug=${decodeURIComponent(r.slice(7))}/>`;
  else if(r.indexOf('/read/')===0)pg=html`<${Reader} slug=${decodeURIComponent(r.slice(6))}/>`;
  else pg=html`<div class="prof"><h1>404</h1><p><a href="#/">← Home</a></p></div>`;
  return html`<div>
    <${Nav} route=${r}/>
    ${pg}
    <footer class="ftr"><span>© ${new Date().getFullYear()} All rights reserved.</span><span>Powered by Blogger · Built with Preact</span></footer>
  </div>`;
}

render(html`<${App}/>`,document.getElementById('root'));
})();
