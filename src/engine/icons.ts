import type { Orb, Spell } from './spells';

/**
 * Everything in `src/assets/icons/` is picked up at build time and keyed by
 * filename. Drop a file in, it appears — no code change. Anything missing falls
 * back to the built-in SVG glyphs, so a half-filled folder is a valid state.
 *
 * Recognised names (extension and punctuation ignored, case-insensitive):
 *   quas · wex · exort · invoke
 *   coldsnap · ghostwalk · icewall · emp · tornado
 *   alacrity · sunstrike · forge_spirit · chaos_meteor · deafening_blast
 *
 * Both the short spell id and the full spell name match, so `meteor.jpg` and
 * `chaos-meteor.png` are equally fine.
 */
const modules = import.meta.glob('../assets/icons/*.{png,jpg,jpeg,webp,avif,gif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** "Chaos Meteor" / "chaos-meteor.jpg" / "chaos_meteor" all collapse to one key. */
const normalise = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const BY_KEY = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  const filename = path.split('/').pop() ?? '';
  const stem = filename.replace(/\.[^.]+$/, '');
  BY_KEY.set(normalise(stem), url);
}

/** First name that resolves to a file, or null when none of them do. */
export function iconFor(...names: string[]): string | null {
  for (const name of names) {
    const hit = BY_KEY.get(normalise(name));
    if (hit) return hit;
  }
  return null;
}

export const spellIcon = (spell: Spell): string | null => iconFor(spell.id, spell.name);

export const orbIcon = (orb: Orb): string | null => iconFor(orb);

export const iconCount = BY_KEY.size;
