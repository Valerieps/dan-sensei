import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** The iOS "inset grouped" list: rows on a rounded surface, separated by hairlines (docs/UI.md). */
export function GroupedList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="grouped-list" aria-label={label}>
      {children}
    </ul>
  );
}

type ListRowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** The value on the right, in muted text: "Bipes". */
  value?: ReactNode;
  icon?: IconName;
  /** Whether the row opens another screen. A row with `href` or `onClick` shows it by default. */
  chevron?: boolean;
  /** A row that navigates. */
  href?: string;
  /** A row that acts. */
  onClick?: () => void;
  /** An action row: the title in the accent color ("Registrar pagamento"). */
  action?: boolean;
  /** Anything else on the right of the value, such as a badge or a switch. */
  trailing?: ReactNode;
};

/** One row of a `GroupedList`, at least 44 pt tall. */
export function ListRow({ title, subtitle, value, icon, chevron, href, onClick, action = false, trailing }: ListRowProps) {
  const interactive = href !== undefined || onClick !== undefined;
  const content = (
    <>
      {icon && <Icon name={icon} />}
      <span className="list-row-text">
        <span className={action ? 'list-row-title action' : 'list-row-title'}>{title}</span>
        {subtitle && <span className="list-row-subtitle">{subtitle}</span>}
      </span>
      {value !== undefined && <span className="list-row-value">{value}</span>}
      {trailing}
      {(chevron ?? (interactive && !action)) && <Icon name="chevron-right" />}
    </>
  );
  return (
    <li className="list-row">
      {href !== undefined ? (
        <a className="list-row-body" href={href}>
          {content}
        </a>
      ) : onClick !== undefined ? (
        <button type="button" className="list-row-body" onClick={onClick}>
          {content}
        </button>
      ) : (
        <div className="list-row-body">{content}</div>
      )}
    </li>
  );
}

/** A `GroupedList` with its small header above (caption, in capitals) and its explanation below. */
export function ListSection({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const headerId = useId();
  return (
    <section className="list-section" aria-labelledby={header ? headerId : undefined}>
      {header && (
        <p id={headerId} className="list-section-header">
          {header}
        </p>
      )}
      <GroupedList>{children}</GroupedList>
      {footer && <p className="list-section-footer">{footer}</p>}
    </section>
  );
}
