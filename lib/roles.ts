export type AppRole = 'GM' | 'BDM' | 'Sales Manager' | 'Admin' | 'Sub-Admin' | 'Supervisor' | 'Fleet' | 'Maintenance';
export type DashboardScope = 'full' | 'supervisor' | 'fleet';
export type ReportType = 'npd' | 'psku' | 'cold-chain' | 'classification';

export const FULL_ACCESS_ROLES: AppRole[] = ['GM', 'BDM', 'Sales Manager', 'Admin', 'Sub-Admin'];
export const SUPERVISOR_ROLES: AppRole[] = ['Supervisor'];
export const FLEET_ROLES: AppRole[] = ['Fleet', 'Maintenance'];

export function normalizeRole(role?: string | null): AppRole | undefined {
  if (!role) return undefined;
  if (FULL_ACCESS_ROLES.includes(role as AppRole)) return role as AppRole;
  if (SUPERVISOR_ROLES.includes(role as AppRole)) return role as AppRole;
  if (FLEET_ROLES.includes(role as AppRole)) return role as AppRole;
  return undefined;
}

export function isFullAccessRole(role?: string | null) {
  return FULL_ACCESS_ROLES.includes((normalizeRole(role) || 'Supervisor') as AppRole);
}

export function isSupervisorRole(role?: string | null) {
  return (normalizeRole(role) || 'Supervisor') === 'Supervisor';
}

export function isFleetRole(role?: string | null) {
  return FLEET_ROLES.includes((normalizeRole(role) || 'Supervisor') as AppRole);
}

/**
 * Returns true if the user role is authorized to perform write / add / edit / import operations.
 * Sub-Admin, Supervisor, Fleet, and Maintenance users are restricted to Read-Only access.
 */
export function canModifyMasterData(role?: string | null): boolean {
  const norm = normalizeRole(role);
  if (!norm) return false;
  return norm === 'Admin' || norm === 'GM' || norm === 'BDM' || norm === 'Sales Manager';
}

export function getDashboardScope(role?: string | null): DashboardScope {
  if (isFleetRole(role)) return 'fleet';
  if (isSupervisorRole(role)) return 'supervisor';
  return 'full';
}

export function getAllowedReports(role?: string | null): ReportType[] {
  if (isFleetRole(role)) return ['cold-chain'];
  return ['npd', 'psku', 'cold-chain', 'classification'];
}

export function isReportAllowed(role?: string | null, reportType?: string) {
  return getAllowedReports(role).includes((reportType || 'cold-chain') as ReportType);
}

export function canAccessAdminRoute(role?: string | null) {
  return isFullAccessRole(role);
}

export function canAccessSupervisorRoute(role?: string | null) {
  return isFullAccessRole(role) || isSupervisorRole(role) || isFleetRole(role);
}
