import { spellIcon } from '../engine/icons';
import { dominantOrb, ORB_INFO, type Spell } from '../engine/spells';
import { Glyph } from './Glyph';

interface Props {
  spell: Spell;
  size?: number;
}

/**
 * A spell's mark: the supplied artwork when there is some, otherwise the
 * built-in glyph tinted by the reagent the spell leans on (gold when it leans
 * on none). One component so every list, slot and chip stays consistent as the
 * icon folder fills up.
 */
export function SpellIcon({ spell, size = 21 }: Props): JSX.Element {
  const src = spellIcon(spell);
  if (src) {
    return <img className="spell-img" src={src} alt="" width={size} height={size} loading="lazy" />;
  }
  const orb = dominantOrb(spell.orbs);
  return (
    <span className="spell-glyph" style={{ color: orb ? ORB_INFO[orb].hex : 'var(--gold)' }}>
      <Glyph name={spell.glyph} size={size} />
    </span>
  );
}
