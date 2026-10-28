/* Original vector artwork, authored for these fictional design samples. */
(() => {
  const svg = (body, viewBox = '0 0 80 80') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" aria-hidden="true">${body}</svg>`;
  const book = '<path d="M16 27Q28 21 40 29Q52 21 64 27V53Q52 47 40 55Q28 47 16 53Z" fill="currentColor" opacity=".15"/><path d="M16 27Q28 21 40 29Q52 21 64 27V53Q52 47 40 55Q28 47 16 53ZM40 29V55" stroke="currentColor" stroke-width="2.5"/>';
  const shield = `<path d="M40 7L67 17V38Q67 60 40 73Q13 60 13 38V17Z" stroke="currentColor" stroke-width="2.5"/>${book}<path d="M31 17L40 13L49 17" stroke="currentColor" stroke-width="2"/>`;
  const marks = {
    modern: shield,
    preschool: '<path d="M40 65V35M40 52L24 38M40 44L55 28" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M38 37C13 45 12 18 24 15C38 10 42 24 38 37ZM44 30C43 8 67 8 68 20C69 33 53 36 44 30ZM25 43C6 47 5 29 13 26C23 22 29 33 25 43Z" fill="currentColor" opacity=".85"/><path d="M20 66Q40 57 62 66" stroke="currentColor" stroke-width="2"/>',
    statement: `<path d="M40 5L66 17V42Q62 61 40 72Q18 61 14 42V17Z" stroke="currentColor" stroke-width="1.5"/>${book}<path d="M25 61L40 66L55 61" stroke="currentColor"/>`,
    enrichment: `${book}<path d="M40 11V19M22 14L26 21M58 14L54 21M11 18L17 23M69 18L63 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="65" r="3" fill="currentColor"/>`,
    premium: `${shield}<path d="M7 25Q-1 53 24 70M73 25Q81 53 56 70M9 39L4 34M13 51L5 48M19 61L11 60M71 39L76 34M67 51L75 48M61 61L69 60" stroke="currentColor" stroke-width="1.5"/>`,
    bilingual: '<rect x="10" y="10" width="60" height="60" rx="8" stroke="currentColor" stroke-width="3"/><path d="M23 23H57M29 23V57M51 23V57M23 40H57M23 57H39V47H43V57H57" stroke="currentColor" stroke-width="3"/><path d="M17 16L20 18M60 63L64 65" stroke="currentColor" stroke-width="2"/>'
  };
  const blossom = (x, y, scale) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="currentColor" opacity=".28">${[0,72,144,216,288].map(a => `<ellipse cy="-8" rx="5" ry="9" transform="rotate(${a})"/>`).join('')}<circle r="3" fill="#fff"/></g>`;
  function scene(style) {
    if (style === 'preschool') return svg('<path d="M0 90Q80 38 170 82Q270 22 400 80Q520 42 660 87V120H0Z" fill="#dfeacb"/><path d="M0 105Q160 66 320 103Q490 62 660 96V120H0Z" fill="#b7d6ac"/><circle cx="573" cy="24" r="15" fill="#e8c867"/><path d="M31 49Q40 39 49 49M49 49Q58 39 67 49" stroke="#517d60" stroke-width="2"/><path d="M113 104V54L127 41L137 46L128 60V102M115 73H137V101M112 89H107V106M137 90L145 106" stroke="#bc9c55" stroke-width="8" stroke-linejoin="round"/><circle cx="130" cy="46" r="1.5" fill="#294932"/><path d="M456 107V54M456 75L434 60M456 68L474 47" stroke="#6b9564" stroke-width="4"/><ellipse cx="432" cy="53" rx="15" ry="10" fill="#8fb57d"/><ellipse cx="475" cy="40" rx="16" ry="11" fill="#8fb57d"/>', '0 0 660 120');
    if (style === 'premium') return svg('<g stroke="currentColor" stroke-width="1.2" opacity=".18"><path d="M0 100H660M70 100V57H200V100M460 100V57H590V100M200 100V40L330 5L460 40V100M215 40H445M320 100V65H340V100M90 70H180M480 70H570"/>'+[230,260,290,360,390,420].map(x=>`<path d="M${x} 50V90"/>`).join('')+'</g>', '0 0 660 110');
    if (style === 'bilingual') return svg(`<path d="M460 110Q500 49 620 10M520 59L506 13M567 37L590 70" stroke="currentColor" opacity=".25" stroke-width="2"/>${blossom(501,30,1)}${blossom(549,47,.8)}${blossom(601,19,1.2)}${blossom(580,76,.6)}`, '0 0 660 110');
    return '';
  }
  window.SchoolInvoiceArt = { mark: style => svg(marks[style]), scene };
})();
