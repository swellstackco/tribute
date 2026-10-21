/** Flesch-Kincaid grade level for a short English string. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function gradeLevel(text: string): number {
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).map((w) => w.replace(/[^A-Za-z'’-]/g, "")).filter(Boolean);
  if (!words.length || !sentences.length) return 0;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const g = 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
  return Math.max(0, +g.toFixed(1));
}
