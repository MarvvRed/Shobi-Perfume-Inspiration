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
      browser.runtime.sendMessage({ type: 'capture', payload: msg.payload });
    } else if (msg.type === 'installed') {
      browser.runtime.sendMessage({ type: 'installed', url: location.href });
    } else if (msg.type === 'page-error') {
      browser.runtime.sendMessage({ type: 'page-error', error: msg.error, url: location.href });
    }
  });
})();
