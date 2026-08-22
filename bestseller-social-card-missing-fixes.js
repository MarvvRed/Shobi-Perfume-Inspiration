// Targeted social-card records missing from or corrected against the current Top100 authority map.
(function(){
  const map = window.SHOBI_SOCIAL_CARD_NOTES_BY_CODE || (window.SHOBI_SOCIAL_CARD_NOTES_BY_CODE = {});
  map['1644-DRC M'] = ['Lavender','Licorice','Nutmeg','Cinnamon','Sandalwood','Cardamom'];
  map['1067-CHA M'] = ['Grapefruit','Incense','Lemon','Ginger','Mint','Cedar'];

  // Best Seller 95-100: Fragrantica social-card authority.
  // #96 Coconut Passion — ID 7993
  map['955-VICT WP'] = ['Coconut','Vanilla','Lily-of-the-Valley','Chamomile','Aloe Vera'];
  // #98 Alien Essence Absolue — ID 15452
  map['919-TMU W'] = ['Vanilla','Jasmine','Amber','Myrrh','Incense','Cashmir Wood'];
  // #100 Nightflight — ID 1721
  map['1185-JOO MP'] = ['Pineapple','Lavender','Lemon','Bergamot','Green Notes','Tonka Bean'];
})();
