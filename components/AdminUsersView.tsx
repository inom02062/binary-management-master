import { KeyRound, RefreshCw, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AdminUser, AuditLogEntry, Language, User } from '../types';

const copy = {
  uz: { title: 'Kompaniya foydalanuvchilari', create: 'Hisob yaratish', username: 'Login', password: 'Parol (kamida 5 belgi)', role: 'Rol', save: 'Yaratish', users: 'Hisoblar', active: 'Faol', disabled: 'Faolsiz', audit: 'Amallar jurnali', reset: 'Parolni yangilash', passwordNew: 'Yangi parol', error: 'Amal bajarilmadi', noUsers: 'Hisoblar topilmadi', adminRole: 'Administrator', viewerRole: 'Kuzatuvchi', remove: 'Hisobni o‘chirish', removeConfirm: '“{username}” hisobini o‘chirmoqchimisiz?', clearAudit: 'Jurnalni tozalash', clearAuditConfirm: 'Faqat kompaniyangiz jurnalini tozalaysiz. Tozalash amali jurnalga qayd qilinadi. Davom etasizmi?', noAudit: 'Jurnal yozuvlari topilmadi' },
  ru: { title: 'Пользователи компании', create: 'Создать учетную запись', username: 'Логин', password: 'Пароль (не менее 5 символов)', role: 'Роль', save: 'Создать', users: 'Учетные записи', active: 'Активна', disabled: 'Отключена', audit: 'Журнал действий', reset: 'Сбросить пароль', passwordNew: 'Новый пароль', error: 'Не удалось выполнить действие', noUsers: 'Учетные записи не найдены', adminRole: 'Администратор', viewerRole: 'Наблюдатель', remove: 'Удалить учетную запись', removeConfirm: 'Удалить учетную запись «{username}»?', clearAudit: 'Очистить журнал', clearAuditConfirm: 'Будет очищен журнал только вашей компании. Действие очистки будет записано в журнал. Продолжить?', noAudit: 'Записей в журнале нет' },
  en: { title: 'Company users', create: 'Create account', username: 'Username', password: 'Password (at least 5 characters)', role: 'Role', save: 'Create', users: 'Accounts', active: 'Active', disabled: 'Disabled', audit: 'Activity log', reset: 'Reset password', passwordNew: 'New password', error: 'Action failed', noUsers: 'No accounts found', adminRole: 'Administrator', viewerRole: 'Observer', remove: 'Delete account', removeConfirm: 'Delete the account “{username}”?', clearAudit: 'Clear log', clearAuditConfirm: 'Only your company log will be cleared. The clear action itself will be recorded. Continue?', noAudit: 'No activity found' },
};

const roles = ['ADMIN', 'VIEWER'] as const;

export const AdminUsersView: React.FC<{ currentUser: User; lang: Language }> = ({ currentUser, lang }) => {
  const t = copy[lang];
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<typeof roles[number]>('VIEWER');
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [userRows, auditRows] = await Promise.all([api.getAdminUsers(), api.getAuditLog()]);
    setUsers(userRows);
    setAudit(auditRows);
  };

  useEffect(() => {
    void reload().catch(() => setError(t.error));
  }, [t.error]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
      return true;
    } catch (e) {
      setError(`${t.error}: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await run(() => api.createAdminUser({ username, password, role }))) {
      setUsername('');
      setPassword('');
      setRole('VIEWER');
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(t.removeConfirm.replace('{username}', user.username))) return;
    await run(() => api.deleteAdminUser(user.id));
  };

  const clearAuditLog = async () => {
    if (!window.confirm(t.clearAuditConfirm)) return;
    await run(() => api.clearAuditLog());
  };

  const roleLabel = (userRole: User['role']) => userRole === 'ADMIN' ? t.adminRole : t.viewerRole;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-center gap-3 border-b border-slate-200 pb-5 dark:border-slate-800">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.title}</h2>
      </header>

      {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><Users size={16} />{t.users}</h3>
        <div className="overflow-x-auto border-y border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-3 pr-4">{t.username}</th><th className="py-3 pr-4">{t.role}</th><th className="py-3 pr-4">{t.active}</th><th className="py-3 pr-4">{t.reset}</th><th className="py-3 pr-4">{t.remove}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">{user.username}{user.id === currentUser.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                  <td className="py-3 pr-4">
                    <select aria-label={`${t.role}: ${user.username}`} value={user.role} disabled={busy || user.id === currentUser.id} onChange={e => void run(() => api.updateAdminUser(user.id, { role: e.target.value as typeof roles[number] }))} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
                      {roles.map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <button type="button" disabled={busy || user.id === currentUser.id} onClick={() => void run(() => api.updateAdminUser(user.id, { isActive: !user.isActive }))} className="text-xs font-semibold text-blue-700 disabled:text-slate-400 dark:text-blue-300">
                      {user.isActive ? t.active : t.disabled}
                    </button>
                  </td>
                  <td className="py-3 pr-4">
                    {resetUser?.id === user.id ? (
                      <form className="flex gap-2" onSubmit={async event => { event.preventDefault(); if (await run(() => api.resetAdminPassword(user.id, resetPassword))) { setResetUser(null); setResetPassword(''); } }}>
                        <input aria-label={t.passwordNew} type="password" minLength={5} maxLength={72} required value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" />
                        <button disabled={busy} className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t.save}</button>
                      </form>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => { setResetUser(user); setResetPassword(''); }} title={t.reset} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-700 dark:text-slate-300"><KeyRound size={14} />{t.reset}</button>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <button type="button" disabled={busy || user.id === currentUser.id} onClick={() => void deleteUser(user)} title={t.remove} aria-label={`${t.remove}: ${user.username}`} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 disabled:text-slate-400 dark:text-red-400">
                      <Trash2 size={14} />{t.remove}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">{t.noUsers}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.5fr)]">
        <form onSubmit={createUser} className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><UserPlus size={16} />{t.create}</h3>
          <input required minLength={3} maxLength={50} pattern="[A-Za-z0-9_.-]+" value={username} onChange={e => setUsername(e.target.value)} placeholder={t.username} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input required type="password" minLength={5} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <div className="flex gap-2">
            <select value={role} onChange={e => setRole(e.target.value as typeof roles[number])} aria-label={t.role} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              {roles.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-700"><UserPlus size={15} />{t.save}</button>
          </div>
        </form>

        <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><ShieldCheck size={16} />{t.audit}</h3>
            <div className="flex items-center gap-2">
              <button type="button" disabled={busy} title={t.clearAudit} onClick={() => void clearAuditLog()} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 size={14} />{t.clearAudit}</button>
              <button type="button" disabled={busy} title="Refresh" onClick={() => void run(reload)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><RefreshCw size={15} /></button>
            </div>
          </div>
          <ol className="max-h-72 divide-y divide-slate-100 overflow-y-auto border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {audit.map(row => <li key={row.id} className="grid grid-cols-[1fr_auto] gap-2 py-2 text-xs">
              <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{row.username} · {row.action}</span>
              <time className="text-slate-400">{new Date(row.createdAt).toLocaleString()}</time>
              {row.details && <span className="col-span-2 truncate text-slate-500">{row.details}</span>}
            </li>)}
            {audit.length === 0 && <li className="py-6 text-center text-xs text-slate-500">{t.noAudit}</li>}
          </ol>
        </section>
      </section>
    </div>
  );
};