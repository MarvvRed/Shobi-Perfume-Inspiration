/*
 * Shobi Perfume Inspiration
 * Fragrantica Main Notes Catcher
 *
 * Purpose:
 * - Hooks Fragrantica's global _pd decryptor on a perfume page.
 * - Captures the already-decoded Main Notes data.
 * - Stores captures persistently in localStorage across page navigations.
 * - Records rank, note name, ingredient id, raw weight, percentage,
 *   and pyramid level (top/middle/base).
 *
 * Usage (Firefox DevTools Console, multiline editor):
 * 1. Open a Fragrantica perfume page.
 * 2. Open DevTools > Console and paste/run this script.
 * 3. Trigger/load the perfume notes on the page.
 * 4. Navigate to another perfume page and run this script again.
 * 5. Captures persist in localStorage under STORAGE_KEY.
 *
 * Export all captures:
 *   copy(localStorage.getItem("shobi_fragrantica_main_notes"))
 *
 * IMPORTANT: This is a research/data-capture utility. It does not modify
 * the Shobi website/database by itself.
 */

(() => {
  const STORAGE_KEY = "shobi_fragrantica_main_notes";

  const loadCaptures = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  };

  const saveCaptures = data => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  // Avoid installing the catcher twice on the same page.
  if (window.__shobiCatcherInstalled) {
    console.log("ℹ️ SHOBI catcher già attivo");
    return;
  }

  if (typeof window._pd !== "function") {
    console.error("❌ Fragrantica _pd non disponibile su questa pagina");
    return;
  }

  window.__shobiCatcherInstalled = true;

  const nativePd = window._pd;

  window._pd = function(arg, ...rest) {
    const result = nativePd.call(this, arg, ...rest);

    Promise.resolve(result).then(decoded => {
      if (!decoded?.notes?.length || !decoded?.weights_sum) return;

      const perfume =
        document.querySelector("h1")?.innerText?.trim() ||
        document.title;

      const url = location.href.split("#")[0];

      const getLevel = id => {
        if (decoded.pyramid?.top?.some(n => n.sastojak_id === id)) {
          return "top";
        }

        if (decoded.pyramid?.middle?.some(n => n.sastojak_id === id)) {
          return "middle";
        }

        if (decoded.pyramid?.base?.some(n => n.sastojak_id === id)) {
          return "base";
        }

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

      const signature = notes
        .map(n => `${n.sastojak_id}:${n.weight}`)
        .join("|");

      const key = url + "|" + signature;
      const captures = loadCaptures();

      if (captures[key]) return;

      captures[key] = {
        perfume,
        url,
        weights_sum: decoded.weights_sum,
        captured_at: new Date().toISOString(),
        notes
      };

      saveCaptures(captures);

      console.log(`💾 SAVED: ${perfume} | ${notes.length} Main Notes`);
      console.table(notes);
      console.log(`📚 TOTAL SAVED: ${Object.keys(captures).length}`);
    });

    return result;
  };

  console.log("🚀 SHOBI FRAGRANTICA CATCHER PERSISTENTE ATTIVO");
})();
