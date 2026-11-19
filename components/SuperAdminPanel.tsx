import { Building2, ChevronDown, KeyRound, RefreshCw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AuditLogEntry, Language, TenantAccount, TenantUser } from '../types';

const text = {
  uz: {
    title: 'Kompaniyalar',
    description: 'Kompaniya loginlari ko‘rinadi. Parollar xavfsizlik uchun xeshlangan: ko‘rib bo‘lmaydi, faqat yangilash mumkin.',
    name: 'Kompaniya nomi',
    username: 'Giper administrator logini',
    password: 'Giper administrator paroli (kamida 5 belgi)',
    addLogin: 'Kompaniyaga login qo‘shish',
    role: 'Kirish darajasi',
    hyperadminRole: 'Giper administrator',
    adminRole: 'Administrator',
    viewerRole: 'Faqat ko‘rish',
    create: 'Kompaniya yaratish',
    company: 'Kompaniya',
    login: 'Login',
    noUsers: 'Loginlar yo‘q',
    delete: 'O‘chirish',
    deleteConfirm: '“{name}” kompaniyasini va uning barcha loginlari hamda ma’lumotlarini butunlay o‘chirmoqchimisiz?',
    status: 'Holati',
    reset: 'Parolni yangilash',
    newPassword: 'Yangi parol',
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    active: 'Faol',
    disabled: 'To‘xtatilgan',
    created: 'Yaratilgan',
    empty: 'Hozircha kompaniya yo‘q.',
    error: 'Amal bajarilmadi',
    audit: 'Amallar jurnali',
    platform: 'Platforma',
    showAudit: 'Jurnalni ko‘rsatish',
    hideAudit: 'Jurnalni yashirish',
    noAudit: 'Jurnal yozuvlari topilmadi',
    clearAudit: 'Jurnalni tozalash',
    clearAuditConfirm: '“{name}” kompaniyasining jurnali tozalanadi. Tozalash amali shu jurnalga qayd qilinadi. Davom etasizmi?',
    clearPlatformAuditConfirm: 'Platforma jurnali tozalanadi. Tozalash amali jurnalga qayd qilinadi. Davom etasizmi?',
  },
  ru: {
    title: 'Компании',
    description: 'Логины компаний видны. Пароли хранятся в виде хешей: их нельзя посмотреть, только сбросить.',
    name: 'Название компании',
    username: 'Логин гиперадминистратора',
    password: 'Пароль гиперадминистратора (не менее 5 символов)',
    addLogin: 'Добавить логин компании',
    role: 'Уровень доступа',
    hyperadminRole: 'Гиперадминистратор',
    adminRole: 'Администратор',
    viewerRole: 'Только просмотр',
    create: 'Создать компанию',
    company: 'Компания',
    login: 'Логин',
    noUsers: 'Нет логинов',
    delete: 'Удалить',
    deleteConfirm: 'Удалить компанию «{name}», все её логины и данные без возможности восстановления?',
    status: 'Статус',
    reset: 'Сбросить пароль',
    newPassword: 'Новый пароль',
    save: 'Сохранить',
    cancel: 'Отмена',
    active: 'Активна',
    disabled: 'Отключена',
    created: 'Создана',
    empty: 'Компаний пока нет.',
    error: 'Не удалось выполнить действие',
    audit: 'Журнал действий',
    platform: 'Платформа',
    showAudit: 'Показать журнал',
    hideAudit: 'Скрыть журнал',
    noAudit: 'Записей в журнале нет',
    clearAudit: 'Очистить журнал',
    clearAuditConfirm: 'Журнал компании «{name}» будет очищен. Действие очистки будет записано в этот журнал. Продолжить?',
    clearPlatformAuditConfirm: 'Журнал платформы будет очищен. Действие очистки будет записано в журнал. Продолжить?',
  },
  en: {
    title: 'Companies',
    description: 'Company usernames are visible. Passwords are hashed for security and can only be reset, not viewed.',
    name: 'Company name',
    username: 'Hyper administrator username',
    password: 'Hyper administrator password (at least 5 characters)',
    addLogin: 'Add company login',
    role: 'Access level',
    hyperadminRole: 'Hyper administrator',
    adminRole: 'Administrator',
    viewerRole: 'Read only',
    create: 'Create company',
    company: 'Company',
    login: 'Username',
    noUsers: 'No logins',
    delete: 'Delete',
    deleteConfirm: 'Permanently delete “{name}”, including all its logins and data?',
    status: 'Status',
    reset: 'Reset password',
    newPassword: 'New password',
    save: 'Save',
    cancel: 'Cancel',
    active: 'Active',
    disabled: 'Disabled',
    created: 'Created',
    empty: 'No companies yet.',
    error: 'Action failed',
    audit: 'Activity log',
    platform: 'Platform',
    showAudit: 'Show log',
    hideAudit: 'Hide log',
    noAudit: 'No activity found',
    clearAudit: 'Clear log',
    clearAuditConfirm: 'The “{name}” company log will be cleared. The clear action itself will be recorded in that log. Continue?',
    clearPlatformAuditConfirm: 'The platform log will be cleared. The clear action itself will be recorded. Continue?',
  },
};

