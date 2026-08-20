(() => {
  browser.runtime.sendMessage({ type: 'diagnostic', stage: 'bridge-content-start', url: location.href });

  const script = document.createElement('script');
  script.src = browser.runtime.getURL('page-catcher.js');
  script.onload = () => {
    browser.runtime.sendMessage({ type: 'diagnostic', stage: 'page-catcher-script-loaded', url: location.href });
    script.remove();
  };
  script.onerror = () => {
    browser.runtime.sendMessage({ type: 'diagnostic', stage: 'page-catcher-script-error', url: location.href });
  };
  (document.documentElement || document.head).appendChild(script);

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== 'shobi-main-notes-page') return;

    if (msg.type === 'diagnostic') {
      browser.runtime.sendMessage({ type: 'diagnostic', stage: msg.stage, detail: msg.detail, url: location.href });
    } else if (msg.type === 'capture') {
      Promise.resolve(browser.runtime.sendMessage({ type: 'capture', payload: msg.payload }))
        .then(result => {
          window.postMessage({
            source: 'shobi-main-notes-extension',
            type: 'save-result',
            ok: !!result?.ok,
            error: result?.error || null,
            notes: msg.payload?.notes?.length || 0
          }, '*');
        })
        .catch(error => {
          window.postMessage({
            source: 'shobi-main-notes-extension',
            type: 'save-result',
            ok: false,
            error: String(error?.message || error),
            notes: msg.payload?.notes?.length || 0
          }, '*');
        });
    } else if (msg.type === 'installed') {
      browser.runtime.sendMessage({ type: 'installed', url: location.href });
    } else if (msg.type === 'page-error') {
      browser.runtime.sendMessage({ type: 'page-error', error: msg.error, url: location.href });
    }
  });
})();
