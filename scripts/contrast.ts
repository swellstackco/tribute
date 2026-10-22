// WCAG contrast for the design tokens. Body text needs 7:1. Run: npx tsx scripts/contrast.ts
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs: Array<[string, string, string]> = [
  ["ink on paper", "#1d1a16", "#f3eee4"], ["muted on paper", "#554c42", "#f3eee4"], ["rubric on paper", "#7b2a24", "#f3eee4"],
  ["paper on ink", "#f3eee4", "#1d1a16"], ["paper on rubric", "#f3eee4", "#7b2a24"], ["placeholder on paper", "#554c42", "#f3eee4"],
  ["rule-strong on paper (decorative, 3:1 is enough)", "#8f8371", "#f3eee4"],
];
let fail = 0;
for (const [n, a, b] of pairs) { const r = ratio(a, b); const ok = r >= (/decorative/.test(n) ? 3 : 7); if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${r.toFixed(2)}:1  ${n}`); }
process.exit(fail ? 1 : 0);
