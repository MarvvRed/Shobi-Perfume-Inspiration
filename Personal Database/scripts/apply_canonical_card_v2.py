from pathlib import Path
import re

FILES = [Path('index.html'), Path('index-v2.html')]

STYLE = r'''<style id="canonical-card-v2-all">
/* CANONICAL_CARD_V2_ALL — approved 1067-CHA model, applied to every perfume */
.card{display:flex;flex-direction:column;overflow:hidden;border-radius:18px!important}
.card-head{padding:15px 15px 9px;min-height:72px;background:var(--theme-card,var(--surface));border:0!important}
.card-head .perfume-name{font-size:16px!important;font-weight:800!important;line-height:1.2!important;min-height:0!important}
.brand-code{display:flex;align-items:baseline;gap:8px;margin-top:6px}
.brand-filter{appearance:none;border:0;background:transparent;padding:0;color:var(--theme-accent,#c7a86b);font:inherit;font-size:12px;font-weight:800;text-transform:none;cursor:pointer;text-align:left}
.brand-filter:hover{text-decoration:underline;text-underline-offset:2px}.card-head .code{margin:0!important;padding:0!important;border:0!important;font-size:10px!important}
.bestseller-line{display:flex;justify-content:center;min-height:26px;padding:0 12px 4px}.bestseller-badge{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--theme-border-strong,rgba(199,168,107,.36));border-radius:999px;background:rgba(199,168,107,.13);color:var(--theme-accent-2,#d7bc83);font-size:11px;font-weight:900;letter-spacing:.02em;padding:5px 10px}
.card-image-wrap{height:168px!important;min-height:168px!important;display:flex!important;align-items:center;justify-content:center;overflow:hidden;background:transparent!important;border:0!important;padding:0 10px 3px;position:relative}
.fragrantica-image-link{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;text-decoration:none;border-radius:12px;cursor:pointer;outline:none}.fragrantica-image-link:hover{background:rgba(199,168,107,.05)}.fragrantica-image-link:focus-visible{box-shadow:0 0 0 2px var(--theme-accent,#c7a86b)}
.card-image{display:block!important;width:100%!important;height:100%!important;max-width:96%;max-height:164px;object-fit:contain!important;object-position:center;padding:0!important;margin:0!important;transition:transform .18s ease}.fragrantica-image-link:hover .card-image{transform:scale(1.025)}
.fragrantica-badge{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(20,20,20,.90);color:#fff;font-size:11px;font-weight:900;padding:6px 10px;box-shadow:0 4px 12px rgba(0,0,0,.28);opacity:.96}.fragrantica-image-link:hover .fragrantica-badge{background:#111;transform:translateX(-50%) translateY(-1px)}
.card-body{padding:10px 15px 12px!important;display:flex;flex-direction:column;min-height:0!important}.meta-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.meta-separator{width:1px;height:20px;background:var(--theme-border-strong,rgba(199,168,107,.35));margin:0 1px}
.card .badge,.card .note-chip{appearance:none;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--theme-border,rgba(199,168,107,.20));border-radius:999px;background:rgba(199,168,107,.09);color:var(--theme-accent-2,#d7bc83);font-size:11px;font-weight:800;line-height:1;padding:5px 7px;cursor:pointer}.card .badge:hover,.card .note-chip:hover{border-color:var(--theme-accent,#c7a86b);background:rgba(199,168,107,.14)}
.gender-fa{font-size:14px}.season-emoji{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-size:18px;line-height:1}.main-notes-title{margin-top:10px;margin-bottom:6px;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--theme-muted,#aaa39a)}.card .notes{display:flex;flex-wrap:wrap;gap:6px;margin:0!important;max-height:none!important;overflow:visible!important}.card .note-chip{padding-left:5px}.note-icon-img{width:20px;height:20px;border-radius:50%;object-fit:cover;display:block;flex:0 0 20px;background:rgba(255,255,255,.7)}
.card-actions{display:flex!important;flex-direction:column!important;gap:7px!important;margin-top:auto!important;padding:12px 15px 15px!important;border-top:1px solid var(--theme-border,rgba(199,168,107,.18));background:var(--theme-card,var(--surface))}.card-actions button,.card-actions a{height:32px!important;min-height:32px!important;border-radius:9px!important;font-size:11px!important}.card-actions .details{order:1!important;width:100%;background:transparent!important;color:var(--theme-accent-2,#d7bc83)!important;border-color:var(--theme-border-strong,rgba(199,168,107,.36))!important}.card-actions .shop-action{order:2!important;width:100%;background:var(--theme-accent,#c7a86b)!important;color:#17130d!important;border-color:var(--theme-accent,#c7a86b)!important;font-weight:900!important}.primary-actions{order:3;display:grid;grid-template-columns:1fr 1fr;gap:7px}.primary-actions button{width:100%}.card .new-badge{cursor:default}
@media(max-width:420px){.card-head{padding:13px 12px 8px}.card-image-wrap{height:158px!important;min-height:158px!important}.card-body{padding:10px 12px 11px!important}.card-actions{padding:11px 12px 12px!important}}
</style>'''

