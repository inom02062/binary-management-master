const cookieName = 'blm_session';

export function createSessionCookie(token, maxAgeSeconds, production) {
  const sameSite = production ? 'None' : 'Strict';
  const secure = production ? '; Secure' : '';
  return `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

export function createExpiredSessionCookie(production) {
  const sameSite = production ? 'None' : 'Strict';
  const secure = production ? '; Secure' : '';
  return `${cookieName}=; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=0${secure}`;
}
