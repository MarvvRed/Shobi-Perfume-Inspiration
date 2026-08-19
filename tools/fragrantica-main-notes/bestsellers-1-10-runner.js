/*
 * Shobi Perfume Inspiration
 * Fragrantica Main Notes — Best Sellers #1-#10 Runner
 *
 * PURPOSE
 * Run this in Firefox DevTools Console (multiline editor) on each target page.
 * The script:
 * - knows the exact #1-#10 target sequence;
 * - installs the _pd catcher;
 * - persists captures in localStorage;
 * - associates a capture with the expected bestseller rank;
 * - automatically prints the NEXT target URL after a successful capture;
 * - never edits the live Shobi cards/database.
 *
 * IMPORTANT
 * A normal page navigation resets page JavaScript, so this runner must be
 * executed again (Ctrl+Enter) after each Fragrantica page load. Captured data
 * survives because it is stored in localStorage.
 */

(() => {
  const STORAGE_KEY = 'shobi_fragrantica_main_notes';
  const BATCH_KEY = 'shobi_fragrantica_bestsellers_1_10_state';

  const targets = [
    {rank:1,name:'Vanilla 28',brand:'Kayali Fragrances',id:52616,url:'https://www.fragrantica.com/perfume/Kayali-Fragrances/Vanilla-28-52616.html'},
    {rank:2,name:"Angels' Share",brand:'Kilian Paris',id:62615,url:'https://www.fragrantica.com/perfume/By-Kilian/Angels-Share-62615.html'},
    {rank:3,name:'Blanche',brand:'Byredo',id:6686,url:'https://www.fragrantica.com/perfume/Byredo/Blanche-6686.html'},
    {rank:4,name:'Tobacco Vanille',brand:'Tom Ford',id:1825,url:'https://www.fragrantica.com/perfume/Tom-Ford/Tobacco-Vanille-1825.html'},
    {rank:5,name:'The Muse',brand:'ZARKOPERFUME',id:60665,url:'https://www.fragrantica.com/perfume/ZARKOPERFUME/The-Muse-60665.html'},
    {rank:6,name:'Baccarat Rouge 540',brand:'Maison Francis Kurkdjian',id:33519,url:'https://www.fragrantica.com/perfume/Maison-Francis-Kurkdjian/Baccarat-Rouge-540-33519.html'},
    {rank:7,name:'Virgin Island Water',brand:'Creed',id:899,url:'https://www.fragrantica.com/perfume/Creed/Virgin-Island-Water-899.html'},
    {rank:8,name:'Lost Cherry',brand:'Tom Ford',id:51411,url:'https://www.fragrantica.com/perfume/Tom-Ford/Lost-Cherry-51411.html'},
    {rank:9,name:'Devotion',brand:'Dolce&Gabbana',id:84951,url:'https://www.fragrantica.com/perfume/Dolce-Gabbana/Devotion-84951.html'},
    {rank:10,name:"Cheirosa '62",brand:'Sol de Janeiro',id:56062,url:'https://www.fragrantica.com/perfume/Sol-de-Janeiro/Cheirosa-62-56062.html'}
  ];

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const cleanUrl = u => String(u || '').split('#')[0].split('?')[0];

  const currentUrl = cleanUrl(location.href);
  const currentTarget = targets.find(t => cleanUrl(t.url) === currentUrl);

  if (!currentTarget) {
    console.log('⚠️ Questa pagina non appartiene al batch Best Seller #1-#10.');
    console.table(targets.map(t => ({rank:t.rank, perfume:t.name, url:t.url})));
    return;
  }

  const captures = readJSON(STORAGE_KEY, {});
  const state = readJSON(BATCH_KEY, {completed:[]});
  state.completed = Array.from(new Set(state.completed || []));

  const findCaptureForUrl = url => Object.values(captures).find(c => cleanUrl(c?.url) === cleanUrl(url));
  const alreadyCaptured = findCaptureForUrl(currentTarget.url);

  if (alreadyCaptured && !state.completed.includes(currentTarget.rank)) {
    state.completed.push(currentTarget.rank);
    writeJSON(BATCH_KEY, state);
  }

  const showProgress = () => {
    const latestCaptures = readJSON(STORAGE_KEY, {});
    const rows = targets.map(t => {
      const c = Object.values(latestCaptures).find(x => cleanUrl(x?.url) === cleanUrl(t.url));
      return {
        rank: t.rank,
        perfume: t.name,
        status: c ? '✅ CAPTURED' : '⏳ PENDING',
        notes: c?.notes?.length || 0,
        weights_sum: c?.weights_sum || ''
      };
    });
    console.table(rows);
    console.log(`📦 BATCH: ${rows.filter(r => r.status.startsWith('✅')).length}/10 captured`);
  };

  showProgress();

  if (alreadyCaptured) {
    console.log(`✅ Best Seller #${currentTarget.rank} ${currentTarget.name} è già salvato.`);
    const next = targets.find(t => !findCaptureForUrl(t.url));
    if (next) {
      console.log(`➡️ PROSSIMO: Best Seller #${next.rank} — ${next.name}`);
      console.log(next.url);
    } else {
      console.log('🏁 BATCH #1-#10 COMPLETO');
    }
    return;
  }

  if (window.__shobiBatchCatcherInstalled) {
    console.log('ℹ️ Batch catcher già attivo su questa pagina.');
    return;
  }

  if (typeof window._pd !== 'function') {
    console.error('❌ _pd non è ancora disponibile. Attendi 1-2 secondi e premi di nuovo Ctrl+Enter.');
    return;
  }

  window.__shobiBatchCatcherInstalled = true;
  const nativePd = window._pd;

  window._pd = function(arg, ...rest) {
    const result = nativePd.call(this, arg, ...rest);

    Promise.resolve(result).then(decoded => {
      if (!decoded?.notes?.length || !decoded?.weights_sum) return;

      const getLevel = id => {
        if (decoded.pyramid?.top?.some(n => n.sastojak_id === id)) return 'top';
        if (decoded.pyramid?.middle?.some(n => n.sastojak_id === id)) return 'middle';
        if (decoded.pyramid?.base?.some(n => n.sastojak_id === id)) return 'base';
        return null;
      };

      const notes = decoded.notes.map((n, i) => ({
        rank: i + 1,
        note: n.pyramid_title || n.engleski || n.note_title,
        note_title: n.note_title || null,
        engleski: n.engleski || null,
        pyramid_title: n.pyramid_title || null,
        sastojak_id: n.sastojak_id,
        weight: n.weight,
        percentage: +(n.weight / decoded.weights_sum * 100).toFixed(2),
        pyramid_level: getLevel(n.sastojak_id)
      }));

      const signature = notes.map(n => `${n.sastojak_id}:${n.weight}`).join('|');
      const key = currentUrl + '|' + signature;
      const allCaptures = readJSON(STORAGE_KEY, {});

      if (allCaptures[key]) return;

      allCaptures[key] = {
        batch: 'bestsellers-1-10',
        bestseller_rank: currentTarget.rank,
        expected_name: currentTarget.name,
        expected_brand: currentTarget.brand,
        fragrantica_id: currentTarget.id,
        perfume: document.querySelector('h1')?.innerText?.trim() || document.title,
        url: currentUrl,
        weights_sum: decoded.weights_sum,
        captured_at: new Date().toISOString(),
        notes
      };
      writeJSON(STORAGE_KEY, allCaptures);

      const nextState = readJSON(BATCH_KEY, {completed:[]});
      nextState.completed = Array.from(new Set([...(nextState.completed || []), currentTarget.rank])).sort((a,b)=>a-b);
      writeJSON(BATCH_KEY, nextState);

      console.log(`💾 SAVED #${currentTarget.rank}: ${currentTarget.name} | ${notes.length} Main Notes`);
      console.table(notes);
      showProgress();

      const next = targets.find(t => !Object.values(allCaptures).some(c => cleanUrl(c?.url) === cleanUrl(t.url)));
      if (next) {
        console.log(`➡️ PROSSIMO: Best Seller #${next.rank} — ${next.name}`);
        console.log(next.url);
      } else {
        console.log('🏁 BATCH #1-#10 COMPLETO');
        console.log('Per esportare: copy(localStorage.getItem("shobi_fragrantica_main_notes"))');
      }
    });

    return result;
  };

  console.log(`🚀 BATCH CATCHER ATTIVO — #${currentTarget.rank} ${currentTarget.name}`);
  console.log('Ora fai caricare le Main Notes del profumo.');
})();
