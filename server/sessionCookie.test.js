import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpiredSessionCookie, createSessionCookie } from './sessionCookie.js';

test('production session cookies allow cross-origin frontend requests securely', () => {
  const cookie = createSessionCookie('session-token', 3600, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Secure/);
});

test('local session cookies retain strict same-site behavior', () => {
  const cookie = createSessionCookie('session-token', 3600, false);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, /Secure/);
});

test('expired cookies use the same site policy as the active session', () => {
  assert.match(createExpiredSessionCookie(true), /SameSite=None;.*Secure/);
  assert.match(createExpiredSessionCookie(false), /SameSite=Strict/);
});
