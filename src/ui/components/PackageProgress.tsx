import type { PackageSummary } from '../../application/api-contract';
import { formatarData } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { beltFor } from './package-belt';

/**
 * The belt of a package: one capsule per lesson, like the belt of a kimono (a continuous bar above
 * 20 lessons). Red only when `urgent` (docs/spec/telas-de-gestao.md).
 */
export function Belt({ used, total, urgent = false, label }: { used: number; total: number; urgent?: boolean; label: string }) {
  const belt = beltFor(used, total);
  const tone = urgent ? 'belt urgent' : 'belt';
  return (
    <div className={tone} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(Math.max(used, 0), total)}>
      {belt.kind === 'bar' ? (
        <div className="belt-bar">
          <div className="belt-fill" style={{ width: `${belt.percent}%` }} />
        </div>
      ) : (
        Array.from({ length: belt.total }, (_, index) => <span key={index} className={index < belt.filled ? 'belt-segment filled' : 'belt-segment'} />)
      )}
    </div>
  );
}

/** The facts of a package that a card shows: the belt, lessons, validity and payment. */
export function PackageProgress({ pkg, urgent = false }: { pkg: PackageSummary; urgent?: boolean }) {
  const c = strings.packages.card;
  const validity =
    pkg.dueOn === null ? c.awaitingStart : pkg.status === 'vencido' ? c.expiredOn(formatarData(pkg.dueOn)) : c.dueOn(formatarData(pkg.dueOn));
  return (
    <div className="stack tight">
      <Belt used={pkg.used} total={pkg.total} urgent={urgent} label={c.progressLabel(pkg.used, pkg.total)} />
      <div className="row spread">
        <span className="strong">{pkg.used > 0 ? c.lessonOf(pkg.used, pkg.total) : c.noLessonYet(pkg.total)}</span>
        <span className="muted small">{pkg.origin}</span>
      </div>
      <div className="row spread">
        <span className="small">{validity}</span>
        <span className="small strong">{pkg.paymentStatus === 'paid' ? c.paid : c.pending}</span>
      </div>
    </div>
  );
}
