// WCAG contrast for the design tokens. Body text needs 7:1, everything else 4.5:1, hairlines 3:1. Run: npx tsx scripts/contrast.ts
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs: Array<[string, string, string]> = [
  ["text on page", "#ede6d8", "#111a2b"], ["muted on page", "#bdb5a6", "#111a2b"], ["alert on page", "#e0b4a0", "#111a2b"],
  ["gold on page (labels, links, numerals; 4.5:1 is the bar)", "#c9a55a", "#111a2b"], ["page on gold (buttons; 4.5:1 is the bar)", "#111a2b", "#c9a55a"],
  ["page on text (hover; 4.5:1 is the bar)", "#111a2b", "#ede6d8"], ["placeholder on page", "#bdb5a6", "#111a2b"],
  ["hairline on page (decorative; 3:1 is the bar)", "#606a7d", "#111a2b"],
];
let fail = 0;
for (const [n, a, b] of pairs) { const r = ratio(a, b); const ok = r >= (/decorative/.test(n) ? 3 : /4\.5:1/.test(n) ? 4.5 : 7); if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${r.toFixed(2)}:1  ${n}`); }
process.exit(fail ? 1 : 0);
