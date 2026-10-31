(() => {
  'use strict';
  const data = window.ARCHIVE, $ = id => document.getElementById(id);
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const date = value => value.length === 4 ? value : value.length === 7 ? new Date(value + '-02T12:00:00').toLocaleDateString('en-US', {month:'long',year:'numeric'}) : new Date(value + 'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
  const byId = new Map(data.evidence.map(e => [e.id,e]));
  let filtered = data.evidence, limit = 30, current, returnHash = '', returnFocus;
  const textWithLinks = text => {
    const p = el('p'); let start = 0;
    for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
      p.append(document.createTextNode(text.slice(start,match.index)));
      const a = el('a',match[0]); a.href = match[0]; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(a); start = match.index + match[0].length;
    }
    p.append(document.createTextNode(text.slice(start))); return p;
  };
  $('evidence-total').textContent = data.evidence.length;
  $('source-total').textContent = data.sources.length;
  for (const c of data.chapters) {
    const li = el('li'), link = el('a'); link.href = '#chapter-' + c.n;
    link.append(el('span','Account ' + String(c.n).padStart(2,'0')),el('strong',date(c.date))); li.append(link); $('hero-dates').append(li);
    const nav = el('a',String(c.n).padStart(2,'0') + ' / ' + date(c.date)); nav.href = link.href; $('chapter-nav').append(nav);
    for (const name of ['timeline-chapter','evidence-chapter']) { const o = el('option','Account ' + c.n); o.value = c.n; $(name).append(o); }
    const article = el('article',undefined,'chapter'); article.id = 'chapter-' + c.n;
    article.append(el('p','Chapter ' + String(c.n).padStart(2,'0'),'chapter-number'),el('h3',c.title),el('p',c.period,'chapter-period'));
    const story = el('div',undefined,'story'); c.paras.forEach(t => {const p=textWithLinks(t);if (/^Sources?:/i.test(t)) p.className='source-note';story.append(p);});article.append(story);
    const evidence = c.evidence.map(id=>byId.get(id)).filter(Boolean);
    if(evidence.length) {
      const box=el('div',undefined,'chapter-evidence');box.append(el('h4','Selected evidence / '+evidence.length+' exhibits'));
      const grid=el('div',undefined,'mini-grid');
      evidence.slice(0,3).forEach(e=>{const b=el('button',undefined,'mini');b.type='button';const img=el('img');img.src=e.thumbnail||e.src;img.alt=e.title;img.loading='lazy';b.append(img,el('span',e.id+' / '+e.title));b.onclick=()=>open(e.id);grid.append(b);});
      const all=el('button','View all evidence for account '+c.n,'text-button');all.type='button';all.onclick=()=>{$('evidence-chapter').value=c.n;$('evidence-search').value='';$('evidence-kind').value='all';filterEvidence();location.hash='evidence';};box.append(grid,all);article.append(box);
    }
    $('chapter-stories').append(article);
  }
  const kinds=[...new Set(data.evidence.map(e=>e.kind))].sort();kinds.forEach(k=>{const o=el('option',k);o.value=k;$('evidence-kind').append(o);});
  function renderTimeline(){
    const q=$('timeline-search').value.trim().toLowerCase(),ch=$('timeline-chapter').value;
    const events=data.events.filter(e=>(ch==='all'||String(e.chapter)===ch)&&(!q||[e.title,e.description,e.date,e.kind].join(' ').toLowerCase().includes(q)));
    $('timeline-events').replaceChildren();$('timeline-count').textContent=events.length+' of '+data.events.length+' events';
    events.forEach(e=>{const row=el('article',undefined,'timeline-event'),content=el('div');row.append(el('time',date(e.date),'timeline-date'));row.firstChild.dateTime=e.date;content.append(el('h3',e.title),el('p',e.description),el('span',e.kind,'tag'));const a=el('a','Read chapter '+e.chapter);a.href='#chapter-'+e.chapter;content.append(a);row.append(content);$('timeline-events').append(row);});
    if(!events.length)$('timeline-events').append(el('p','No events match these filters.','empty'));
  }
  function filterEvidence(){
    const q=$('evidence-search').value.trim().toLowerCase(),ch=$('evidence-chapter').value,kind=$('evidence-kind').value;
    filtered=data.evidence.filter(e=>(ch==='all'||String(e.chapter)===ch)&&(kind==='all'||e.kind===kind)&&(!q||[e.id,e.title,e.caption,...e.sources,e.transcript,e.displayedDate||''].join(' ').toLowerCase().includes(q)));limit=30;renderEvidence();
  }
  function renderEvidence(){
    $('evidence-grid').replaceChildren();$('evidence-count').textContent=filtered.length+' of '+data.evidence.length+' exhibits'+(filtered.length>limit?' / showing '+limit:'');
    filtered.slice(0,limit).forEach(e=>{const card=el('article',undefined,'evidence-card'),b=el('button',undefined,'evidence-open');b.type='button';b.setAttribute('aria-label','Open '+e.id+': '+e.title);const img=el('img');img.src=e.thumbnail||e.src;img.alt=e.title;img.loading='lazy';img.decoding='async';b.append(img,el('span',e.id,'exhibit-id'));b.onclick=()=>open(e.id);
      const info=el('div',undefined,'evidence-info');info.append(el('span',e.chapter?'Account '+e.chapter:'Shared / background','tag'),el('h3',e.title),el('p',e.caption,'excerpt'));const inspect=el('button','Inspect original');inspect.type='button';inspect.onclick=()=>open(e.id);info.append(inspect);card.append(b,info);$('evidence-grid').append(card);
    });
    if(!filtered.length)$('evidence-grid').append(el('p','No exhibits match. Try another search or select all chapters.','empty'));
    $('more').hidden=limit>=filtered.length;
  }
  function open(id,fromHash=false){
    const e=byId.get(id);if(!e)return;
    if(!$('viewer').open){returnFocus=document.activeElement;returnHash=location.hash.startsWith('#exhibit-')?'#evidence':location.hash;$('viewer').showModal();document.body.classList.add('modal-open');}
    current=id;$('viewer-id').textContent=e.id+' / '+(e.chapter?'Account '+e.chapter:'Shared evidence');$('viewer-title').textContent=e.title;$('viewer-image').src=e.src;$('viewer-image').alt=e.title;$('viewer-caption').textContent=e.caption;$('viewer-kind').textContent=e.kind;$('viewer-date').textContent=(e.displayedDate?'Source displays: '+e.displayedDate+'. ':'')+e.dateNote;
    $('viewer-sources').replaceChildren(...e.sources.map(s=>el('li',s)));
    if(e.url){const li=el('li'),a=el('a','Original post URL');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('viewer-sources').append(li);}
    $('original').href=e.src;$('download').href=e.src;$('download').download=e.src.split('/').pop();$('viewer-hash').textContent=e.sha256;$('viewer-ocr').textContent=e.transcript||'No machine transcription is available for this image.';$('ocr-panel').open=false;$('share-status').textContent='';
    if(!fromHash)history.replaceState(null,'','#exhibit-'+id);
    const seq=filtered.some(x=>x.id===id)?filtered:data.evidence;$('previous').disabled=seq.length<2;$('next').disabled=seq.length<2;
    $('viewer').querySelector('.image-stage').scrollTop=0;$('viewer').querySelector('aside').scrollTop=0;
  }
  function move(step){const seq=filtered.some(x=>x.id===current)?filtered:data.evidence;const i=seq.findIndex(x=>x.id===current);open(seq[(i+step+seq.length)%seq.length].id);}
  $('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('close-viewer').onclick=()=>$('viewer').close();
  $('viewer').addEventListener('close',()=>{document.body.classList.remove('modal-open');if(location.hash.startsWith('#exhibit-'))history.replaceState(null,'',returnHash||location.pathname+location.search);if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  $('viewer').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}});
  $('share-exhibit').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('share-status').textContent='Exhibit link copied.';}catch{$('share-status').textContent='Copy the address in your browser to share this exhibit.';}};
  function checkHash(){const match=location.hash.match(/^#exhibit-(E\d+)$/);if(match)open(match[1],true);else if($('viewer').open)$('viewer').close();}
  window.addEventListener('hashchange',checkHash);
  function renderSources(){
    const q=$('source-search').value.trim().toLowerCase();$('source-texts').replaceChildren();let count=0;
    data.sources.forEach(s=>{const paragraphs=s.paragraphs.filter(p=>!q||p.toLowerCase().includes(q));if(q&&!paragraphs.length&&!s.title.toLowerCase().includes(q))return;count++;
      const details=el('details'),summary=el('summary',s.title+(q?' / '+paragraphs.length+' matching paragraphs':'')),body=el('div',undefined,'source-body');details.append(summary,body);let loaded=false;
      function populate(){if(loaded)return;loaded=true;body.append(el('p',s.note,'record-note'));(q&&paragraphs.length?paragraphs:s.paragraphs).forEach(p=>{const match=p.match(/^(E\d{3}): /);if(match){const line=el('p'),a=el('a',p);a.href='#exhibit-'+match[1];line.append(a);body.append(line);}else body.append(textWithLinks(p));});}
      details.addEventListener('toggle',()=>{if(details.open)populate();});if(q){populate();details.open=true;}$('source-texts').append(details);
    });$('source-count').textContent=count+' source records indexed'+(q?' matching this search':'');
  }
  const debounce=fn=>{let timer;return()=>{clearTimeout(timer);timer=setTimeout(fn,150);};};
  $('timeline-search').addEventListener('input',debounce(renderTimeline));$('timeline-chapter').onchange=renderTimeline;
  $('evidence-search').addEventListener('input',debounce(filterEvidence));$('evidence-chapter').onchange=filterEvidence;$('evidence-kind').onchange=filterEvidence;
  $('more').onclick=()=>{limit+=30;renderEvidence();};$('source-search').addEventListener('input',debounce(renderSources));$('print').onclick=()=>window.print();
  function theme(value){document.documentElement.dataset.theme=value;$('theme').textContent=value==='dark'?'Light mode':'Dark mode';$('theme').setAttribute('aria-pressed',String(value==='dark'));}
  try{theme(localStorage.getItem('takedowns-theme')||'light');}catch{theme('light');}
  $('theme').onclick=()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';theme(value);try{localStorage.setItem('takedowns-theme',value);}catch{}};
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(e.isIntersecting)document.querySelectorAll('#chapter-nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id));
    }),{rootMargin:'-100px 0px -65% 0px'});
    document.querySelectorAll('.chapter').forEach(c=>observer.observe(c));
  }
  renderTimeline();filterEvidence();renderSources();checkHash();
})();
