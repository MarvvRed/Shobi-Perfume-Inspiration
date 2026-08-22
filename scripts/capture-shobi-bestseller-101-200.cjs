const fs = require('fs');
const { chromium } = require('playwright');

const BASE_URL = 'https://leparfum.com.gr/en/best-sales?category_rewrite=best-sales&resultsPerPage=36&page=';
const MASTER_PATH = 'shobi-master-en.csv';
const OUT_PATH = 'bestseller-101-200.json';
const CDP_URL = process.env.SHOBI_CDP_URL || 'http://127.0.0.1:9222';
const ALIASES = new Map([
  ['1685-FRED N','1685-FRE N'],
  ['1068-CHA','1068-CHA M'],
  ['1930-VIC','1930-VIC M'],
  ['1156-HER','1156-HER M'],
  ['1065-CHA','1065-CHA M'],
]);

function clean(v){ return String(v || '').replace(/\s+/g,' ').trim(); }
function normCode(v){
  const s = clean(v).toUpperCase().replace(/Ν/g,'N');
  const m = s.match(/^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?/);
  if(!m) return s;
  const code = `${m[1]}-${m[2]}${m[3] ? ' '+m[3] : ''}`;
  return ALIASES.get(code) || code;
}
function parseCsv(text){
  const rows=[]; let row=[],field='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(q && text[i+1]==='"'){ field+='"'; i++; } else q=!q;
    } else if(c===',' && !q){ row.push(field); field=''; }
    else if((c==='\n'||c==='\r') && !q){
      if(c==='\r' && text[i+1]==='\n') i++;
      row.push(field); if(row.some(v=>v!=='')) rows.push(row); row=[]; field='';
    } else field+=c;
  }
  if(field.length||row.length){ row.push(field); rows.push(row); }
  return rows;
}
function loadMasterCodes(){
  const rows=parseCsv(fs.readFileSync(MASTER_PATH,'utf8').replace(/^\uFEFF/,''));
  const header=rows.shift();
  const idx=header.indexOf('shobi_code');
  if(idx<0) throw new Error('Master missing shobi_code');
  const codes=new Set(rows.map(r=>normCode(r[idx])).filter(Boolean));
  if(codes.size<2200) throw new Error(`Master unexpectedly small: ${codes.size}`);
  return codes;
}

(async()=>{
  const master=loadMasterCodes();
  const browser=await chromium.connectOverCDP(CDP_URL);
  const contexts=browser.contexts();
  const context=contexts[0];
  if(!context) throw new Error('No browser context from CDP');
  const page=context.pages()[0] || await context.newPage();
  const filtered=[]; const seen=new Set(); let globalRank=0;

  for(let pageNo=1; pageNo<=20 && filtered.length<200; pageNo++){
    const url=BASE_URL+pageNo;
    let ok=false, lastErr=null;
    for(let attempt=1; attempt<=4; attempt++){
      try{
        await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForSelector('article.product-miniature',{timeout:30000});
        ok=true; break;
      }catch(e){ lastErr=e; console.log(`BEST_SALES_RETRY page=${pageNo} attempt=${attempt} ${e.message}`); await page.waitForTimeout(1500*attempt); }
    }
    if(!ok) throw lastErr || new Error(`Failed page ${pageNo}`);

    const titles=await page.$$eval('article.product-miniature', cards => cards.map(card => {
      const a=card.querySelector('h2.product-title a, .product-title a');
      return a ? a.textContent.trim() : '';
    }).filter(Boolean));
    if(!titles.length) throw new Error(`No products parsed on page ${pageNo}`);

    for(const title of titles){
      globalRank++;
      const m=clean(title).match(/^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-ZΑ-Ω0-9]+))?\b/i);
      if(!m) continue;
      const code=normCode(`${m[1]}-${m[2]}${m[3] ? ' '+m[3] : ''}`);
      if(!master.has(code) || seen.has(code)) continue;
      seen.add(code);
      filtered.push({rank:filtered.length+1,globalRank,code});
      if(filtered.length>=200) break;
    }
    console.log(`PAGE ${pageNo}: perfume_count=${filtered.length}`);
  }

  if(filtered.length<200) throw new Error(`Only ${filtered.length} valid perfume best sellers found`);
  const batch=filtered.filter(x=>x.rank>=101 && x.rank<=200);
  if(batch.length!==100) throw new Error(`Expected 100 rows, got ${batch.length}`);
  fs.writeFileSync(OUT_PATH,JSON.stringify({count:100,rows:batch},null,2));
  console.log('BESTSELLER_101_200_COUNT',batch.length);
  console.log('RANK_101',JSON.stringify(batch[0]));
  console.log('RANK_200',JSON.stringify(batch[99]));
  await browser.close();
})().catch(err=>{ console.error(err); process.exit(1); });
