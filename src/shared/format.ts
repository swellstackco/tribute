export const priceSigns = (n: unknown): string => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 1 && v <= 4 ? "$".repeat(Math.round(v)) : "";
};
export const decadeLabel = (d: number) => `${d}s`;