# Fragrantica ingredient IDs used in the approved prototype plus common notes.
NOTE_IDS = {
    'grapefruit':76,'lemon':77,'mint':160,'pink pepper':91,'ginger':62,
    'bergamot':75,'orange':80,'mandarin orange':82,'lime':78,'lavender':1,
    'vanilla':74,'rose':105,'jasmine':14,'patchouli':34,'sandalwood':33,
    'cedar':41,'musk':4,'amber':54,'tobacco':96,'cinnamon':65,'cardamom':63,
    'vetiver':2,'iris':11,'violet':116,'apple':148,'pear':182,'pineapple':170,
    'coconut':138,'coffee':149,'cacao':102,'honey':181,'tonka bean':73,
    'leather':156,'oud':114,'incense':68,'neroli':17,'ylang-ylang':24,
    'tuberose':25,'peach':117,'black currant':132,'raspberry':189,'cherry':297,
}

# JS renderer. Note icons use local cached files when mapped, otherwise no fabricated icon.
CARD_JS = r'''function noteIconHtml(v){const m={"grapefruit":76,"lemon":77,"mint":160,"pink pepper":91,"ginger":62,"bergamot":75,"orange":80,"mandarin orange":82,"lime":78,"lavender":1,"vanilla":74,"rose":105,"jasmine":14,"patchouli":34,"sandalwood":33,"cedar":41,"musk":4,"amber":54,"tobacco":96,"cinnamon":65,"cardamom":63,"vetiver":2,"iris":11,"violet":116,"apple":148,"pear":182,"pineapple":170,"coconut":138,"coffee":149,"cacao":102,"honey":181,"tonka bean":73,"leather":156,"oud":114,"incense":68,"neroli":17,"ylang-ylang":24,"tuberose":25,"peach":117,"black currant":132,"raspberry":189,"cherry":297};const id=m[norm(v)];return id?`<img class="note-icon-img" src="./note-icons/en/${id}.jpg" alt="" loading="lazy" decoding="async">`:""}
function canonicalShopUrl(code,raw){const k=ck(code);if(k==="1067-CHA")return "https://leparfum.com.gr/en/fragrances-for-men/1067-cha-m";return raw||""}
function card(p){const x=extra(p),se=x[0]||[],img=x[1]||"",notes=x[2]||[],sh=canonicalShopUrl(p.code,x[3]||""),frag=x[4]||"",key=ck(p.code);const genderIcon=v=>{const z=String(v||"").toLowerCase();if(z.includes("female")||z.includes("women")||z==="woman")return '<i class="fa-solid fa-venus gender-fa gender-fa-women" aria-hidden="true"></i>';if(z.includes("male")||z.includes("men")||z==="man")return '<i class="fa-solid fa-mars gender-fa gender-fa-men" aria-hidden="true"></i>';return '<i class="fa-solid fa-venus-mars gender-fa gender-fa-unisex" aria-hidden="true"></i>'};const seasonIcon=v=>{const z=String(v||"").toLowerCase();return z.includes("spring")?"🌸":z.includes("summer")?"☀️":z.includes("autumn")||z.includes("fall")?"🍂":z.includes("winter")?"❄️":""};const imageHtml=img?(frag?`<div class="card-image-wrap"><a class="fragrantica-image-link" href="${esc(frag)}" target="_blank" rel="noopener" data-action="frag-link" aria-label="View ${esc(p.name)} on Fragrantica"><img class="card-image" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" decoding="async"><span class="fragrantica-badge">Fragrantica ↗</span></a></div>`:`<div class="card-image-wrap"><img class="card-image" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" decoding="async"></div>`):`<div class="card-image-wrap"><span class="image-placeholder">No image</span></div>`;return `<article class="card canonical-card-v2" data-code="${esc(key)}"><div class="card-head"><div class="perfume-name">${esc(p.name.toUpperCase())}</div><div class="brand-code">${p.brand?`<button class="brand brand-filter" data-action="brand">${esc(p.brand)}</button>`:""}<span class="code">${esc(p.code)}</span></div></div><div class="bestseller-line">${p.rank?`<span class="bestseller-badge">BEST SELLER #${p.rank}</span>`:""}</div>${imageHtml}<div class="card-body"><div class="meta-row">${p.gender?`<button class="badge icon-badge gender-badge" data-action="gender"><span class="gender-badge-icon" aria-hidden="true">${genderIcon(p.gender)}</span><span class="gender-badge-label">${esc(labelCase(p.gender))}</span></button>`:""}${p.gender&&se.length?'<span class="meta-separator" aria-hidden="true"></span>':""}${se.map(v=>`<button class="badge icon-badge season-badge" data-action="season" data-value="${esc(v)}"><span class="season-badge-icon season-emoji" aria-hidden="true">${seasonIcon(v)}</span><span class="season-badge-label">${esc(labelCase(v))}</span></button>`).join("")}${p.isNew?'<span class="badge new-badge">NEW</span>':""}</div>${notes.length?`<div class="main-notes-title">Main Notes</div><div class="notes">${notes.slice(0,5).map(v=>`<button class="note-chip" data-action="note" data-value="${esc(v)}">${noteIconHtml(v)}<span>${esc(labelCase(v))}</span></button>`).join("")}</div>`:""}</div><div class="card-actions"><button class="details" data-action="details">More detail</button>${sh?`<a class="shop-action" href="${esc(sh)}" target="_blank" rel="noopener" data-action="link">SHOP ON SHOBI</a>`:""}<div class="primary-actions"><button class="favorite-action ${favorites.has(key)?"active":""}" data-action="fav">${favorites.has(key)?"♥ Favorited":"♡ Favorite"}</button><button class="owned ${owned.has(key)?"active":""}" data-action="owned">${owned.has(key)?"Owned":"Collection"}</button></div></div></article>`}'''


