(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const emit = (type, detail = {}) => {
    window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  };

  emit('diagnostic', { stage: 'page-catcher-boot', detail: `readyState=${document.readyState}` });

  const seen = new Set();
  let pdCalls = 0;

  const describe = value => {
    try {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (Array.isArray(value)) return `array(${value.length})`;
      const type = typeof value;
      if (type !== 'object') return type;
      const keys = Object.keys(value).slice(0, 12);
      return `object keys=[${keys.join(',')}]`;
    } catch {
      return 'uninspectable';
    }
  };

  const captureDecoded = decoded => {
    try {
      if (!decoded || !Array.isArray(decoded.notes) || !decoded.notes.length || !decoded.weights_sum) return false;

      const sig = decoded.notes.map(n => `${n.sastojak_id}:${n.weight}`).join('|');
      if (seen.has(sig)) return true;
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
      return true;
    } catch (error) {
      emit('page-error', { error: String(error) });
      return false;
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
        pdCalls += 1;
        emit('diagnostic', {
          stage: 'pd-call',
          detail: `#${pdCalls};args=${args.length};arg0=${describe(args[0])}`
        });

        let result;
        try {
          result = fn.apply(this, args);
        } catch (error) {
          emit('page-error', { error: `_pd threw: ${String(error)}` });
          throw error;
        }

        emit('diagnostic', {
          stage: 'pd-return',
          detail: `#${pdCalls};${describe(result)};then=${typeof result?.then}`
        });

        Promise.resolve(result).then(value => {
          emit('diagnostic', { stage: 'pd-resolved', detail: `#${pdCalls};${describe(value)}` });
          captureDecoded(value);
        }).catch(error => emit('page-error', { error: `_pd resolve: ${String(error)}` }));

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

  // Fragrantica lazily initializes parts of perfume pages. Trigger normal page
  // visibility without clicking anything or interacting with security checks.
  const triggerLazyContent = async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    try {
      await sleep(1800);
      const height = Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0);
      emit('diagnostic', { stage: 'lazy-trigger-start', detail: `height=${height}` });
      if (height > 0) {
        for (const fraction of [0.3, 0.55, 0.75]) {
          window.scrollTo({ top: Math.floor(height * fraction), behavior: 'auto' });
          await sleep(700);
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      emit('diagnostic', { stage: 'lazy-trigger-done', detail: `pdCalls=${pdCalls}` });
    } catch (error) {
      emit('page-error', { error: `lazy trigger: ${String(error)}` });
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', triggerLazyContent, { once: true });
  } else {
    triggerLazyContent();
  }

  emit('installed');
})();
