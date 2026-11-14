import type { PackageSummary } from '../../application/api-contract';
import { formatarData } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { ProgressBar } from './ProgressBar';

/** The facts of a package that a card shows: progress bar, lessons, validity and payment. */
export function PackageProgress({ pkg, urgent = false }: { pkg: PackageSummary; urgent?: boolean }) {
  const c = strings.packages.card;
  const validity =
    pkg.dueOn === null ? c.awaitingStart : pkg.status === 'vencido' ? c.expiredOn(formatarData(pkg.dueOn)) : c.dueOn(formatarData(pkg.dueOn));
  return (
    <div className="stack tight">
      <ProgressBar used={pkg.used} total={pkg.total} urgent={urgent} label={c.progressLabel(pkg.used, pkg.total)} />
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
