(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;
  const emit=(type,detail={})=>window.postMessage({source:'shobi-main-notes-page',type,...detail},'*');
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  emit('diagnostic',{stage:'page-catcher-boot',detail:`readyState=${document.readyState}`});

  function describe(el){
    if(!el) return 'null';
    const tag=el.tagName?.toLowerCase()||'?';
    const id=el.id?`#${el.id}`:'';
    const cls=typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).slice(0,4).join('.'):'';
    return `${tag}${id}${cls} text="${clean(el.textContent).slice(0,180)}"`;
  }

  function findShowNotes(){
    const all=[...document.querySelectorAll('button,a,[role="button"],span,div,strong,b')];
    return all.filter(el=>/^show\s+notes$/i.test(clean(el.textContent)) || /show\s+notes/i.test(clean(el.getAttribute?.('aria-label'))) || /show\s+notes/i.test(clean(el.getAttribute?.('title'))));
  }

  function scanNoteVoteLike(){
    const hits=[];
    const selectors=['[data-note]','[data-sastojak]','[data-weight]','[data-votes]','[class*="note"]','[id*="note"]','[class*="ingredient"]','[id*="ingredient"]'];
    for(const sel of selectors){
      for(const el of document.querySelectorAll(sel)){
        const t=clean(el.textContent);
        if(!t || t.length>500) continue;
        hits.push(`${sel}:${describe(el)}`);
        if(hits.length>=20) return hits;
      }
    }
    return hits;
  }

  async function run(){
    if(document.readyState==='loading') await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
    await sleep(1500);
    const buttons=findShowNotes();
    emit('diagnostic',{stage:'show-notes-found',detail:`count=${buttons.length}; ${buttons.slice(0,5).map(describe).join(' || ')}`});
    if(!buttons.length){ emit('diagnostic',{stage:'show-notes-missing',detail:'No Show Notes control found'}); return; }
    const btn=buttons[0];
    try{btn.scrollIntoView({block:'center',behavior:'auto'});}catch{}
    await sleep(500);
    const before=scanNoteVoteLike();
    emit('diagnostic',{stage:'show-notes-before',detail:before.length?before.slice(0,8).join(' || '):'none'});
    try{btn.click(); emit('diagnostic',{stage:'show-notes-clicked',detail:describe(btn)});}catch(e){emit('page-error',{error:`Show Notes click: ${String(e)}`});return;}
    await sleep(1500);
    const after=scanNoteVoteLike();
    emit('diagnostic',{stage:'show-notes-after',detail:after.length?after.slice(0,12).join(' || '):'none'});
    const parent=btn.parentElement?.parentElement?.parentElement;
    emit('diagnostic',{stage:'show-notes-parent',detail:describe(parent)});
    const nearby=[...(parent?.querySelectorAll?.('a[href*="/notes/"],img[alt],input,button,[style*="width"],[class*="bar"],[class*="progress"]')||[])].slice(0,30);
    emit('diagnostic',{stage:'show-notes-nearby',detail:nearby.length?nearby.map(describe).join(' || '):'none'});
  }
  run().catch(e=>emit('page-error',{error:`Show Notes diagnostic: ${String(e)}`}));
  emit('installed');
})();
