import { strings } from '../../domain/strings';

/** What a screen shows while its data loads, so a slow network never looks like an empty page. */
export function Loading() {
  return (
    <p className="muted" role="status">
      {strings.loading}
    </p>
  );
}
