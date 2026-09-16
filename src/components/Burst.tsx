import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

/**
 * The reward. A landed spell gets a quick wash of its own colour; finishing a
 * chain gets a banner as well, because that is the thing worth wanting.
 */
export function Burst(): JSX.Element {
  const celebration = useStore((s) => s.celebration);
  const layerRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !celebration) return;
    layer.style.setProperty('--burst', celebration.hex);
    layer.classList.remove('flash');
    void layer.offsetWidth;
    layer.classList.add('flash');

    if (celebration.kind !== 'combo') return;
    setBanner(celebration.text);
    const timer = window.setTimeout(() => setBanner(null), 1100);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  return (
    <div className="burst" ref={layerRef} aria-hidden="true">
      {banner && (
        <p className="burst-banner">
          <span>Chain complete</span>
          <b>{banner}</b>
        </p>
      )}
    </div>
  );
}
