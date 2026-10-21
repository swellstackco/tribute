import type { RunInput } from "./types.js";

export interface Example { slug: string; name: string; age: number; city: string; blurb: string; input: RunInput }

// All three are fictional. No real person's data.
export const EXAMPLES: Record<string, Example> = {
  walt: {
    slug: "walt", name: "Walt Pruitt", age: 74, city: "Bakersfield, CA", blurb: "Loved Merle Haggard, bass fishing and the Dodgers.",
    input: {
      slug: "walt", firstName: "Walt", city: "Bakersfield, CA",
      loves: ["Merle Haggard", "bass fishing", "the Los Angeles Dodgers", "carne asada", "Johnny Cash", "The Outlaw Josey Wales", "black coffee at the diner"],
      constraints: { faith: "either", budget: "middle", guests: "older" },
    },
  },
  dana: {
    slug: "dana", name: "Dana Whitlock", age: 58, city: "Portland, OR", blurb: "Loved David Bowie, pinball and Studio Ghibli.",
    input: {
      slug: "dana", firstName: "Dana", city: "Portland, OR",
      loves: ["David Bowie", "Patti Smith", "Studio Ghibli films", "Thai food", "pinball", "Ursula K. Le Guin", "The X-Files", "rainy-day record shops"],
      constraints: { faith: "secular", budget: "open", guests: "mixed" },
    },
  },
  roz: {
    slug: "roz", name: "Rosalind Mayes", age: 81, city: "Birmingham, AL", blurb: "Loved Mahalia Jackson, her rose garden and Maya Angelou.",
    input: {
      slug: "roz", firstName: "Roz", city: "Birmingham, AL",
      loves: ["Mahalia Jackson", "Aretha Franklin", "her rose garden", "The Andy Griffith Show", "fried catfish and greens", "Maya Angelou", "Dolly Parton"],
      constraints: { faith: "faith", budget: "modest", guests: "older" },
    },
  },
};
