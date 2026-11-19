export const ROLES = Object.freeze({
  SUPERADMIN: 'SUPERADMIN',
  HYPERADMIN: 'HYPERADMIN',
  ADMIN: 'ADMIN',
  VIEWER: 'VIEWER',
});

export const PERMISSIONS = Object.freeze({
  READ_DATA: 'read_data',
  WRITE_DATA: 'write_data',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  RESET_DATA: 'reset_data',
  MANAGE_USERS: 'manage_users',
  VIEW_AUDIT_LOG: 'view_audit_log',
  CLEAR_AUDIT_LOG: 'clear_audit_log',
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPERADMIN]: new Set(Object.values(PERMISSIONS)),
  [ROLES.ADMIN]: new Set([
    PERMISSIONS.READ_DATA,
    PERMISSIONS.WRITE_DATA,
    PERMISSIONS.EXPORT_DATA,
  ]),
  [ROLES.HYPERADMIN]: new Set([
    PERMISSIONS.READ_DATA,
    PERMISSIONS.WRITE_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.RESET_DATA,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_AUDIT_LOG,
    PERMISSIONS.CLEAR_AUDIT_LOG,
  ]),
  [ROLES.VIEWER]: new Set([PERMISSIONS.READ_DATA]),
});

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

export function isValidPassword(password) {
  return typeof password === 'string'
    && password.length >= 5
    && Buffer.byteLength(password, 'utf8') <= 72;
}