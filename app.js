// ComicK — Manga reader powered by Blogger feeds
;(function(){
'use strict';
var h=preact.h,render=preact.render;
var useState=preactHooks.useState,useEffect=preactHooks.useEffect,useRef=preactHooks.useRef,useCallback=preactHooks.useCallback;
var html=htm.bind(h);

/* ── Config ─────────────────────────────────────────────── */
var C={
  blogUrl:(function(){var o=location.origin;if(location.pathname!=='/')o=location.protocol+'//'+location.host;return o;})(),
  sections:[
    {label:'Ongoing',title:'Ongoing Series'},
    {label:'Finished',title:'Completed'},
    {label:'Movie',title:'Movies'},
    {label:'OVA',title:'OVA / Special'},
  ],
  max:50,
  sectionLabels:['Ongoing','Movie','OVA','Finished'],
  premiumLabel:'Premium',
  bmCats:['Reading','Completed','On Hold','Dropped','Plan to Read'],
  ranks:[
    {n:'Free',c:'#555a68',m:0,i:'👤'},
    {n:'Bronze',c:'#cd7f32',m:1,i:'🥉'},
    {n:'Silver',c:'#c0c0c0',m:3,i:'🥈'},
    {n:'Gold',c:'#ffd700',m:6,i:'🥇'},
    {n:'Diamond',c:'#b9f2ff',m:12,i:'💎'},
  ],
  plans:[
    {id:'1m',l:'1 Month',m:1,p:'$4.99'},
    {id:'3m',l:'3 Months',m:3,p:'$12.99'},
    {id:'6m',l:'6 Months',m:6,p:'$22.99'},
    {id:'1y',l:'1 Year',m:12,p:'$39.99'},
  ],
};

/* ── Firebase ───────────────────────────────────────────── */
var FB={apiKey:"AIzaSyAHqVMnFAcbA13GrgVpT-nAhBgDLvc9uKc",authDomain:"animeflix-blogger.firebaseapp.com",projectId:"animeflix-blogger",storageBucket:"animeflix-blogger.firebasestorage.app",messagingSenderId:"307752501362",appId:"1:307752501362:web:448e299d92188ca75142eb"};
var fbOk=false,fbAuth=null,fbDb=null;
if(FB.apiKey){var sc=['https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js','https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js','https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'],ld=0;sc.forEach(function(u){var s=document.createElement('script');s.src=u;s.onload=function(){ld++;if(ld===sc.length)initFb();};document.head.appendChild(s);});}
function initFb(){if(typeof firebase==='undefined')return;try{if(!firebase.apps.length)firebase.initializeApp(FB);fbAuth=firebase.auth();fbDb=firebase.firestore();fbOk=true;}catch(e){}}

/* ── Local Storage / User Data ──────────────────────────── */
var SK='comick_user';
function ld(){try{return JSON.parse(localStorage.getItem(SK))||{};}catch(e){return {};}}
function sv(d){try{localStorage.setItem(SK,JSON.stringify(d));}catch(e){}}
function udata(){
  var d=ld();
  if(!d.bm||Array.isArray(d.bm)){var o=Array.isArray(d.bm)?d.bm:[];d.bm={};C.bmCats.forEach(function(c){d.bm[c]=[];});if(o.length)d.bm.Reading=o;sv(d);}
  C.bmCats.forEach(function(c){if(!d.bm[c])d.bm[c]=[];});
  if(!d.hist)d.hist=[];return d;
}
function usave(d){sv(d);if(fbOk&&fbAuth&&fbAuth.currentUser&&fbDb)fbDb.collection('users').doc(fbAuth.currentUser.uid).set({bm:d.bm||{},hist:d.hist||[]},{merge:true}).catch(function(){});}
function bmAdd(slug,title,thumb,cat){var d=udata();C.bmCats.forEach(function(c){d.bm[c]=(d.bm[c]||[]).filter(function(b){return b.s!==slug;});});if(!d.bm[cat])d.bm[cat]=[];d.bm[cat].unshift({s:slug,t:title,th:thumb,at:Date.now()});usave(d);return d;}
function bmRm(slug){var d=udata();C.bmCats.forEach(function(c){d.bm[c]=(d.bm[c]||[]).filter(function(b){return b.s!==slug;});});usave(d);return d;}
function bmCat(slug){var d=udata();for(var i=0;i<C.bmCats.length;i++){var c=C.bmCats[i];if((d.bm[c]||[]).some(function(b){return b.s===slug;}))return c;}return null;}
function histAdd(slug,title,thumb,ep){var d=udata();d.hist=d.hist.filter(function(h){return h.s!==slug;});d.hist.unshift({s:slug,t:title,th:thumb,ep:ep,at:Date.now()});if(d.hist.length>50)d.hist=d.hist.slice(0,50);usave(d);return d;}

/* ── Subscription / Rank ────────────────────────────────── */
function subInfo(doc){
  try{if(!doc||!doc.subscription)return{ok:false,rank:C.ranks[0],mo:0};var s=doc.subscription,now=Date.now(),exp=s.expiresAt;
  if(exp&&typeof exp==='object'&&exp.toMillis)exp=exp.toMillis();else if(exp&&typeof exp==='object'&&exp.seconds)exp=exp.seconds*1000;else exp=Number(exp)||0;
  var ok=exp>now,mo=Number(s.totalMonths)||0,r=C.ranks[0];for(var i=C.ranks.length-1;i>=0;i--)if(mo>=C.ranks[i].m){r=C.ranks[i];break;}return{ok:ok,rank:r,mo:mo,exp:exp};}catch(e){return{ok:false,rank:C.ranks[0],mo:0};}
}
function isPrem(doc){try{return subInfo(doc).ok;}catch(e){return false;}}

/* ── Auth ───────────────────────────────────────────────── */
function gSignIn(){if(!fbOk)return Promise.reject();return fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(function(r){return cloudSync().then(function(){return r.user;});});}
function gSignOut(){return fbOk?fbAuth.signOut():Promise.resolve();}
function cloudSync(){
  if(!fbOk||!fbAuth.currentUser)return Promise.resolve();
  return fbDb.collection('users').doc(fbAuth.currentUser.uid).get().then(function(doc){
    if(!doc.exists)return;var cl=doc.data(),lo=udata(),cb=cl.bm;if(Array.isArray(cb))cb={Reading:cb};
    if(cb&&typeof cb==='object')C.bmCats.forEach(function(c){(cb[c]||[]).forEach(function(x){if(!(lo.bm[c]||[]).some(function(y){return y.s===x.s;})){if(!lo.bm[c])lo.bm[c]=[];lo.bm[c].push(x);}});});
    (cl.hist||[]).forEach(function(x){if(!lo.hist.some(function(y){return y.s===x.s&&y.ep===x.ep;}))lo.hist.push(x);});
    lo.hist.sort(function(a,b){return(b.at||0)-(a.at||0);});lo.hist=lo.hist.slice(0,50);sv(lo);usave(lo);
  }).catch(function(){});
}
var authCbs=[],curUser=null,curDoc=null;
function useAuth(){var s=useState({u:curUser,d:curDoc,ld:true}),st=s[0],set=s[1];useEffect(function(){var fn=function(v){set(v);};authCbs.push(fn);if(!st.ld||curUser!==null)fn({u:curUser,d:curDoc,ld:false});return function(){authCbs=authCbs.filter(function(f){return f!==fn;});};},[]);return st;}
function authNotify(v){curUser=v.u;curDoc=v.d;authCbs.forEach(function(fn){fn(v);});}
function authStart(){if(!fbOk){authNotify({u:null,d:null,ld:false});return;}fbAuth.onAuthStateChanged(function(u){if(u){cloudSync();fbDb.collection('users').doc(u.uid).onSnapshot(function(doc){authNotify({u:u,d:doc.exists?doc.data():{},ld:false});});}else authNotify({u:null,d:null,ld:false});});}
var ai=setInterval(function(){if(fbOk||typeof firebase!=='undefined'){clearInterval(ai);authStart();}},200);
setTimeout(function(){clearInterval(ai);if(!fbOk)authNotify({u:null,d:null,ld:false});},5000);

/* ── Comments ───────────────────────────────────────────── */
function cmtLoad(slug){if(!fbOk||!fbDb)return Promise.resolve([]);return fbDb.collection('comments').doc(slug).collection('messages').orderBy('createdAt','desc').limit(50).get().then(function(s){return s.docs.map(function(d){var x=d.data();x._id=d.id;return x;});}).catch(function(){return[];});}
function cmtPost(slug,u,txt){if(!fbOk||!fbDb||!u)return Promise.reject();return fbDb.collection('comments').doc(slug).collection('messages').add({uid:u.uid,name:u.displayName||'Anon',avatar:u.photoURL||'',text:txt,createdAt:Date.now()});}
function mdRender(t){if(!t)return'';return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br/>');}

/* ── Router ─────────────────────────────────────────────── */
// On Blogger, ensure we stay on the root page for SPA routing.
// If user lands on a Blogger subpage (e.g. /2019/09/post.html), redirect to root.
(function(){
  var p=location.pathname;
  // Only redirect if on a Blogger post/archive page (has year/month pattern or .html)
  if(p.match(/\/\d{4}\//)|| (p.indexOf('.html')!==-1 && p!=='/index.html')){
    location.replace(location.protocol+'//'+location.host+'/'+(location.hash||''));
  }
})();
function route(){try{return decodeURIComponent(location.hash.slice(1))||'/';}catch(e){return location.hash.slice(1)||'/';}}
function go(p){location.hash='#'+p;window.scrollTo(0,0);}
function useRoute(){var s=useState(route()),r=s[0],set=s[1];useEffect(function(){var fn=function(){set(route());};addEventListener('hashchange',fn);return function(){removeEventListener('hashchange',fn);};},[]);return r;}

// Global click handler: intercept all <a href="#/..."> clicks so Blogger doesn't navigate away
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="#/"]');
  if(!a)return;
  e.preventDefault();
  e.stopPropagation();
  go(a.getAttribute('href').slice(1));
});

/* ── Blogger Feed ───────────────────────────────────────── */
var fc={},apc=null;
function feedLabel(label){if(fc[label])return Promise.resolve(fc[label]);return fetch(C.blogUrl+'/feeds/posts/default/-/'+encodeURIComponent(label)+'?alt=json&max-results='+C.max).then(function(r){return r.json();}).then(function(d){var p=(d.feed.entry||[]).map(parse);fc[label]=p;return p;}).catch(function(){return[];});}
function feedAll(){if(apc)return Promise.resolve(apc);return Promise.all(C.sections.map(function(s){return feedLabel(s.label);})).then(function(res){var a=[],seen={};res.forEach(function(ps){ps.forEach(function(p){if(!seen[p.id]){seen[p.id]=true;a.push(p);}});});apc=a;return a;});}

/* ── Parser ─────────────────────────────────────────────── */
function parse(e){
  var t=e.title.$t||'',raw=e.content?e.content.$t:'',pub=e.published.$t||'',upd=e.updated?e.updated.$t:pub;
  var labels=e.category?e.category.map(function(c){return c.term;}):[],id=e.id.$t||'';
  var vid='',links=[];var m=raw.match(/<div[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if(m){try{var j=JSON.parse(m[1].trim()),d=j.data||j;vid=d.video||'';links=Array.isArray(d.links)?d.links:[];}catch(x){}}
  if(vid&&vid.indexOf('//')===0)vid='https:'+vid;
  var th='';if(e['media$thumbnail'])th=e['media$thumbnail'].url.replace(/\/s\d+(-c)?\//,'/s400/');
  if(!th){var im=raw.match(/<img[^>]+src=["']([^"']+)["']/i);if(im)th=im[1];}
  if(th)th=th.replace(/\/s\d+(-c)?\//,'/s400/');
  var slug=t.replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
  var prem=labels.indexOf(C.premiumLabel)!==-1;
  return{id:id,title:t,pub:pub,upd:upd,labels:labels,th:th,vid:vid,links:links,slug:slug,prem:prem};
}
function fmtDate(s){if(!s)return'';var d=new Date(s),mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return mo[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();}
function ago(s){if(!s)return'';var d=Math.floor((Date.now()-new Date(s).getTime())/1000);if(d<60)return'now';if(d<3600)return Math.floor(d/60)+'m';if(d<86400)return Math.floor(d/3600)+'h';if(d<2592000)return Math.floor(d/86400)+'d';return Math.floor(d/2592000)+'mo';}
function baseName(t){return t.replace(/\s*[-–]\s*\d+[-\u0440].*$/i,'').replace(/\s+\d+[-\u0440].*$/i,'').replace(/\s*ep(?:isode)?\s*\d+.*$/i,'').replace(/\s*\d+[-–]\s*\u0440\s+\u0430\u043D\u0433\u0438.*$/i,'').trim()||t;}
function group(posts){
  var map={};posts.forEach(function(p){var b=baseName(p.title),k=b.toLowerCase();
  if(!map[k])map[k]={title:b,slug:b.replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF]+/g,'-').replace(/^-|-$/g,'').toLowerCase(),th:p.th,labels:p.labels.slice(),pub:p.pub,upd:p.upd,eps:[],prem:false};
  map[k].eps.push(p);if(p.prem)map[k].prem=true;
  p.labels.forEach(function(l){if(map[k].labels.indexOf(l)===-1)map[k].labels.push(l);});
  if(p.pub>map[k].pub||p.upd>map[k].upd){map[k].pub=p.pub;map[k].upd=p.upd;if(p.th)map[k].th=p.th;}});
  Object.keys(map).forEach(function(k){map[k].eps.sort(function(a,b){return(parseInt((a.title.match(/(\d+)/)||[])[1])||0)-(parseInt((b.title.match(/(\d+)/)||[])[1])||0);});});
  return Object.keys(map).map(function(k){return map[k];});
}
function match(text,q){if(!q)return false;text=text.toLowerCase();q=q.toLowerCase().trim();return q.split(/\s+/).every(function(w){return text.indexOf(w)!==-1;});}

/* ── Components ─────────────────────────────────────────── */
function Img(p){
  var s=useState(false),ok=s[0],set=s[1];var s2=useState(false),vis=s2[0],setV=s2[1];var ref=useRef();
  useEffect(function(){if(!ref.current)return;if(!('IntersectionObserver' in window)){setV(true);return;}var o=new IntersectionObserver(function(e){if(e[0].isIntersecting){setV(true);o.disconnect();}},{rootMargin:'200px'});o.observe(ref.current);return function(){o.disconnect();};},[]);
  return html`<img ref=${ref} class=${p.c} src=${vis?p.src:''} alt=${p.alt||''} style=${ok?'opacity:1':'opacity:0;transition:opacity .3s'} onLoad=${function(){set(true);}} loading="lazy"/>`;
}
function Skel(p){return html`${Array.from({length:p.n||6},function(_,i){return html`<div key=${i} class="skel skel-card"></div>`;})}`;}

function Card(p){
  var it=p.item,sub=p.sub;
  return html`<article class="card" onClick=${function(){p.onClick(it);}} role="button" tabindex="0" aria-label=${it.title}>
    <${Img} src=${it.th} alt=${it.title} c="card-cover"/>
    <div class="card-body"><div class="card-name">${it.title}</div>${sub&&html`<div class="card-sub">${sub}</div>`}<div class="card-time">${ago(it.upd||it.pub)}</div></div>
  </article>`;
}

/* ── Draggable scroll ───────────────────────────────────── */
function useDrag(ref){
  var st=useRef({down:false,sx:0,sl:0,moved:false});
  return{
    onMouseDown:useCallback(function(e){var el=ref.current;if(!el)return;st.current={down:true,moved:false,sx:e.pageX-el.offsetLeft,sl:el.scrollLeft};el.style.cursor='grabbing';},[]),
    onMouseUp:useCallback(function(){st.current.down=false;if(ref.current)ref.current.style.cursor='';},[]),
    onMouseLeave:useCallback(function(){st.current.down=false;if(ref.current)ref.current.style.cursor='';},[]),
    onMouseMove:useCallback(function(e){if(!st.current.down)return;e.preventDefault();var el=ref.current;if(!el)return;var w=(e.pageX-el.offsetLeft-st.current.sx)*1.5;if(Math.abs(w)>5)st.current.moved=true;el.scrollLeft=st.current.sl-w;},[]),
    dragged:useCallback(function(){return st.current.moved;},[])
  };
}

/* ── Home: Horizontal row section ───────────────────────── */
function HRow(p){
  var cfg=p.cfg,onClick=p.onClick;
  var s=useState([]),items=s[0],set=s[1];var s2=useState(true),busy=s2[0],setB=s2[1];
  var ref=useRef(),drag=useDrag(ref);
  useEffect(function(){feedLabel(cfg.label).then(function(ps){set(group(ps));setB(false);});},[cfg.label]);
  var click=useCallback(function(it){if(!drag.dragged())onClick(it);},[onClick]);
  if(!busy&&!items.length)return null;
  var ongoing=cfg.label==='Ongoing';
  return html`<section class="sec"><div class="container">
    <div class="sec-head"><h2 class="sec-title">${cfg.title}</h2></div>
    <div class="hrow" ref=${ref} onMouseDown=${drag.onMouseDown} onMouseUp=${drag.onMouseUp} onMouseLeave=${drag.onMouseLeave} onMouseMove=${drag.onMouseMove}>
      ${busy?html`<${Skel} n=${8}/>`:items.map(function(it){
        var sub=ongoing&&it.eps.length?'Ch. '+((it.eps[it.eps.length-1].title.match(/(\d+)/)||[])[1]||it.eps.length):it.eps.length+' chaps';
        return html`<${Card} key=${it.slug} item=${it} onClick=${click} sub=${sub}/>`;
      })}
    </div>
  </div></section>`;
}

/* ── Home: Updates feed ─────────────────────────────────── */
function Feed(p){
  var s=useState([]),posts=s[0],set=s[1];var s2=useState(true),busy=s2[0],setB=s2[1];
  useEffect(function(){feedAll().then(function(a){var sorted=a.slice().sort(function(a,b){return a.upd<b.upd?1:-1;});set(sorted.slice(0,30));setB(false);});},[]);
  if(busy)return html`<div class="feed"><${Skel} n=${4}/></div>`;
  return html`<div class="feed">${posts.map(function(p){
    var slug=baseName(p.title).replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
    var ch=(p.title.match(/(\d+)/)||[])[1]||'';
    return html`<a class="feed-row" href=${'#/title/'+slug} key=${p.id}>
      <img class="feed-thumb" src=${p.th} alt=""/>
      <div class="feed-info"><div class="feed-name">${baseName(p.title)}</div><div class="feed-meta">${ch&&html`<span class="feed-ch">Ch. ${ch}</span>`}<span>${ago(p.upd||p.pub)}</span></div></div>
    </a>`;
  })}</div>`;
}

/* ── Home: Popular sidebar ──────────────────────────────── */
function Popular(){
  var s=useState([]),items=s[0],set=s[1];var s2=useState(true),busy=s2[0],setB=s2[1];
  useEffect(function(){feedLabel('Ongoing').then(function(ps){var g=group(ps);g.sort(function(a,b){return b.eps.length-a.eps.length;});set(g.slice(0,12));setB(false);});},[]);
  return html`<div>
    <div class="ch-head">Popular Ongoing</div>
    ${busy?html`<${Skel} n=${3}/>`:html`<div class="ranked">${items.map(function(it,i){
      return html`<a class="ranked-row" href=${'#/title/'+it.slug} key=${it.slug}>
        <span class="ranked-num">${i+1}</span><img class="ranked-img" src=${it.th} alt=""/><span class="ranked-name">${it.title}</span>
      </a>`;
    })}</div>`}
  </div>`;
}

/* ── Home Page ──────────────────────────────────────────── */
function Home(p){
  var oc=p.onClick;
  return html`<div>
    ${C.sections.map(function(s){return html`<${HRow} key=${s.label} cfg=${s} onClick=${oc}/>`;})}
    <section class="sec"><div class="container">
      <div class="sec-head"><h2 class="sec-title">Updates</h2></div>
      <div class="home-split"><div class="home-main"><${Feed}/></div><div class="home-side"><${Popular}/></div></div>
    </div></section>
  </div>`;
}

/* ── Comments Component ─────────────────────────────────── */
function Comments(p){
  var slug=p.slug,premOnly=p.prem;var auth=useAuth();
  var s1=useState([]),cmts=s1[0],setC=s1[1];var s2=useState(''),txt=s2[0],setT=s2[1];var s3=useState(false),posting=s3[0],setP=s3[1];
  useEffect(function(){cmtLoad(slug).then(setC);},[slug]);
  var can=auth.u&&(!premOnly||isPrem(auth.d));
  var post=useCallback(function(){if(!txt.trim()||!auth.u)return;setP(true);cmtPost(slug,auth.u,txt.trim()).then(function(){setT('');return cmtLoad(slug);}).then(setC).finally(function(){setP(false);});},[txt,slug,auth.u]);
  return html`<div class="cmt-sec">
    <h3>Comments (${cmts.length})</h3>
    ${can?html`<div><textarea class="cmt-input" placeholder="Share your thoughts..." value=${txt} onInput=${function(e){setT(e.target.value);}} rows="3"></textarea><div class="cmt-actions"><button class="cmt-post" onClick=${post} disabled=${posting||!txt.trim()}>${posting?'Posting...':'Post'}</button></div></div>`:html`<div class="cmt-locked">${!auth.u?'Sign in to comment':premOnly?'Premium members only':''}</div>`}
    <div class="cmt-list">${cmts.length===0?html`<p class="cmt-empty">No comments yet</p>`:cmts.map(function(c){return html`<div class="cmt" key=${c._id}><img class="cmt-av" src=${c.avatar||''} alt=""/><div class="cmt-body"><div class="cmt-head"><span class="cmt-who">${c.name}</span><span class="cmt-when">${ago(new Date(c.createdAt).toISOString())}</span></div><div class="cmt-txt" dangerouslySetInnerHTML=${{__html:mdRender(c.text)}}></div></div></div>`;})}</div>
  </div>`;
}

/* ── Detail Page ────────────────────────────────────────── */
function Detail(p){
  var slug=p.slug,auth=useAuth();
  var s=useState(null),item=s[0],setI=s[1];var s2=useState(true),busy=s2[0],setB=s2[1];
  var s3=useState(null),ep=s3[0],setEp=s3[1];var s4=useState(null),bm=s4[0],setBm=s4[1];var s5=useState(false),bmOpen=s5[0],setBmO=s5[1];
  useEffect(function(){setB(true);setEp(null);feedAll().then(function(a){var g=group(a),f=g.find(function(x){return x.slug===slug;});setI(f||null);if(f&&f.eps.length)setEp(f.eps[f.eps.length-1]);setBm(bmCat(slug));setB(false);});},[slug]);
  useEffect(function(){scrollTo(0,0);},[slug]);
  var pickEp=useCallback(function(e){if(e.prem){if(!auth.u){go('/signin');return;}if(!isPrem(auth.d)){go('/subscribe');return;}}setEp(e);if(item)histAdd(slug,item.title,item.th,e.title);},[item,slug,auth]);
  var toggleBm=useCallback(function(cat){if(cat===bm){bmRm(slug);setBm(null);}else if(item){bmAdd(slug,item.title,item.th,cat);setBm(cat);}setBmO(false);},[bm,item,slug]);

  if(busy)return html`<div class="detail"><div class="skel" style="width:100%;height:300px;border-radius:12px;margin-top:60px"></div></div>`;
  if(!item)return html`<div class="detail"><div style="padding:60px 0;text-align:center"><h2 style="color:#fff">Not found</h2><a href="#/" style="color:#6c8cff">← Home</a></div></div>`;

  var cover=item.th?item.th.replace(/\/s\d+(-c)?\//,'/s600/'):'';
  var sl=C.sectionLabels;var hasPrem=item.eps.some(function(e){return e.prem;});
  var status=item.labels.indexOf('Ongoing')!==-1?'📖 Ongoing':item.labels.indexOf('Finished')!==-1?'✅ Completed':'📖 Publishing';

  return html`<div class="detail">
    <a href="#/" class="detail-back">← Back</a>
    <div class="detail-top">
      <div class="detail-poster">${cover&&html`<img src=${cover} alt=${item.title}/>`}</div>
      <div class="detail-info">
        <h1 class="detail-title">${item.title}</h1>
        <div class="detail-stats"><span class="on">${status}</span><span>·</span><span>${item.eps.length} chapters</span><span>·</span><span>Updated ${ago(item.upd)}</span></div>
        <div class="detail-tags">
          ${item.labels.filter(function(l){return l!==C.premiumLabel;}).map(function(l){return html`<span class=${'tag'+(sl.indexOf(l)!==-1?' hi':'')} key=${l}>${l}</span>`;})}
          ${item.prem&&html`<span class="tag hi">★ Premium</span>`}
        </div>
        <div class="detail-btns">
          ${item.eps.length>0&&html`<button class="btn-pri" onClick=${function(){pickEp(item.eps[0]);}}>▶ Start</button>`}
          <div class="bm-wrap">
            <button class=${'btn-sec'+(bm?' on':'')} onClick=${function(){setBmO(!bmOpen);}}>${bm||'☆ Follow'}</button>
            ${bmOpen&&html`<div class="bm-menu">${C.bmCats.map(function(c){return html`<button class=${'bm-opt'+(c===bm?' on':'')} key=${c} onClick=${function(){toggleBm(c);}}>${c}</button>`;})
            }${bm&&html`<button class="bm-opt rm" onClick=${function(){toggleBm(bm);}}>Remove</button>`}</div>`}
          </div>
        </div>
      </div>
    </div>

    ${ep&&ep.vid&&html`<div class="player"><h3>Now Playing: ${ep.title}</h3><div class="player-frame"><iframe src=${ep.vid} key=${ep.id} allowfullscreen="" allow="autoplay; encrypted-media" referrerpolicy="no-referrer" title=${ep.title}></iframe></div>
      ${ep.links.length>0&&html`<div class="player-links">${ep.links.map(function(l){return html`<a class="dl-pill" href=${l.url} target="_blank" rel="noopener noreferrer">↓ ${l.name}</a>`;})}</div>`}
    </div>`}

    <div class="ch-head">Chapters</div>
    <div class="ch-list">${item.eps.slice().reverse().map(function(e,i){
      var num=(e.title.match(/(\d+)/)||[])[1]||(item.eps.length-i);
      var active=ep&&ep.id===e.id,locked=e.prem&&(!auth.u||!isPrem(auth.d));
      return html`<div class=${'ch-row'+(active?' on':'')+(locked?' lock':'')} key=${e.id} onClick=${function(){pickEp(e);}}>
        <span class="ch-num">Ch. ${num}</span><span class="ch-name">${e.title}</span><span class="ch-ago">${ago(e.pub)}</span>
        ${locked?html`<span>🔒</span>`:html`<span style="display:flex;gap:4px">${e.links.map(function(l){return html`<a class="ch-dl" href=${l.url} target="_blank" rel="noopener" onClick=${function(ev){ev.stopPropagation();}}>${l.name}</a>`;})}</span>`}
      </div>`;
    })}</div>
    <${Comments} slug=${slug} prem=${hasPrem}/>
  </div>`;
}

/* ── Search ─────────────────────────────────────────────── */
function Search(p){
  var iq=p.q||'';var s=useState(iq),q=s[0],setQ=s[1];var s2=useState([]),res=s2[0],setR=s2[1];var s3=useState(false),busy=s3[0],setB=s3[1];var all=useRef([]);
  useEffect(function(){setB(true);feedAll().then(function(a){all.current=group(a);if(iq)filter(iq);setB(false);});},[]);
  var filter=useCallback(function(v){if(!v.trim()){setR([]);return;}setR(all.current.filter(function(g){return match(g.title,v)||g.labels.some(function(l){return match(l,v);});}));},[]);
  var inp=useCallback(function(e){var v=e.target.value;setQ(v);filter(v);},[]);
  var click=useCallback(function(it){go('/title/'+it.slug);},[]);
  return html`<div class="search-wrap">
    <div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="search" placeholder="Search titles, genres..." value=${q} onInput=${inp} autofocus/></div>
    ${busy?html`<div class="cgrid"><${Skel} n=${6}/></div>`:res.length?html`<div class="cgrid">${res.map(function(it){return html`<${Card} key=${it.slug} item=${it} onClick=${click} sub=${it.eps.length+' chaps'}/>`})}</div>`:q.trim()?html`<p style="color:#3d4155">No results for "${q}"</p>`:html`<p style="color:#2a2d3a">Start typing to search...</p>`}
  </div>`;
}

/* ── Static Pages ───────────────────────────────────────── */
function About(){return html`<div class="page"><h1>About</h1><div class="page-text"><p>ComicK is a lightweight streaming and download index powered by Google Blogger.</p><p>Track your favorites, discover new series, and enjoy a clean experience.</p></div></div>`;}

function Timetable(){
  var s=useState([]),all=s[0],set=s[1];var s2=useState(true),busy=s2[0],setB=s2[1];
  useEffect(function(){feedLabel('Ongoing').then(function(ps){var g=group(ps);g.sort(function(a,b){return a.upd<b.upd?1:-1;});set(g);setB(false);});},[]);
  return html`<div class="page"><h1>Timetable</h1><p class="page-sub">Currently airing, sorted by latest update</p>
    ${busy?html`<div class="cgrid"><${Skel} n=${6}/></div>`:html`<div class="feed">${all.map(function(it){var lat=it.eps[it.eps.length-1];return html`<a class="feed-row" href=${'#/title/'+it.slug} key=${it.slug}><img class="feed-thumb" src=${it.th} alt=""/><div class="feed-info"><div class="feed-name">${it.title}</div><div class="feed-meta">${it.eps.length} ch · ${ago(lat?lat.upd||lat.pub:'')}</div></div></a>`;})}</div>`}
  </div>`;
}

function Releases(){
  var s=useState([]),posts=s[0],set=s[1];var s2=useState(true),busy=s2[0],setB=s2[1];
  useEffect(function(){feedAll().then(function(a){var sorted=a.slice().sort(function(a,b){return a.pub<b.pub?1:-1;});set(sorted.slice(0,50));setB(false);});},[]);
  return html`<div class="page"><h1>Latest Releases</h1><p class="page-sub">Most recent uploads</p>
    ${busy?html`<div class="cgrid"><${Skel} n=${6}/></div>`:html`<div class="feed">${posts.map(function(p){var slug=baseName(p.title).replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF]+/g,'-').replace(/^-|-$/g,'').toLowerCase();return html`<a class="feed-row" href=${'#/title/'+slug} key=${p.id}><img class="feed-thumb" src=${p.th} alt=""/><div class="feed-info"><div class="feed-name">${p.title}</div><div class="feed-meta">${ago(p.pub)} · ${p.labels.filter(function(l){return C.sectionLabels.indexOf(l)!==-1;}).join(', ')}</div></div></a>`;})}</div>`}
  </div>`;
}

/* ── Subscribe / SignIn / Profile ───────────────────────── */
function Subscribe(){
  var auth=useAuth(),si=subInfo(auth.d);
  return html`<div class="page"><h1>Subscription Plans</h1><p class="page-sub">Unlock premium content and earn your rank</p>
    ${auth.u&&si.ok&&html`<div class="prof-card" style="margin-bottom:20px"><span style=${'background:'+si.rank.c+';padding:2px 10px;border-radius:8px;font-size:11px;font-weight:700;color:#000'}>${si.rank.i} ${si.rank.n}</span><span style="margin-left:8px">Active until ${fmtDate(new Date(si.exp).toISOString())}</span></div>`}
    <div class="plans">${C.plans.map(function(pl){
      var r=C.ranks[0];for(var i=C.ranks.length-1;i>=0;i--)if(pl.m>=C.ranks[i].m){r=C.ranks[i];break;}
      return html`<div class="plan" key=${pl.id}><div class="plan-name">${pl.l}</div><div class="plan-price">${pl.p}</div>
        <ul class="plan-perks"><li>All Premium content</li><li>Comment on premium</li><li>${r.n} rank badge</li>${pl.m>=6?html`<li>Priority support</li>`:null}</ul>
        ${auth.u?html`<button class="plan-btn" onClick=${function(){alert('Contact admin to activate '+pl.l);}}>Select</button>`:html`<button class="plan-btn" onClick=${function(){go('/signin');}}>Sign in first</button>`}
      </div>`;
    })}</div>
  </div>`;
}

function SignIn(){var auth=useAuth();if(auth.u){go('/profile');return null;}return html`<div class="page" style="text-align:center;padding-top:60px"><h1>Sign In</h1><p class="page-sub">Sign in to follow, comment, and access premium content</p><button class="btn-g" style="margin-top:16px" onClick=${function(){gSignIn().then(function(){go('/profile');});}}>Sign in with Google</button></div>`;}

function Profile(){
  var auth=useAuth();var s=useState(udata()),data=s[0],setD=s[1];var s2=useState('Reading'),tab=s2[0],setT=s2[1];var s3=useState('bm'),sec=s3[0],setS=s3[1];
  var refresh=useCallback(function(){setD(udata());},[]);var si=subInfo(auth.d);
  if(!auth.u)return html`<${SignIn}/>`;
  return html`<div class="page">
    <div class="prof-card"><img class="prof-av" src=${auth.u.photoURL||''} alt=""/><div class="prof-info"><h2>${auth.u.displayName||'User'}</h2><span style=${'background:'+si.rank.c+';padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;color:#000'}>${si.rank.i} ${si.rank.n}</span>${si.ok?html`<p>Premium · expires ${fmtDate(new Date(si.exp).toISOString())}</p>`:html`<p><a href="#/subscribe">Get Premium →</a></p>`}</div><button class="btn-sm" onClick=${function(){gSignOut();}}>Sign out</button></div>
    <div class="tabs"><button class=${'tab'+(sec==='bm'?' on':'')} onClick=${function(){setS('bm');}}>My List</button><button class=${'tab'+(sec==='hist'?' on':'')} onClick=${function(){setS('hist');}}>History (${data.hist.length})</button></div>
    ${sec==='bm'&&html`
      <div class="tabs">${C.bmCats.map(function(c){var n=(data.bm[c]||[]).length;return html`<button class=${'tab sm'+(tab===c?' on':'')} key=${c} onClick=${function(){setT(c);}}>${c} (${n})</button>`;})}</div>
      <div class="feed">${(data.bm[tab]||[]).length===0?html`<p style="color:#3d4155;padding:16px 0">Empty</p>`:
        (data.bm[tab]||[]).map(function(b){return html`<div class="feed-row" key=${b.s}><a href=${'#/title/'+b.s} style="display:contents;color:inherit"><img class="feed-thumb" src=${b.th} alt=""/><div class="feed-info"><div class="feed-name">${b.t}</div></div></a><button class="btn-x" onClick=${function(){bmRm(b.s);refresh();}}>✕</button></div>`;})}</div>
    `}
    ${sec==='hist'&&html`
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">${data.hist.length>0&&html`<button class="btn-sm" onClick=${function(){var d=udata();d.hist=[];usave(d);refresh();}}>Clear</button>`}</div>
      <div class="feed">${data.hist.length===0?html`<p style="color:#3d4155;padding:16px 0">No history</p>`:
        data.hist.map(function(h){return html`<a class="feed-row" href=${'#/title/'+h.s} key=${h.s+h.at}><img class="feed-thumb" src=${h.th} alt=""/><div class="feed-info"><div class="feed-name">${h.t}</div><div class="feed-meta">${h.ep||''} · ${ago(new Date(h.at).toISOString())}</div></div></a>`;})}</div>
    `}
  </div>`;
}

/* ── Admin ──────────────────────────────────────────────── */
function Admin(){
  var s1=useState(''),t=s1[0],setT=s1[1];var s2=useState(''),vid=s2[0],setV=s2[1];var s3=useState(''),th=s3[0],setTh=s3[1];
  var s4=useState([{name:'',url:''}]),lnks=s4[0],setL=s4[1];var s5=useState([]),labs=s5[0],setLb=s5[1];var s6=useState(''),cl=s6[0],setCl=s6[1];
  var s7=useState(''),out=s7[0],setO=s7[1];var s8=useState(false),cp=s8[0],setCp=s8[1];
  var addL=useCallback(function(){setL(lnks.concat([{name:'',url:''}]));},[lnks]);
  var rmL=useCallback(function(i){setL(lnks.filter(function(_,x){return x!==i;}));},[lnks]);
  var upL=useCallback(function(i,f,v){setL(lnks.map(function(l,x){if(x!==i)return l;var c={name:l.name,url:l.url};c[f]=v;return c;}));},[lnks]);
  var togLab=useCallback(function(l){if(labs.indexOf(l)!==-1)setLb(labs.filter(function(x){return x!==l;}));else setLb(labs.concat([l]));},[labs]);
  var addCl=useCallback(function(){var v=cl.trim();if(v&&labs.indexOf(v)===-1){setLb(labs.concat([v]));setCl('');}},[cl,labs]);
  var gen=useCallback(function(){
    if(!t.trim()){setO('');return;}var vl=lnks.filter(function(l){return l.name.trim()&&l.url.trim();});
    var ls=vl.map(function(l){return'          {\n               "name": "'+l.name.trim()+'",\n              "url": "'+l.url.trim()+'"\n          }';}).join(',\n');
    var jb='{\n     "data":\n     {\n         "video": "'+vid.trim()+'",\n         "links": [\n'+ls+'\n         ]\n     }\n }';
    var h='<div style="display: none">'+jb+' </div>';if(th.trim())h+='<a href="'+th.trim()+'" imageanchor="1"><img border="0" src="'+th.trim()+'" data-original-width="400" data-original-height="566" /></a>';
    setO(h);setCp(false);
  },[t,vid,th,lnks,labs]);
  var copy=useCallback(function(){if(!out)return;navigator.clipboard.writeText(out).then(function(){setCp(true);setTimeout(function(){setCp(false);},2000);});},[out]);
  var reset=useCallback(function(){setT('');setV('');setTh('');setL([{name:'',url:''}]);setLb([]);setO('');setCp(false);},[]);
  return html`<div class="page"><h1>Add Episode</h1><p class="page-sub">Generate post HTML for Blogger</p><div class="adm-form">
    <div class="fg"><label class="fg-label">Title *</label><input class="fg-input" placeholder="e.g. DanMachi S2 - 10" value=${t} onInput=${function(e){setT(e.target.value);}}/></div>
    <div class="fg"><label class="fg-label">Video Embed URL</label><input class="fg-input" placeholder="//ok.ru/videoembed/..." value=${vid} onInput=${function(e){setV(e.target.value);}}/></div>
    <div class="fg"><label class="fg-label">Thumbnail URL</label><input class="fg-input" placeholder="https://..." value=${th} onInput=${function(e){setTh(e.target.value);}}/>${th&&html`<img src=${th} alt="" style="margin-top:6px;max-width:100px;border-radius:6px"/>`}</div>
    <div class="fg"><label class="fg-label">Download Links</label>${lnks.map(function(l,i){return html`<div class="adm-row" key=${i}><input class="fg-input fg-sm" placeholder="Name" value=${l.name} onInput=${function(e){upL(i,'name',e.target.value);}}/><input class="fg-input" placeholder="URL" value=${l.url} onInput=${function(e){upL(i,'url',e.target.value);}}/>${lnks.length>1&&html`<button class="btn-x" onClick=${function(){rmL(i);}}>✕</button>`}</div>`;})}<button class="btn-sm" onClick=${addL} style="margin-top:4px">+ Add link</button></div>
    <div class="fg"><label class="fg-label">Labels</label><div class="chip-row">${C.sectionLabels.concat([C.premiumLabel]).map(function(l){return html`<button class=${'chip'+(labs.indexOf(l)!==-1?' on':'')} onClick=${function(){togLab(l);}}>${l}</button>`;})}</div><div style="display:flex;gap:6px;margin-top:6px"><input class="fg-input fg-sm" placeholder="Custom..." value=${cl} onInput=${function(e){setCl(e.target.value);}} onKeyDown=${function(e){if(e.key==='Enter')addCl();}}/><button class="btn-sm" onClick=${addCl}>Add</button></div></div>
    <div style="display:flex;gap:8px"><button class="btn-pri" onClick=${gen}>Generate</button><button class="btn-sm" onClick=${reset}>Reset</button></div>
    ${out&&html`<div class="fg"><label class="fg-label">Title: ${t} · Labels: ${labs.join(', ')||'(none)'}</label><div class="adm-out"><pre style="margin:0">${out}</pre><button class=${'copy-btn'+(cp?' ok':'')} onClick=${copy}>${cp?'Copied!':'Copy'}</button></div></div>`}
  </div></div>`;
}

/* ── Navbar ─────────────────────────────────────────────── */
function Nav(p){
  var r=p.route,auth=useAuth();var s=useState(false),mo=s[0],setM=s[1];var s2=useState(false),um=s2[0],setU=s2[1];
  var si=subInfo(auth.d);
  var links=[{h:'#/',l:'Home'},{h:'#/timetable',l:'Timetable'},{h:'#/releases',l:'Updates'},{h:'#/about',l:'About'}];
  useEffect(function(){if(!um)return;var fn=function(e){if(!e.target.closest('.nav-auth-wrap'))setU(false);};document.addEventListener('click',fn);return function(){document.removeEventListener('click',fn);};},[um]);
  return html`<nav class="nav"><div class="container nav-inner">
    <a href="#/" class="nav-brand"><i>◈</i> ComicK</a>
    <div class=${'nav-menu'+(mo?' open':'')}>
      ${links.map(function(lk){var on=r===lk.h.slice(1)||(lk.h==='#/'&&r==='/');return html`<a href=${lk.h} class=${'nav-item'+(on?' on':'')} onClick=${function(){setM(false);}}>${lk.l}</a>`;})}
    </div>
    <div class="nav-spacer"></div>
    <a href="#/search" class="nav-search-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Search<kbd>⌘K</kbd></a>
    <div class="nav-auth-wrap" style="position:relative">
      ${auth.u?html`
        <img class="nav-avatar" src=${auth.u.photoURL||''} alt="" onClick=${function(e){e.stopPropagation();setU(!um);}}/>
        ${um&&html`<div style="position:absolute;top:100%;right:0;margin-top:6px;background:#181b25;border:1px solid #2a2d3a;border-radius:8px;overflow:hidden;z-index:10;min-width:150px;box-shadow:0 8px 20px #0006">
          <a href="#/profile" style="display:block;padding:10px 16px;color:#c9cdd4;font-size:12px" onClick=${function(){setU(false);}}>My List</a>
          <a href="#/subscribe" style="display:block;padding:10px 16px;color:#c9cdd4;font-size:12px" onClick=${function(){setU(false);}}>Subscription</a>
          <button style="display:block;width:100%;padding:10px 16px;background:none;border:none;border-top:1px solid #1c1f2b;color:#7a7f8e;font-size:12px;text-align:left;cursor:pointer" onClick=${function(){gSignOut();setU(false);}}>Sign out</button>
        </div>`}
      `:html`<a href="#/signin" class="nav-auth">Sign in</a>`}
    </div>
    <button class="burger" onClick=${function(){setM(!mo);}} aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
  </div></nav>`;
}

/* ── App ────────────────────────────────────────────────── */
function App(){
  var r=useRoute();
  var oc=useCallback(function(it){go('/title/'+it.slug);},[]);
  var pg;
  if(r==='/'||r==='')pg=html`<${Home} onClick=${oc}/>`;
  else if(r==='/about')pg=html`<${About}/>`;
  else if(r==='/timetable')pg=html`<${Timetable}/>`;
  else if(r==='/releases')pg=html`<${Releases}/>`;
  else if(r==='/profile')pg=html`<${Profile}/>`;
  else if(r==='/subscribe')pg=html`<${Subscribe}/>`;
  else if(r==='/signin')pg=html`<${SignIn}/>`;
  else if(r==='/admin')pg=html`<${Admin}/>`;
  else if(r.indexOf('/search')===0){var q=r.replace('/search/','').replace('/search','');pg=html`<${Search} q=${q}/>`;}
  else if(r.indexOf('/title/')===0){var slug=r.replace('/title/','');pg=html`<${Detail} slug=${slug}/>`;}
  else pg=html`<div class="page"><h1>404</h1><p>Page not found.</p><a href="#/" style="color:#6c8cff">← Home</a></div>`;
  return html`<div class="app-wrap"><${Nav} route=${r}/>${pg}<footer class="foot">© ComicK · Powered by Blogger</footer></div>`;
}

render(html`<${App}/>`,document.getElementById('root'));
})();
