import type { HealthAlertView } from '../../application/api-contract';
import { Badge } from './Badge';

/**
 * A student's health alerts as amber badges with the shield (never red: red is for charges). Used
 * in the profile, in Hoje and on the student cards. Renders nothing without alerts.
 */
export function HealthAlerts({ alerts }: { alerts: readonly HealthAlertView[] }) {
  if (alerts.length === 0) return null;
  return (
    <span className="health-alerts">
      {alerts.map((alert) => (
        <Badge key={alert.id} tone="health">
          {alert.note ? `${alert.label}: ${alert.note}` : alert.label}
        </Badge>
      ))}
    </span>
  );
}
