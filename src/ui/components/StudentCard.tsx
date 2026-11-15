import type { ReactNode } from 'react';
import { strings } from '../../domain/strings';
import { Link } from '../router';
import { Icon } from './Icon';
import { useLongPress } from './use-long-press';

type StudentCardProps = {
  /** Where a tap goes: the student's profile. */
  href: string;
  /** The student's initials, in the circle. */
  initials: string;
  name: string;
  /** Under the name: the next lesson. */
  subtitle: string;
  /** The state on the right: a `Badge`. */
  badge?: ReactNode;
  /** The belt, "Aula X de Y" and the other lines of the card. */
  children?: ReactNode;
  /** Opens the context menu: a long press, and the "⋯" button for whoever cannot long-press. */
  onMenu: () => void;
};

/**
 * The student card (design system, CartaoAluno): initials, name, next lesson and a badge, then the
 * package belt. A tap opens the profile, a long press opens the context menu, and the "⋯" button
 * opens the same menu without the gesture.
 */
export function StudentCard({ href, initials, name, subtitle, badge, children, onMenu }: StudentCardProps) {
  const press = useLongPress(onMenu);
  return (
    <div className="student-card">
      <Link className="student-card-body" to={href} {...press}>
        <span className="student-card-top">
          <span className="initials" aria-hidden="true">
            {initials}
          </span>
          <span className="student-card-name">
            <span className="strong">{name}</span>
            <span className="muted small">{subtitle}</span>
          </span>
          {badge}
        </span>
        {children}
      </Link>
      <button type="button" className="student-card-menu" aria-label={strings.packages.overview.menu.open(name)} onClick={onMenu}>
        <Icon name="ellipsis" />
      </button>
    </div>
  );
}
