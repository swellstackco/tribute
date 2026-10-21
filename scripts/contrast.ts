// WCAG contrast for the design tokens. Body text needs 7:1. Run: npx tsx scripts/contrast.ts
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs: Array<[string, string, string]> = [
  ["ink on paper", "#23201c", "#f7f2e8"], ["ink on card", "#23201c", "#fbf8f1"], ["muted on paper", "#554d44", "#f7f2e8"],
  ["muted on card", "#554d44", "#fbf8f1"], ["green on paper", "#2e4a3a", "#f7f2e8"], ["green on card", "#2e4a3a", "#fbf8f1"],
  ["white on green", "#ffffff", "#2e4a3a"], ["alert on paper", "#7a2c2c", "#f7f2e8"], ["ink on needs_input pill", "#23201c", "#efe3c2"],
  ["placeholder on card", "#554d44", "#fbf8f1"],
];
let fail = 0;
for (const [n, a, b] of pairs) { const r = ratio(a, b); const ok = r >= 7; if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${r.toFixed(2)}:1  ${n}`); }
process.exit(fail ? 1 : 0);
