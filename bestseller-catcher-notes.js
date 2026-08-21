// Runtime bridge for Best Seller Main Notes.
// Fragrantica public social cards are authoritative for note order/count (up to 6).
(function () {
  window.SHOBI_CATCHER_NOTES_BY_FID = {};

  async function loadOfficialCatcherNotes() {
    try {
      const response = await fetch('Personal Database/fragrantica-main-notes.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const perfumes = payload && payload.perfumes && typeof payload.perfumes === 'object' ? payload.perfumes : {};
      const byFid = {};
      for (const [key, perfume] of Object.entries(perfumes)) {
        if (!perfume || !Array.isArray(perfume.notes) || !perfume.notes.length) continue;
        const fid = String(perfume.fragrantica_id || key || '').trim();
        if (!fid) continue;
        byFid[fid] = perfume.notes
          .slice()
          .sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999))
          .slice(0, 6)
          .map(note => [String(note.note || '').trim(), String(note.sastojak_id || '').trim()])
          .filter(pair => pair[0]);
      }
      window.SHOBI_CATCHER_NOTES_BY_FID = byFid;
      return byFid;
    } catch (error) {
      console.error('Official Catcher browser bridge unavailable; social-card/static fallbacks will be used.', error);
      window.SHOBI_CATCHER_NOTES_BY_FID = {};
      return {};
    }
  }

  window.SHOBI_CATCHER_NOTES_READY = loadOfficialCatcherNotes();

  if (typeof init === 'function') {
    const baseInit = init;
    init = async function () {
      await window.SHOBI_CATCHER_NOTES_READY;
      return baseInit();
    };
  }

  const socialCardNotes = {
    "305-KAY EL": ["Brown Sugar","Tonka Bean","Amber","Amberwood","Orchid","Musk"],
    "1508-KIL WP": ["Cognac","Cinnamon","Vanilla","Praline","Tonka Bean","Oak"],
    "451-BYR WP": ["Aldehydes","Musk","Peony","Violet","Orange Blossom","Rose"],
    "374-TMFO EL": ["Tobacco","Vanilla","Spicy Notes","Dried Fruits","Cacao Pod","Tonka Bean"],
    "1899-ZARK EL": ["Cotton Flower","Musk","White Oud"],
    "111-BAC N": ["Amberwood","Saffron","Ambergris","Fir","Cedar","Jasmine"],
    "220-CRD EL": ["Coconut","Lime","Rum","Sugar","Bergamot","Mandarin Orange"],
    "350-TMFO EL": ["Sour Cherry","Almond","Black Cherry","Vanilla","Tonka Bean","Cherry Liqueur"],
    "2216-DOL WP": ["Candied Lemon","Vanilla","Panna Cotta","Orange Blossom","Rum"],
    "2129-SOL EL": ["Caramel","Vanilla","Pistachio","Almond","Salt","Sandalwood"],
    "371-TMFO EL": ["Coconut","Tuberose","Ylang-Ylang","Jasmine","Pistachio","Bergamot"],
    "449-BYR WP": ["Vetiver","Violet","Cyclamen","Bergamot","African Marigold","Cedar"],
    "204-CRD EL": ["Pineapple","Birch","Bergamot","Musk","Black Currant","Oakmoss"],
    "765-KIL WP": ["Sugar","Vanilla","Caramel","Orange Blossom","Neroli","Honeysuckle"],
    "994-ZAD WP": ["Cream","Vanilla","Chestnut","Sandalwood","Cashmir Wood","Pink Pepper"],
    "2371-MATIE EL": ["Vanilla","Coconut Powder","Musk","Palo Santo","Coconut","Lactones"],
    "2206-GIA LUX": ["Vanilla","Caramel","Coumarin","Honey","Musk"],
    "179-XER N": ["Honey","Tobacco","Lavender","Vanilla","Tonka Bean","Cinnamon"],
    "229-DIP EL": ["Fig Leaf","Fig","Green Notes","Coconut","Fig Tree","Woody Notes"],
    "2162-BRB WP": ["Vanilla","Lavender","Vanilla Caviar","Cacao Pod","Ginger"],
    "2398-FRE LUX": ["Aldehydes","Peach","Orange Blossom","Musk","Violet","Iso E Super"],
    "401-ARIA WP": ["Cream","Coconut","Praline","Musk","Lavender","Pear"],
    "1660-ESCE EL": ["Iso E Super"],
    "1499-BYR EL": ["Sapodilla","Magnolia","Violet","Ambrette (Musk Mallow)","Sandalwood","Ambergris"],
    "485-CAR WP": ["Tonka Bean","Cacao Pod","Vanilla","Tuberose","Almond","Jasmine"],
    "1520-YZLO W": ["Vanilla","Lavender","Tonka Bean","Orange Blossom","Jasmine","Mandarin Orange"],
    "152-PARF N": ["Rose","Litchi","Vanilla","Pear","Amber","Agarwood (Oud)"],
    "1735-XER N": ["Almond","Toffee","Milk","Vanilla","Saffron","Sandalwood"],
    "1498-BYR EL": ["Juniper","Vanilla","Sandalwood","Lemon","Pine Tree","Bergamot"],
    "132-LTN N": ["Agarwood (Oud)","Rose","Incense","Raspberry","Saffron","Amberwood"],
    "1919-PRA WP": ["Orange Blossom","Neroli","Jasmine","Vanilla","Pear","Amber"],
    "1764-GUR W": ["Hazelnut","Amberwood","Rum","Yuzu","Leather","Tobacco"],
    "131-LEL N": ["Sandalwood","Leather","Papyrus","Cedar","Cardamom","Violet"],
    "848-NRO WP": ["Musk","Cashmeran","Jasmine","Ylang-Ylang","Orange Blossom"],
    "2348-AMG": ["Sandalwood","Hazelnut","Pear","Vanilla","Akigalawood","Olibanum (Frankincense)"],
    "303-JOM EL": ["Salt","Sage","Grapefruit","Ambrette (Musk Mallow)","Seaweed"],
    "2155-KAY EL": ["Pistachio","Cream","Ice Cream","Marshmallow","Cotton Candy","Bergamot"],
    "750-KEN W": ["Raspberry","Praline","Powdery Notes","Vanilla","Rose","Mandarin Orange"],
    "1553-MNT N": ["Tonka Bean","Sugar","Agarwood (Oud)","Saffron","Rose","Amber"],
    "937-VAL WP": ["Vanilla","Black Currant","Jasmine","Cashmeran","Jasmine Tea","Pink Pepper"],
    "1937-BIL AR": ["Vanilla","Sugar","Cacao Pod","Spicy Notes","Tonka Bean","Amber"],
    "425-BRB WP": ["Strawberry","Raspberry","Musk","Blackberry","Vanilla","Sour Cherry"],
    "1883-NISH N": ["Bergamot","Oolong Tea","Orange","Mandarin Orange","Fig","Musk"],
    "760-KIL WP": ["Dark Chocolate","Rum","Caramel","Coffee","Sugar","Almond"],
    "2235-PRA WP": ["White Tobacco","Tobacco","Rose","Osmanthus","Vanilla","Leather"],
    "361-TMFO EL": ["Leather","Jasmine","Amber","Cardamom","Oakmoss","Patchouli"],
    "2346-TMFO EL": ["Vanilla","Sandalwood","Animal Notes","Orris Root","Jasmine"],
    "981-YZLO W": ["Lavender","Orange Blossom","Vanilla","Jasmine","Mandarin Orange","Musk"],
    "977-YZLO W": ["Vanilla","Coffee","Pear","Jasmine","Patchouli","Pink Pepper"],
    "364-TMFO EL": ["Agarwood (Oud)","Brazilian Rosewood","Cardamom","Sandalwood","Sichuan Pepper","Vanilla"],
    "847-NRO WP": ["Musk","Jasmine","Coumarin","Rose","Orange Blossom","Cedar"],
    "1909-XER N": ["Mint","Lemon","Basil","Musk","Black Currant","Lavender"],
    "2150-LEL EL": ["Fig","Cedar","Matcha Tea","Bitter Orange","Vetiver"],
    "430-BRB WP": ["Rose","Dark Chocolate","Osmanthus","Vetiver"],
    "1635-XER N": ["Vanilla","Caramel","Cinnamon","Musk","Jasmine","Blood Orange"],
    "2365-DIP N": ["Musk","Sesame","Mimosa","Woody Notes"],
    "2320-LTN N": ["Tea","Citron","Bergamot","Orange","Neroli","Ambroxan"],
    "528-DRC W": ["Vanilla","Almond","Coconut","Sandalwood","Musk","Plum"],
    "1974-MARG EL": ["Soap","Musk","Coconut","Lavender","Jasmine","Rose"],
    "1801-JUL EL": ["Cetalox"],
    "694-GUR W": ["Tiare Flower","Jasmine","Ylang-Ylang","Coconut","Vanilla","Orange Blossom"],
    "2136-PARF": ["Musk","Aldehydes","Peach","Ambroxan","Orange Blossom","Bergamot"],
    "2161-GUR W": ["Clementine","Mandarin Orange","Basil","Bitter Orange","Tea","Orange Blossom"],
    "1946-MARC N": ["Mineral Notes","Suede","Saffron","Akigalawood","Osmanthus","Mandarin Orange"],
    "1850-LEL N": ["Iso E Super","Musk","Ambergris","Ambrette (Musk Mallow)","Pear","Cetalox"],
    "151-PARF N": ["Rose","Litchi","Rhubarb","Peony","Musk","Petalia"],
    "761-KIL WP": ["Osmanthus","Tuberose","Jasmine","Narcissus","Rose","Amber"],
    "641-FRE WP": ["Rose","Patchouli","Incense","Cloves","Raspberry","Sandalwood"],
    "154-PARF N": ["Vanilla","Apple","Cardamom","Lavender","Sandalwood","Pepper"],
    "1887-XER N": ["Fruity Notes","Musk","Vanilla","Orange","Amber","Bergamot"],
    "506-CHA W": ["Patchouli","Orange","Rose","Mandarin Orange","Bergamot","Orange Blossom"],
    "210-CRD EL": ["Violet Leaf","Iris","Ambergris","Sandalwood","Vervain"],
    "268-JOM EL": ["Myrrh","Tonka Bean","Vanilla","Lavender","Almond"],
    "1112-DSQ MP": ["Violet","Cedar","Vetiver","Pepper","Incense","Musk"],
    "879-PRA WP": ["Iris","Cedar","Incense","Orange Blossom","Benzoin","Neroli"],
    "2167-GUL MP": ["Vanilla","Honey","Tonka Bean","Lavender","Tobacco","Mint"],
    "513-CHL WP": ["Powdery Notes","Iris","Rice","Lilac","Musk","Hyacinth"],
    "1737-GIV W": ["Tuberose","Ginger","Blood Orange","Sandalwood","Jasmine","Patchouli"],
    "1513-KIL WP": ["Marshmallow","Matcha Tea","Ginger"],
    "1476-NRO WP": ["Musk","Plum","Suede","Heliotrope"],
    "318-MNT EL": ["Cacao Pod","Vanilla","Tonka Bean","Bitter Orange","Dried Fruits","Coffee"],
    "1775-DIP N": ["Powdery Notes","Juniper Berries","Cedar","Jasmine","Tonka Bean"],
    "1651-TMU W": ["Coconut Water","Vanilla","Jasmine","Cashmeran","Bergamot","Heliotrope"],
    "1846-MAN EL": ["Vanilla","Coconut","Tiare Flower","Ylang-Ylang","Jasmine","Peach"],
    "2053-BDIK": ["Sandalwood","Cardamom","Fig","Vanilla","Tea","Tonka Bean"],
    "355-TMFO EL": ["Orange Blossom","Neroli","Bergamot","Mandarin Orange","Lemon","Bitter Orange"],
    "1528-KUR N": ["Almond","Saffron","Ambergris","Woody Notes","Musk","Jasmine"],
    "359-TMFO EL": ["Vanilla","Kulfi","Cardamom","Amber","Nutmeg","Woody Notes"],
    "2369-MAN EL": ["Coffee","Brown Sugar","Vanilla","Amaretto","Ice Cream","Ambergris"],
    "1618-NISH N": ["Vanilla","Ginger","Bergamot","Cardamom","Benzoin","Sandalwood"],
    "2154-KAY EL": ["Coconut","Vanilla","Tuberose","Jasmine","Gardenia","Sandalwood"],
    "225-DIP EL": ["Orange Blossom","Bitter Orange","Angelica","Juniper Berries","Patchouli"],
    "2261-PARF": ["Vanilla","Praline","Cinnamon","Orange Blossom","Cardamom","Musk"],
    "124-INI N": ["Rum","Tobacco","Cinnamon","Saffron","Sandalwood","Hedione"],
    "181-XER N": ["Palisander Rosewood","Agarwood (Oud)","Lavender","Sandalwood","Amber","Vanilla"],
    "955-VICT WP": ["Honeysuckle","Jasmine","Chamomile","Aloe Vera"],
    "1156-HER M": ["Orange","Vetiver","Pepper","Grapefruit","Cedar","Patchouli"],
    "919-TMU W": ["Vetiver","Fir","Geranium","Tonka Bean","Oakmoss","Pepper"],
    "944-VER W": ["Coconut","Gardenia","Pepper","Ginger","Cardamom","Sandalwood"],
    "1185-JOO MP": ["Juniper Berries","Lavender","Lemon","Woody Notes","Sage","Bergamot"]
  };

  window.SHOBI_SOCIAL_CARD_NOTES_BY_CODE = socialCardNotes;
  document.addEventListener('DOMContentLoaded', function () {
    window.SHOBI_CATCHER_NOTES_BY_CODE = window.SHOBI_CATCHER_NOTES_BY_CODE || {};
    Object.entries(socialCardNotes).forEach(([code, cardNotes]) => {
      window.SHOBI_CATCHER_NOTES_BY_CODE[code] = cardNotes.slice();
    });
    console.log(`Social-card authority applied: ${Object.keys(socialCardNotes).length} Top100 records.`);
  });
})();
