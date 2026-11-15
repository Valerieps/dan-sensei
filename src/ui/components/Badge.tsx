import type { ReactNode } from 'react';
import { strings } from '../../domain/strings';
import { Icon } from './Icon';

export type BadgeTone = 'neutral' | 'brand' | 'danger' | 'health';

/**
 * The badge: the short state of a payment, a lesson or a student's health, as a capsule beside the
 * name or the value. `health` always comes with the shield icon; the color is never the only sign.
 */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      {tone === 'health' && <Icon name="shield" label={strings.healthAlert} />}
      {children}
    </span>
  );
}
