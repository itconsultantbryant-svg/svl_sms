import { LicenseContextType } from '../contexts/LicenseContext';

export function canExport(license: LicenseContextType): boolean {
  return license.mode === 'production';
}

export function canViewReports(license: LicenseContextType): boolean {
  return license.mode === 'production';
}

export function getMaxStudents(license: LicenseContextType): number {
  if (license.mode === 'demo') {
    return 50;
  }
  return Infinity;
}

export function isLicenseExpired(license: LicenseContextType): boolean {
  return license.isExpired;
}

export function getDaysRemaining(license: LicenseContextType): number | null {
  return license.daysRemaining;
}

export function getExportDisabledTooltip(): string {
  return 'Export functionality is available in Production mode only';
}

export function getReportsDisabledTooltip(): string {
  return 'Reports are available in Production mode only';
}

export function getStudentLimitWarning(currentCount: number, license: LicenseContextType): string | null {
  const maxStudents = getMaxStudents(license);
  if (maxStudents === Infinity) return null;

  const remaining = maxStudents - currentCount;
  if (remaining <= 0) {
    return `You have reached the maximum of ${maxStudents} students in Demo mode. Upgrade to Production to add more.`;
  }
  if (remaining <= 10) {
    return `You have ${remaining} student slots remaining. Upgrade to Production for unlimited students.`;
  }
  return null;
}