def patch(path: Path):
    s = path.read_text(encoding='utf-8')

    # Remove prior canonical block if rerun, then append immediately before </head>.
    s = re.sub(r'<style id="canonical-card-v2-all">.*?</style>', '', s, flags=re.S)
    if '</head>' not in s:
        raise RuntimeError(f'{path}: missing </head>')
    s = s.replace('</head>', STYLE + '</head>', 1)

    # Replace renderer from function card(p) through just before function render().
    start = s.find('function card(p){')
    end = s.find('\nfunction render()', start)
    if start < 0 or end < 0:
        raise RuntimeError(f'{path}: card renderer boundaries not found')
    s = s[:start] + CARD_JS + s[end:]

    # Extend delegated click handling with canonical brand + Fragrantica actions.
    old = 'if(a==="link")return;if(a==="fav")'
    new = 'if(a==="link"||a==="frag-link")return;if(a==="fav")'
    if old in s:
        s = s.replace(old, new, 1)
    elif new not in s:
        raise RuntimeError(f'{path}: link action hook not found')

    anchor = 'else if(a==="gender"){selected.gender.add(byCode.get(k).gender);page=1;buildFilters();apply()}'
    brand = 'else if(a==="brand"){selected.brand.add(byCode.get(k).brand);page=1;buildFilters();apply()}'
    if brand not in s:
        if anchor not in s:
            raise RuntimeError(f'{path}: gender action hook not found')
        s = s.replace(anchor, brand + anchor, 1)

    # Assertions protecting bestseller semantics and canonical-data use.
    required = [
        'rank:x[6]||0',
        'sortMode==="bestsellers"',
        'BEST SELLER #${p.rank}',
        'img=x[1]||""',
        'frag=x[4]||""',
        'data-action="brand"',
        'data-action="frag-link"',
        'notes.slice(0,5)',
    ]
    missing = [v for v in required if v not in s]
    if missing:
        raise RuntimeError(f'{path}: validation failed: {missing}')
    if 'demoImg=' in s:
        raise RuntimeError(f'{path}: legacy demo image regression still present')

    path.write_text(s, encoding='utf-8')


for f in FILES:
    patch(f)
    print(f'patched {f}')
