(() => {
  const script = document.createElement('script');
  script.src = browser.runtime.getURL('page-catcher.js');
  script.onload = () => script.remove();
  (document.documentElement || document.head).appendChild(script);

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== 'shobi-main-notes-page') return;

    if (msg.type === 'capture') {
      browser.runtime.sendMessage({ type: 'capture', payload: msg.payload });
    } else if (msg.type === 'installed') {
      browser.runtime.sendMessage({ type: 'installed', url: location.href });
      triggerPageActivity();
    } else if (msg.type === 'page-error') {
      browser.runtime.sendMessage({ type: 'page-error', error: msg.error, url: location.href });
    }
  });

  function triggerPageActivity() {
    let y = 0;
    const max = Math.max(document.body?.scrollHeight || 0, 4000);
    const timer = setInterval(() => {
      y += 700;
      window.scrollTo(0, Math.min(y, max));
      if (y >= max) {
        clearInterval(timer);
        setTimeout(() => window.scrollTo(0, 0), 700);
      }
    }, 350);
  }
})();
