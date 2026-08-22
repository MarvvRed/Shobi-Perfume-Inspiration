// Final isolated override for Best Seller #97 only.
(function(){
  const IMG='https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.17.avif';
  const URL='https://www.fragrantica.com/perfume/Hermes/Terre-d-Hermes-17.html';
  function apply97(){
    document.querySelectorAll('.perfume-card-prototype').forEach(card=>{
      if(!/Best Seller\s*#\s*97\b/i.test(card.textContent||'')) return;
      const wrap=card.querySelector('.prototype-image-wrap');
      if(!wrap) return;
      let img=wrap.querySelector('img');
      if(!img){ img=document.createElement('img'); wrap.prepend(img); }
      if(img.src!==IMG) img.src=IMG;
      img.loading='lazy';
      img.decoding='async';
      img.alt="Terre d'Hermes";
      let link=img.closest('a.prototype-fragrantica-link');
      if(!link){
        link=document.createElement('a');
        link.className='prototype-fragrantica-link';
        img.parentNode.insertBefore(link,img);
        link.appendChild(img);
      }
      link.href=URL;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.title='View on Fragrantica';
      Array.from(wrap.children).forEach(el=>{
        if(el!==link && el!==img && el.textContent?.trim()==='Image not verified') el.remove();
      });
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const c=document.getElementById('resultsContainer');
    if(c) new MutationObserver(apply97).observe(c,{childList:true,subtree:true});
    apply97();
  });
})();
