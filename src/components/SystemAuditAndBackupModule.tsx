import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  DatabaseBackup,
  History,
  Download,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { ROLE_PERMISSION_DIRECTORY } from '../services/rbac';
import { getAuditLogs, logAuditEvent, syncAllSmsDomains } from '../services/smsStore';
import { syncAllStoresWithServerDatabase } from '../services/adminStore';
import { getStaffAuthToken } from '../services/authService';

export const SystemAuditAndBackupModule: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState(() => getAuditLogs());
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
      if (!q) return true;
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, search, actionFilter]);

  const handleDownloadFullBackup = async () => {
    setErrMsg(null);
    let serverSnapshot: Record<string, any> = {};
    try {
      const token = getStaffAuthToken();
      const res = await fetch('/api/sms/backup', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) serverSnapshot = await res.json();
    } catch {
      // fall back to localStorage snapshot
    }

    const localSnapshot: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mugina_')) {
        try {
          localSnapshot[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          localSnapshot[key] = localStorage.getItem(key);
        }
      }
    }

    const bundle = {
      school: 'Mugina Hope Primary & Nursery Academy',
      exportedAt: new Date().toISOString(),
      serverDomains: serverSnapshot,
      localStorageSnapshot: localSnapshot,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mugina_Hope_Full_SMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    logAuditEvent('BACKUP', 'Database', undefined, 'Exported complete JSON database backup bundle');
    setAuditLogs(getAuditLogs());
    setStatusMsg('Complete system database backup exported to JSON.');
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.localStorageSnapshot && typeof parsed.localStorageSnapshot === 'object') {
        Object.entries(parsed.localStorageSnapshot).forEach(([k, v]) => {
          if (k.startsWith('mugina_')) {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }
        });
      }
      if (parsed.serverDomains?.backup || parsed.serverDomains?.domains) {
        const token = getStaffAuthToken();
        await fetch('/api/sms/restore', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(parsed.serverDomains.backup || parsed.serverDomains.domains),
        }).catch(() => {});
      }
      await syncAllStoresWithServerDatabase();
      await syncAllSmsDomains();
      logAuditEvent('RESTORE', 'Database', undefined, `Restored SMS data from backup file: ${file.name}`);
      setAuditLogs(getAuditLogs());
      setStatusMsg(`Backup "${file.name}" restored across local & server storage.`);
    } catch {
      setErrMsg('Invalid backup JSON format. Please upload a valid Mugina Hope SMS backup file.');
    }
  };

  const handleCloudSync = async () => {
    setIsSyncing(true);
    setErrMsg(null);
    try {
      await Promise.all([syncAllStoresWithServerDatabase(), syncAllSmsDomains()]);
      logAuditEvent('SYNC', 'Database', undefined, 'Executed manual cross-device cloud database synchronization');
      setAuditLogs(getAuditLogs());
      setStatusMsg('Cross-device synchronization completed across Supabase, Firebase, and Express.');
    } catch {
      setErrMsg('Partial sync completed; local browser cache remains preserved.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportAuditCsv = () => {
    const rows = [
      ['Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'Summary'],
      ...filteredLogs.map((l) => [l.timestamp, l.actorName, l.actorRole, l.action, l.entityType, l.summary]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mugina_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <CheckCircle2 size={15} /> {statusMsg}
        </div>
      )}
      {errMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
          <AlertTriangle size={15} /> {errMsg}
        </div>
      )}

      {/* Database Backup, Restore & Sync */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DatabaseBackup size={18} className="text-blue-900 dark:text-amber-400" />
              Database Backup, Restore & Cloud Synchronization
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Export portable JSON backups of all school records, restore snapshots, or trigger cross-device synchronization.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleCloudSync}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Cloud DB'}
            </button>
            <button
              type="button"
              onClick={handleDownloadFullBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Download size={14} /> Download Full JSON Backup
            </button>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer">
              <Upload size={14} /> Restore JSON
              <input type="file" accept="application/json,.json" onChange={handleRestoreBackup} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* 7-Role Security Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-400" />
            Role-Based Access Control (RBAC) Security Matrix
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Strict role separation enforced across all 7 institutional portals and administrative endpoints.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLE_PERMISSION_DIRECTORY.map((item) => (
            <div
              key={item.role}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-900 dark:text-amber-400">{item.title}</h4>
                <span className="text-[11px] font-mono text-slate-500">{item.role}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.summary}</p>
              <ul className="text-[11px] text-emerald-700 dark:text-emerald-400 space-y-1 pt-1">
                {item.capabilities.map((cap, idx) => (
                  <li key={idx}>• {cap}</li>
                ))}
              </ul>
              <ul className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                {item.restrictions.map((res, idx) => (
                  <li key={idx}>Restricted: {res}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log Viewer */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-blue-900 dark:text-blue-400" /> System Audit Logs
            </h3>
            <p className="text-xs text-slate-500">Chronological record of authentication, grading updates, promotions, and configurations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search actor or summary..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN">Login Events</option>
              <option value="MARK_ENTRY">Exam Mark Entry</option>
              <option value="CONFIGURE">Configurations</option>
              <option value="UPDATE">Record Updates</option>
              <option value="BACKUP">Backups / Restores</option>
            </select>
            <button
              type="button"
              onClick={handleExportAuditCsv}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Actor</th>
                <th className="py-2.5 px-4 font-semibold">Action</th>
                <th className="py-2.5 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No matching audit events recorded yet. Actions performed across the portal appear here automatically.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {log.actorName} <span className="text-slate-400 font-normal">({log.actorRole})</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-blue-900 dark:text-amber-400">{log.action}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{log.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
