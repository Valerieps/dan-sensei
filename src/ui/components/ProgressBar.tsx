/** Progress of a package: lessons used out of the total. Red only when `urgent` (docs/spec/telas-de-gestao.md). */
export function ProgressBar({ used, total, urgent = false, label }: { used: number; total: number; urgent?: boolean; label: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(used, total)}>
      <div className={urgent ? 'progress-fill urgent' : 'progress-fill'} style={{ width: `${percent}%` }} />
    </div>
  );
}
