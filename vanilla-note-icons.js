// Vanilla 28 prototype: always show the 5 main notes from our personal database.
// Fragrantica ingredient image IDs: Orchid 154, Jasmine 14, Brown Sugar 521, Amberwood 691, Musk 4.
(function(){
  const notes=[
    ['Vanilla Orchid','https://fimgs.net/mdimg/sastojci/t.154.jpg'],
    ['Jasmine','https://fimgs.net/mdimg/sastojci/t.14.jpg'],
    ['Brown Sugar','https://fimgs.net/mdimg/sastojci/t.521.jpg'],
    ['Amberwood','https://fimgs.net/mdimg/sastojci/t.691.jpg'],
    ['Musk','https://fimgs.net/mdimg/sastojci/t.4.jpg']
  ];
  function apply(){
    document.querySelectorAll('.perfume-card-prototype').forEach(card=>{
      const title=card.querySelector('h3')?.textContent?.toUpperCase()||'';
      if(!title.includes('VANILLA')) return;
      const blocks=card.querySelectorAll('.flex.flex-wrap.gap-2');
      const block=blocks[0];
      if(!block) return;
      block.innerHTML=notes.map(([name,src])=>`<span class="prototype-meta-badge" title="${name}"><img src="${src}" alt="" width="22" height="22" loading="lazy" decoding="async" style="width:22px;height:22px;object-fit:cover;border-radius:50%;flex:0 0 22px"><span>${name}</span></span>`).join('');
    });
  }
  const observer=new MutationObserver(apply);
  document.addEventListener('DOMContentLoaded',()=>{apply();const root=document.getElementById('resultsContainer');if(root)observer.observe(root,{childList:true,subtree:true});});
})();