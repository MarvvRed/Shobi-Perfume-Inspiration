// Extends the stable Best Seller ranking after the frozen canonical Top100 payload has loaded.
// Ranks 41-100 MUST come from CANONICAL-TOP100-v1, never from legacy enrichment.
(function(){
  const ranking=window.SHOBI_BESTSELLER_RANKING||[];
  const seen=new Set(ranking.map(x=>Number(x.rank)));

  // Canonical Top100 is the only ranking authority for 41-100 here.
  Object.values(window.SHOBI_FRAGRANTICA_CANONICAL_TOP100||{})
    .filter(x=>Number(x.rank)>=41&&Number(x.rank)<=100)
    .sort((a,b)=>Number(a.rank)-Number(b.rank))
    .forEach(x=>{
      const r=Number(x.rank);
      const code=String(x.shobi_code||'').trim();
      if(!code) throw new Error(`Canonical Top100 missing Shobi code at rank ${r}`);
      if(!seen.has(r)){
        ranking.push({rank:r,globalRank:null,code});
        seen.add(r);
      }
    });

  // Guard: the site must have the complete frozen Top100 ranking before legacy 101+ is appended.
  for(let r=1;r<=100;r++){
    if(!seen.has(r)) throw new Error(`Canonical bestseller rank missing from site order: ${r}`);
  }

  // Existing 101-200 continuation remains untouched; it is outside CANONICAL-TOP100-v1.
  const extra=[{"rank":101,"code":"181-XER N"},{"rank":102,"code":"1156-HER M"},{"rank":103,"code":"955-VICT WP"},{"rank":104,"code":"919-TMU W"},{"rank":105,"code":"944-VER W"},{"rank":106,"code":"1185-JOO MP"},{"rank":107,"code":"2211-YZLO M"},{"rank":108,"code":"1546-TMFO EL"},{"rank":109,"code":"2580-KAY EL"},{"rank":110,"code":"782-LAN W"},{"rank":111,"code":"1288-YZLO M"},{"rank":112,"code":"139-KUR N"},{"rank":113,"code":"2468-ESPAR N"},{"rank":114,"code":"372-TMFO EL"},{"rank":115,"code":"1930-VIC M"},{"rank":116,"code":"2183-MIY WP"},{"rank":117,"code":"1697-LEL N"},{"rank":118,"code":"845-NRO WP"},{"rank":119,"code":"565-DOL WP"},{"rank":120,"code":"1280-YZLO M"},{"rank":121,"code":"2044-LORV EL"},{"rank":122,"code":"1922-ORT LUX"},{"rank":123,"code":"1762-ETLR N"},{"rank":124,"code":"766-KIL WP"},{"rank":125,"code":"2287-VAL WP"},{"rank":126,"code":"1956-JOM EL"},{"rank":127,"code":"972-VICT WP"},{"rank":128,"code":"2267-KAY EL"},{"rank":129,"code":"2301-DIP N"},{"rank":130,"code":"918-TMU W"},{"rank":131,"code":"499-CHA"},{"rank":132,"code":"1271-VAN MP"},{"rank":133,"code":"1229-PAC MP"},{"rank":134,"code":"1726-MNTB WP"},{"rank":135,"code":"450-BYR WP"},{"rank":136,"code":"2406-KIL EL"},{"rank":137,"code":"1126-ARM M"},{"rank":138,"code":"224-DIP EL"},{"rank":139,"code":"1881-INI N"},{"rank":140,"code":"2357-CRD EL"},{"rank":141,"code":"2059-NARC"},{"rank":142,"code":"1938-YZLO N"},{"rank":143,"code":"340-TMFO EL"},{"rank":144,"code":"2040-AMG EL"},{"rank":145,"code":"1686-PRA MP"},{"rank":146,"code":"2052-CAR WP"},{"rank":147,"code":"1620-GUR N"},{"rank":148,"code":"351-TMFO EL"},{"rank":149,"code":"1289-YZLO M"},{"rank":150,"code":"1895-HER M"},{"rank":151,"code":"1757-DIP N"},{"rank":152,"code":"1619-NISH N"},{"rank":153,"code":"1127-ARM M"},{"rank":154,"code":"557-DOL W"},{"rank":155,"code":"1817-JUL"},{"rank":156,"code":"654-ARM W"},{"rank":157,"code":"232-ESCE EL"},{"rank":158,"code":"842-NRO WP"},{"rank":159,"code":"251-JOM EL"},{"rank":160,"code":"755-KEN WP"},{"rank":161,"code":"306-LAN EL"},{"rank":162,"code":"321-NAS EL"},{"rank":163,"code":"120-INI N"},{"rank":164,"code":"177-TER N"},{"rank":165,"code":"669-GIV W"},{"rank":166,"code":"2051-PRFRO"},{"rank":167,"code":"1671-KIL N"},{"rank":168,"code":"1484-VAL MP"},{"rank":169,"code":"2581-GUR LUX"},{"rank":170,"code":"1648-FRE N"},{"rank":171,"code":"803-LAU WP"},{"rank":172,"code":"620-EST WP"},{"rank":173,"code":"1065-CHA M"},{"rank":174,"code":"2408-JOM EL"},{"rank":175,"code":"409-BOB WP"},{"rank":176,"code":"2426-MARG EL"},{"rank":177,"code":"2437-MELA EL"},{"rank":178,"code":"2549-MARC EL"},{"rank":179,"code":"2401-KAY EL"},{"rank":180,"code":"1747-VICT WP"},{"rank":181,"code":"1920-XER N"},{"rank":182,"code":"137-KUR N"},{"rank":183,"code":"1882-MARG N"},{"rank":184,"code":"1760-FRE N"},{"rank":185,"code":"1480-ARM M"},{"rank":186,"code":"510-CHL WP"},{"rank":187,"code":"1275-VER M"},{"rank":188,"code":"1136-ARM M"},{"rank":189,"code":"1123-ARM M"},{"rank":190,"code":"1752-JUL N"},{"rank":191,"code":"1944-KUR N"},{"rank":192,"code":"762-KIL WP"},{"rank":193,"code":"2117-YZLO W"},{"rank":194,"code":"346-TMFO EL"},{"rank":195,"code":"722-GUL WP"},{"rank":196,"code":"2164-LAT EL"},{"rank":197,"code":"863-PAC WP"},{"rank":198,"code":"1795-MARG AR"},{"rank":199,"code":"135-KUR N"},{"rank":200,"code":"1939-BYR N"}];
  extra.forEach(x=>{if(!seen.has(Number(x.rank))){ranking.push(x);seen.add(Number(x.rank));}});
  ranking.sort((a,b)=>Number(a.rank)-Number(b.rank));
  window.SHOBI_BESTSELLER_RANKING=ranking;
  window.SHOBI_BESTSELLER_CODES=ranking.map(x=>x.code);
  window.SHOBI_BESTSELLER_RANK_BY_CODE=Object.fromEntries(ranking.map(x=>[x.code,x.rank]));
  window.SHOBI_BESTSELLER_GLOBAL_RANK_BY_CODE=Object.fromEntries(ranking.filter(x=>x.globalRank!=null).map(x=>[x.code,x.globalRank]));
  console.log('Canonical Top100 ranking extension loaded from CANONICAL-TOP100-v1.');
})();
