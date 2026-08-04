import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function generateAdmissionNumber(prefix: string = 'STU'): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `${prefix}-${year}-${random}`;
}

export function generateEmployeeId(prefix: string = 'EMP'): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}-${random}`;
}

export function paginate(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;
  return { limit, offset };
}

export function buildSearchQuery(fields: string[], search: string): { clause: string; params: string[] } {
  if (!search) return { clause: '', params: [] };
  const conditions = fields.map(f => `${f} LIKE ?`).join(' OR ');
  const params = fields.map(() => `%${search}%`);
  return { clause: `AND (${conditions})`, params };
}
