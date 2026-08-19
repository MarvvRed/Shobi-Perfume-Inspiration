(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const emit = (type, detail = {}) => {
    window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  };

  emit('diagnostic', { stage: 'page-catcher-boot', detail: `readyState=${document.readyState}` });

  const seen = new Set();
  let pdCalls = 0;

  const summarize = value => {
    try {
      if (value === null) return 'null';
      if (Array.isArray(value)) return `array len=${value.length}`;
      if (typeof value === 'object') return `object keys=[${Object.keys(value).slice(0, 12).join(',')}]`;
      return `${typeof value}${typeof value === 'string' ? ` len=${value.length}` : ''}`;
    } catch {
      return typeof value;
    }
  };

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
        const id = ++pdCalls;
        let argDetail = `args=${args.length}`;
        if (args.length) argDetail += `;arg0=${summarize(args[0])}`;
        emit('diagnostic', { stage: 'pd-call', detail: `#${id};${argDetail}` });

        const result = fn.apply(this, args);
        emit('diagnostic', { stage: 'pd-return', detail: `#${id};${summarize(result)};then=${typeof result?.then}` });

        Promise.resolve(result).then(value => {
          emit('diagnostic', { stage: 'pd-resolved', detail: `#${id};${summarize(value)}` });
          captureDecoded(value);
        }, error => {
          emit('diagnostic', { stage: 'pd-rejected', detail: `#${id};${String(error)}` });
        });
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

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function triggerNotesSections() {
    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    await sleep(1200);

    const labels = ['main notes', 'perfume pyramid', 'fragrance notes', 'notes'];
    const candidates = [...document.querySelectorAll('h2,h3,h4,h5,strong,b,div,span')]
      .filter(el => {
        const t = (el.textContent || '').trim().toLowerCase();
        if (!t || t.length > 80) return false;
        return labels.some(label => t === label || t.includes(label));
      })
      .slice(0, 12);

    emit('diagnostic', {
      stage: 'notes-section-scan',
      detail: candidates.length
        ? candidates.map(el => (el.textContent || '').trim().slice(0, 40)).join(' | ')
        : 'none'
    });

    for (const el of candidates) {
      try {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
        await sleep(1200);
      } catch {}
    }

    const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    emit('diagnostic', { stage: 'progressive-scroll-start', detail: `height=${height}` });

    const step = Math.max(500, Math.floor(window.innerHeight * 0.7));
    for (let y = 0; y < height; y += step) {
      window.scrollTo(0, y);
      await sleep(700);
    }

    for (let y = Math.max(0, height - step); y > 0; y -= step * 2) {
      window.scrollTo(0, y);
      await sleep(500);
    }

    window.scrollTo(0, 0);
    emit('diagnostic', { stage: 'notes-trigger-done', detail: `pdCalls=${pdCalls}` });

    await sleep(20000);
    emit('diagnostic', { stage: 'monitor-finished', detail: `pdCalls=${pdCalls};captures=${seen.size}` });
  }

  triggerNotesSections().catch(error => emit('page-error', { error: `notes trigger: ${String(error)}` }));

  emit('installed');
})();
