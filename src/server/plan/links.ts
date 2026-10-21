const enc = encodeURIComponent;
export const appleLink = (name: string) => `https://music.apple.com/us/search?term=${enc(name)}`;
export const spotifyLink = (name: string) => `https://open.spotify.com/search/${enc(name)}`;
export const mapLink = (name: string, address?: string) =>
  `https://www.google.com/maps/search/?api=1&query=${enc(address ? `${name} ${address}` : name)}`;
