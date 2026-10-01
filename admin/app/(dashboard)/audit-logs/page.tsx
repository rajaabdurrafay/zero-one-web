'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';
import { getAuditLogs, AuditLog } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function formatTimestamp(isoString: string) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function ActionBadge({ action }: { action: string }) {
  const upper = action.toUpperCase();
  if (upper === 'CREATE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        CREATE
      </span>
    );
  }
  if (upper === 'UPDATE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        UPDATE
      </span>
    );
  }
  if (upper === 'DELETE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        DELETE
      </span>
    );
  }
  if (upper === 'VERIFY') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        VERIFY
      </span>
    );
  }
  if (upper === 'REJECT') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono uppercase bg-orange-500/15 text-orange-400 border border-orange-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
        REJECT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono uppercase bg-neutral-500/15 text-neutral-300 border border-neutral-500/30">
      {action}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'SUPER_ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Icon name="shield" size={10} />
        Super Admin
      </span>
    );
  }
  if (role === 'MANAGER') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
        <Icon name="user" size={10} />
        Manager
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <Icon name="play" size={10} />
      Receptionist
    </span>
  );
}

export default function AuditLogsPage() {
  const { data: logs, error, isLoading, mutate } = useSWR<AuditLog[]>(
    'admin-audit-logs',
    () => getAuditLogs(),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      dedupingInterval: 3000,
    }
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const allLogs = logs || [];

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    allLogs.forEach((l) => {
      if (l.entity) set.add(l.entity);
    });
    return [
      { value: 'ALL', label: 'All Entities' },
      ...Array.from(set).map((e) => ({ value: e, label: e })),
    ];
  }, [allLogs]);

  const actionOptions = [
    { value: 'ALL', label: 'All Actions' },
    { value: 'CREATE', label: 'CREATE' },
    { value: 'UPDATE', label: 'UPDATE' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'VERIFY', label: 'VERIFY' },
    { value: 'REJECT', label: 'REJECT' },
  ];

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      // Action filter
      if (actionFilter !== 'ALL' && log.action.toUpperCase() !== actionFilter) {
        return false;
      }
      // Entity filter
      if (entityFilter !== 'ALL' && log.entity !== entityFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const staffName = log.staff?.name?.toLowerCase() || '';
        const staffUsername = log.staff?.username?.toLowerCase() || '';
        const entity = log.entity?.toLowerCase() || '';
        const entityId = log.entityId?.toLowerCase() || '';
        const action = log.action?.toLowerCase() || '';
        const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : '';

        const matches =
          staffName.includes(q) ||
          staffUsername.includes(q) ||
          entity.includes(q) ||
          entityId.includes(q) ||
          action.includes(q) ||
          detailsStr.includes(q);

        if (!matches) return false;
      }
      return true;
    });
  }, [allLogs, actionFilter, entityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-panel border border-line p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brass/10 border border-brass/30 flex items-center justify-center text-brass">
              <Icon name="shield" size={18} />
            </div>
            <h2 className="text-xl font-bold text-text">Staff Activity Audit Trail</h2>
          </div>
          <p className="text-xs text-muted mt-1">
            Real-time immutable log of staff mutations, booking modifications, and administrative changes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => mutate()}
            className="btn btn-subtle text-xs flex items-center gap-2 py-2 px-3.5"
            title="Refresh Audit Logs"
          >
            <Icon name="refresh" size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-panel border border-line p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Icon name="search" size={15} />
          </div>
          <input
            type="text"
            placeholder="Search by staff, action, entity, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-raised border border-line rounded-xl pl-9 pr-4 py-2.5 text-xs text-text placeholder-muted/60 focus:border-brass focus:ring-2 focus:ring-brass/20 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-text cursor-pointer"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Action Filter */}
        <div>
          <Select
            value={actionFilter}
            onChange={(val) => setActionFilter(val)}
            options={actionOptions}
            size="md"
          />
        </div>

        {/* Entity Filter */}
        <div>
          <Select
            value={entityFilter}
            onChange={(val) => setEntityFilter(val)}
            options={entityOptions}
            size="md"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-panel border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-subtle/50 text-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Entity ID</th>
                <th className="py-3.5 px-4">Details / Context</th>
                <th className="py-3.5 px-4 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {isLoading && allLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="refresh" size={20} className="animate-spin text-brass" />
                      <span>Loading audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-rose-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="alert" size={20} />
                      <span>Failed to load audit logs. Please verify super admin permissions.</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="shield" size={24} className="text-muted/40" />
                      <span>No activity records match the selected filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const avatarSrc = log.staff?.avatarUrl
                    ? log.staff.avatarUrl.startsWith('http')
                      ? log.staff.avatarUrl
                      : `${API_BASE}${log.staff.avatarUrl}`
                    : null;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-raised/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-muted font-mono whitespace-nowrap">
                        {formatTimestamp(log.createdAt)}
                      </td>

                      {/* Staff Member */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={log.staff?.name || 'Staff'}
                              className="w-7 h-7 rounded-full object-cover border border-line shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-brass/15 text-brass border border-brass/30 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {(log.staff?.name || 'S').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-text truncate">
                              {log.staff?.name || 'Unknown Staff'}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-muted font-mono">
                                @{log.staff?.username || 'unknown'}
                              </span>
                              {log.staff?.role && <RoleBadge role={log.staff.role} />}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <ActionBadge action={log.action} />
                      </td>

                      {/* Entity */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-text">
                        <span className="px-2 py-0.5 rounded bg-raised border border-line text-[11px]">
                          {log.entity}
                        </span>
                      </td>

                      {/* Entity ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted whitespace-nowrap max-w-[120px] truncate">
                        {log.entityId ? (
                          <span title={log.entityId}>
                            {log.entityId.length > 12
                              ? `${log.entityId.slice(0, 10)}...`
                              : log.entityId}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>

                      {/* Details Summary */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-muted font-mono text-[11px]">
                        {log.details ? (
                          <span className="text-text/80 truncate block">
                            {JSON.stringify(log.details)}
                          </span>
                        ) : (
                          <span className="text-faint">No details provided</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 rounded-lg text-muted hover:text-brass hover:bg-brass/10 transition-colors"
                          title="View Full Details"
                        >
                          <Icon name="eye" size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer row */}
        <div className="p-3.5 bg-subtle/30 border-t border-line flex items-center justify-between text-xs text-muted">
          <span>Showing {filteredLogs.length} of {allLogs.length} total activity logs</span>
          <span className="font-mono text-[11px]">Auto-updates every 10s</span>
        </div>
      </div>

      {/* Detailed Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-panel border border-line rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-line bg-subtle/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brass/15 text-brass border border-brass/30 flex items-center justify-center">
                  <Icon name="shield" size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">Audit Log Entry</h3>
                  <p className="text-[11px] font-mono text-muted">{selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-muted hover:text-text hover:bg-raised rounded-lg transition-colors cursor-pointer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-raised/50 border border-line rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Timestamp
                  </span>
                  <span className="font-mono text-xs text-text">
                    {formatTimestamp(selectedLog.createdAt)}
                  </span>
                </div>

                <div className="p-3 bg-raised/50 border border-line rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Action Type
                  </span>
                  <ActionBadge action={selectedLog.action} />
                </div>

                <div className="p-3 bg-raised/50 border border-line rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Entity Target
                  </span>
                  <span className="font-bold text-xs text-text">{selectedLog.entity}</span>
                  {selectedLog.entityId && (
                    <div className="mt-1 font-mono text-[10px] text-muted truncate">
                      ID: {selectedLog.entityId}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-raised/50 border border-line rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Staff Actor
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-text">
                      {selectedLog.staff?.name || 'Unknown'}
                    </span>
                    {selectedLog.staff?.role && <RoleBadge role={selectedLog.staff.role} />}
                  </div>
                  <span className="text-[10px] font-mono text-muted block mt-0.5">
                    Username: @{selectedLog.staff?.username || 'unknown'}
                  </span>
                </div>
              </div>

              {/* Payload JSON */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Action Context Payload (JSON)
                </span>
                <div className="bg-[#0b1b17] border border-[#1c4b42]/40 rounded-xl p-4 overflow-x-auto text-[12px] font-mono text-emerald-400">
                  <pre>{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line bg-subtle/30 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-subtle text-xs py-2 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