export const SuperAdminPanel: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = text[lang];
  const [tenants, setTenants] = useState<TenantAccount[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<TenantUser['role']>('VIEWER');
  const [resetUser, setResetUser] = useState<{ tenantId: string; user: TenantUser } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [expandedAuditTenant, setExpandedAuditTenant] = useState<string | null>(null);
  const [platformAuditExpanded, setPlatformAuditExpanded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [tenantRows, auditRows] = await Promise.all([api.getControlTenants(), api.getControlAuditLog()]);
    setTenants(tenantRows);
    setAudit(auditRows);
  };

  useEffect(() => {
    void reload().catch(cause => setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`));
  }, [t.error]);

  const createTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createControlTenant({ name, username, password });
      setName('');
      setUsername('');
      setPassword('');
      await reload();
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleTenant = async (tenant: TenantAccount) => {
    setBusy(true);
    setError('');
    try {
      await api.setControlTenantActive(tenant.id, !tenant.isActive);
      await reload();
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const resetUserPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetUser) return;
    setBusy(true);
    setError('');
    try {
      await api.resetControlTenantUserPassword(resetUser.tenantId, resetUser.user.id, resetPassword);
      setResetUser(null);
      setResetPassword('');
      await reload();
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const createTenantUser = async (event: React.FormEvent, tenantId: string) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createControlTenantUser(tenantId, { username: newUsername, password: newPassword, role: newRole });
      setNewUsername('');
      setNewPassword('');
      setNewRole('VIEWER');
      await reload();
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const updateTenantUser = async (tenantId: string, userId: string, payload: { role?: TenantUser['role']; isActive?: boolean }) => {
    setBusy(true);
    setError('');
    try {
      await api.updateControlTenantUser(tenantId, userId, payload);
      await reload();
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteTenant = async (tenant: TenantAccount) => {
    if (!window.confirm(t.deleteConfirm.replace('{name}', tenant.name))) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteControlTenant(tenant.id);
      await reload();
      setExpandedTenant(current => current === tenant.id ? null : current);
      setResetUser(current => current?.tenantId === tenant.id ? null : current);
      setResetPassword('');
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearAuditLog = async (tenant: TenantAccount) => {
    if (!window.confirm(t.clearAuditConfirm.replace('{name}', tenant.name))) return;
    setBusy(true);
    setError('');
    try {
      await api.clearControlTenantAuditLog(tenant.id);
      await reload();
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearPlatformAuditLog = async () => {
    if (!window.confirm(t.clearPlatformAuditConfirm)) return;
    setBusy(true);
    setError('');
    try {
      await api.clearControlAuditLog();
      await reload();
    } catch (cause) {
      setError(`${t.error}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><ShieldCheck className="h-5 w-5 text-emerald-600" />{t.title}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
      </header>

      {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <form onSubmit={createTenant} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 md:col-span-2"><UserPlus size={16} />{t.create}</h3>
        <input required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder={t.name} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        <input required minLength={3} maxLength={50} pattern="[A-Za-z0-9_.-]+" value={username} onChange={event => setUsername(event.target.value)} placeholder={t.username} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        <input required type="password" minLength={5} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} placeholder={t.password} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-700"><Building2 size={16} />{t.create}</button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.title}</h3>
          <button type="button" disabled={busy} title="Refresh" onClick={() => void reload().catch(cause => setError(String(cause)))} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><RefreshCw size={15} /></button>
        </div>
        <div className="space-y-3">
          {tenants.map(tenant => {
            const expanded = expandedTenant === tenant.id;
            const auditExpanded = expandedAuditTenant === tenant.id;
            const tenantAudit = audit.filter(row => row.tenantId === tenant.id);
            return (
              <article key={tenant.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3 p-4">
                  <button type="button" aria-expanded={expanded} onClick={() => {
                    setExpandedTenant(expanded ? null : tenant.id);
                    setExpandedAuditTenant(null);
                    setNewUsername('');
                    setNewPassword('');
                    setNewRole('VIEWER');
                  }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Building2 size={18} className="shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{tenant.name}</span>
                      <span className="text-xs text-slate-500">{new Date(tenant.createdAt).toLocaleDateString()}</span>
                    </span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  <button type="button" disabled={busy} onClick={() => void toggleTenant(tenant)} className={`shrink-0 text-xs font-semibold disabled:opacity-50 ${tenant.isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                    {tenant.isActive ? t.active : t.disabled}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void deleteTenant(tenant)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-600 disabled:opacity-50 dark:text-red-400">
                    <Trash2 size={14} />{t.delete}
                  </button>
                </div>
                {expanded && (
                  <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                    {tenant.users.length === 0 ? <p className="text-sm text-slate-500">{t.noUsers}</p> : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tenant.users.map(user => (
                          <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                            <span className="min-w-32 text-sm text-slate-700 dark:text-slate-200">{user.username}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <select aria-label={`${t.role}: ${user.username}`} value={user.role} disabled={busy} onChange={event => void updateTenantUser(tenant.id, user.id, { role: event.target.value as TenantUser['role'] })} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950">
                                <option value="HYPERADMIN">{t.hyperadminRole}</option>
                                <option value="ADMIN">{t.adminRole}</option>
                                <option value="VIEWER">{t.viewerRole}</option>
                              </select>
                              <button type="button" disabled={busy} onClick={() => void updateTenantUser(tenant.id, user.id, { isActive: !user.isActive })} className={`text-xs font-semibold disabled:opacity-50 ${user.isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                                {user.isActive ? t.active : t.disabled}
                              </button>
                              {resetUser?.tenantId === tenant.id && resetUser.user.id === user.id ? (
                                <form onSubmit={resetUserPassword} className="flex flex-wrap items-center gap-2">
                                  <input required type="password" minLength={5} maxLength={72} autoComplete="new-password" aria-label={`${t.newPassword}: ${user.username}`} value={resetPassword} onChange={event => setResetPassword(event.target.value)} className="w-44 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" />
                                  <button disabled={busy} className="text-xs font-semibold text-emerald-700 disabled:opacity-50 dark:text-emerald-300">{t.save}</button>
                                  <button type="button" disabled={busy} onClick={() => { setResetUser(null); setResetPassword(''); }} className="text-xs text-slate-500">{t.cancel}</button>
                                </form>
                              ) : (
                                <button type="button" disabled={busy} onClick={() => { setResetUser({ tenantId: tenant.id, user }); setResetPassword(''); }} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 disabled:opacity-50 hover:text-blue-700 dark:text-slate-300"><KeyRound size={14} />{t.reset}</button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form onSubmit={event => void createTenantUser(event, tenant.id)} className="mt-4 grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
                      <input required minLength={3} maxLength={50} pattern="[A-Za-z0-9_.-]+" value={newUsername} onChange={event => setNewUsername(event.target.value)} placeholder={t.username} aria-label={t.username} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                      <input required type="password" minLength={5} maxLength={72} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder={t.password} aria-label={t.password} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                      <select value={newRole} onChange={event => setNewRole(event.target.value as TenantUser['role'])} aria-label={t.role} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                        <option value="HYPERADMIN">{t.hyperadminRole}</option>
                        <option value="ADMIN">{t.adminRole}</option>
                        <option value="VIEWER">{t.viewerRole}</option>
                      </select>
                      <button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-700">{t.addLogin}</button>
                    </form>
                    <section className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <button type="button" aria-expanded={auditExpanded} onClick={() => setExpandedAuditTenant(auditExpanded ? null : tenant.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                          <ShieldCheck size={15} />{auditExpanded ? t.hideAudit : t.showAudit}<span className="text-xs text-slate-400">({tenantAudit.length})</span><ChevronDown size={14} className={`transition-transform ${auditExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {auditExpanded && (
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={busy} title={t.clearAudit} onClick={() => void clearAuditLog(tenant)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 size={14} />{t.clearAudit}</button>
                            <button type="button" disabled={busy} title="Refresh" onClick={() => void reload().catch(cause => setError(String(cause)))} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><RefreshCw size={15} /></button>
                          </div>
                        )}
                      </div>
                      {auditExpanded && (
                        <ol className="max-h-72 divide-y divide-slate-100 overflow-y-auto border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                          {tenantAudit.map(row => (
                            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2 text-xs">
                              <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{row.username} · {row.action}</span>
                              <time className="text-slate-400">{new Date(row.createdAt).toLocaleString()}</time>
                              {row.details && <span className="col-span-2 truncate text-slate-500">{row.details}</span>}
                            </li>
                          ))}
                          {tenantAudit.length === 0 && <li className="py-6 text-center text-xs text-slate-500">{t.noAudit}</li>}
                        </ol>
                      )}
                    </section>
                  </div>
                )}
              </article>
            );
          })}
          {tenants.length === 0 && <p className="px-4 py-7 text-center text-sm text-slate-500">{t.empty}</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <button type="button" aria-expanded={platformAuditExpanded} onClick={() => setPlatformAuditExpanded(value => !value)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck size={16} />{t.platform} · {platformAuditExpanded ? t.hideAudit : t.showAudit}<ChevronDown size={14} className={`transition-transform ${platformAuditExpanded ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            {platformAuditExpanded && (
              <>
                <button type="button" disabled={busy} title={t.clearAudit} onClick={() => void clearPlatformAuditLog()} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 size={14} />{t.clearAudit}</button>
                <button type="button" disabled={busy} title="Refresh" onClick={() => void reload().catch(cause => setError(String(cause)))} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><RefreshCw size={15} /></button>
              </>
            )}
          </div>
        </div>
        {platformAuditExpanded && (
          <ol className="max-h-96 divide-y divide-slate-100 overflow-y-auto border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {audit.filter(row => !row.tenantId).map(row => (
              <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2 text-xs">
                <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{row.username} · {row.action}</span>
                <time className="text-slate-400">{new Date(row.createdAt).toLocaleString()}</time>
                {row.details && <span className="col-span-2 truncate text-slate-500">{row.details}</span>}
              </li>
            ))}
            {audit.every(row => row.tenantId) && <li className="py-6 text-center text-sm text-slate-500">{t.noAudit}</li>}
          </ol>
        )}
      </section>
    </div>
  );
};
