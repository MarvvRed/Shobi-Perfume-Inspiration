(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const emit = (type, detail = {}) => {
    window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  };

  const install = () => {
    if (typeof window._pd !== 'function') return false;
    if (window._pd.__shobiWrapped) return true;

    const nativePd = window._pd;

    const wrapped = function(arg, ...rest) {
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
          sastojak_id: n.sastojak_id,
          weight: n.weight,
          percentage: +(n.weight / decoded.weights_sum * 100).toFixed(2),
          pyramid_level: getLevel(n.sastojak_id)
        }));

        emit('capture', {
          payload: {
            perfume: document.querySelector('h1')?.innerText?.trim() || document.title,
            url: location.href.split('#')[0],
            weights_sum: decoded.weights_sum,
            captured_at: new Date().toISOString(),
            notes
          }
        });
      }).catch(error => emit('page-error', { error: String(error) }));

      return result;
    };

    wrapped.__shobiWrapped = true;
    wrapped.__shobiNative = nativePd;
    window._pd = wrapped;
    emit('installed');
    return true;
  };

  if (install()) return;

  const started = Date.now();
  const timer = setInterval(() => {
    if (install()) {
      clearInterval(timer);
      return;
    }
    if (Date.now() - started > 30000) {
      clearInterval(timer);
      emit('page-error', { error: '_pd not found within 30 seconds' });
    }
  }, 25);
})();
