import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { Link } from '../router';
import { Icon, type IconName } from './Icon';

/**
 * The app's buttons, as capsules (ADR-011). One `primary` per screen, for the action the screen
 * exists for; `secondary` for the rest; `text` for light navigation; `danger` only inside a
 * confirmation box (docs/UI.md).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'secondary-danger';
export type ButtonSize = 'normal' | 'large';

function classes(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  const variantClass = {
    primary: '',
    secondary: 'secondary',
    text: 'text',
    danger: 'danger',
    'secondary-danger': 'secondary danger',
  }[variant];
  return ['button', variantClass, size === 'large' ? 'large' : '', extra].filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = 'primary', size = 'normal', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={classes(variant, size, className)} {...props} />;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize; to?: string };

/**
 * A link that looks like a button: for navigation, never for an action. `to` is a screen of the
 * app (no page reload); `href` is any other address.
 */
export function ButtonLink({ variant = 'primary', size = 'normal', className, to, ...props }: ButtonLinkProps) {
  const own = classes(variant, size, className);
  if (to !== undefined) return <Link className={own} to={to} {...props} />;
  return <a className={own} {...props} />;
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  icon: IconName;
  /** What the button does, for screen readers: the icon has no text. */
  label: string;
  /** `glass` is the floating control layer; `brand` is the one primary action of a toolbar or panel. */
  tone?: 'glass' | 'brand';
};

/** The round icon button: a 44 pt circle of glass (or emerald, for the primary action). */
export function IconButton({ icon, label, tone = 'glass', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={['icon-button', tone === 'brand' ? 'brand' : 'glass', className].filter(Boolean).join(' ')}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
