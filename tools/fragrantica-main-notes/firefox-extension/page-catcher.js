(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const emit = (type, detail = {}) => {
    window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  };

  emit('diagnostic', { stage: 'page-catcher-boot', detail: `readyState=${document.readyState}` });

  const seen = new Set();

  const captureDecoded = decoded => {
    try {
      if (!decoded || !Array.isArray(decoded.notes) || !decoded.notes.length || !decoded.weights_sum) return;

      const sig = decoded.notes.map(n => `${n.sastojak_id}:${n.weight}`).join('|');
      if (seen.has(sig)) return;
      seen.add(sig);

      emit('diagnostic', { stage: 'decoded-candidate', detail: `notes=${decoded.notes.length};sum=${decoded.weights_sum}` });

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
    } catch (error) {
      emit('page-error', { error: String(error) });
    }
  };

  try {
    const nativeThen = Promise.prototype.then;
    if (!nativeThen.__shobiWrapped) {
      const wrappedThen = function(onFulfilled, onRejected) {
        const wrappedFulfilled = typeof onFulfilled === 'function'
          ? function(value) {
              captureDecoded(value);
              return onFulfilled.apply(this, arguments);
            }
          : function(value) {
              captureDecoded(value);
              return value;
            };
        return nativeThen.call(this, wrappedFulfilled, onRejected);
      };
      wrappedThen.__shobiWrapped = true;
      Promise.prototype.then = wrappedThen;
      emit('diagnostic', { stage: 'promise-hook-installed' });
    }
  } catch (error) {
    emit('page-error', { error: `Promise hook: ${String(error)}` });
  }

  try {
    let nativePd;
    let wrappedPd;
    const wrapPd = fn => {
      if (typeof fn !== 'function') return fn;
      if (fn.__shobiWrapped) return fn;
      const wrapped = function(...args) {
        const result = fn.apply(this, args);
        Promise.resolve(result).then(captureDecoded);
        return result;
      };
      wrapped.__shobiWrapped = true;
      wrapped.__shobiNative = fn;
      return wrapped;
    };

    if (typeof window._pd === 'function') {
      nativePd = window._pd;
      wrappedPd = wrapPd(nativePd);
      emit('diagnostic', { stage: 'pd-found-immediately' });
    } else {
      emit('diagnostic', { stage: 'pd-not-present-at-boot' });
    }

    Object.defineProperty(window, '_pd', {
      configurable: true,
      enumerable: true,
      get() { return wrappedPd || nativePd; },
      set(fn) {
        nativePd = fn;
        wrappedPd = wrapPd(fn);
        emit('diagnostic', { stage: 'pd-assigned', detail: `type=${typeof fn}` });
      }
    });
    emit('diagnostic', { stage: 'pd-property-hook-installed' });
  } catch (error) {
    emit('page-error', { error: `_pd hook: ${String(error)}` });
  }

  emit('installed');
})();
