import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, isValidPassword, isValidRole, PERMISSIONS, ROLES } from './auth.js';

test('viewer can read but cannot change data or manage users', () => {
  assert.equal(hasPermission(ROLES.VIEWER, PERMISSIONS.READ_DATA), true);
  assert.equal(hasPermission(ROLES.VIEWER, PERMISSIONS.WRITE_DATA), false);
  assert.equal(hasPermission(ROLES.VIEWER, PERMISSIONS.MANAGE_USERS), false);
});

test('admin can manage business data but not accounts or destructive system actions', () => {
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.WRITE_DATA), true);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.EXPORT_DATA), true);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.IMPORT_DATA), false);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.RESET_DATA), false);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.MANAGE_USERS), false);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.CLEAR_AUDIT_LOG), false);
});

test('hyperadmin can manage company accounts and reset only their own company data', () => {
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.READ_DATA), true);
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.WRITE_DATA), true);
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.EXPORT_DATA), true);
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.MANAGE_USERS), true);
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.VIEW_AUDIT_LOG), true);
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.CLEAR_AUDIT_LOG), true);
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.IMPORT_DATA), false);
  assert.equal(hasPermission(ROLES.HYPERADMIN, PERMISSIONS.RESET_DATA), true);
});

test('superadmin can perform every declared permission', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(hasPermission(ROLES.SUPERADMIN, permission), true);
  }
});

test('unknown roles and permissions are denied by default', () => {
  assert.equal(hasPermission('OWNER', PERMISSIONS.READ_DATA), false);
  assert.equal(hasPermission(ROLES.ADMIN, 'unlisted_permission'), false);
  assert.equal(isValidRole(ROLES.SUPERADMIN), true);
  assert.equal(isValidRole(ROLES.HYPERADMIN), true);
  assert.equal(isValidRole('OWNER'), false);
});

test('passwords require at least 5 characters and remain limited to 72 UTF-8 bytes', () => {
  assert.equal(isValidPassword('1234'), false);
  assert.equal(isValidPassword('12345'), true);
  assert.equal(isValidPassword('a'.repeat(73)), false);
  assert.equal(isValidPassword(null), false);
});