'use client';

import { useEffect, useState, useRef } from 'react';
import {
  getStaffMembers,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  StaffMember,
  AdminRole,
} from '@/lib/api';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ToastNotification {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Current logged in user ID from cookie to protect self
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'RECEPTIONIST' as AdminRole,
    avatarBase64: '' as string,
  });
  const [addAvatarPreview, setAddAvatarPreview] = useState<string | null>(null);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const [addTouched, setAddTouched] = useState({ name: false, username: false, password: false });

  const [editFormData, setEditFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'RECEPTIONIST' as AdminRole,
    isActive: true,
    avatarBase64: '' as string,
  });
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editTouched, setEditTouched] = useState({ name: false, username: false, password: false });

  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isAddNameValid = formData.name.trim().length > 0;
  const isAddUsernameValid = /^[a-zA-Z0-9_-]{3,30}$/.test(formData.username.trim());
  const isAddPasswordValid = formData.password.length >= 8;
  const isAddFormValid = isAddNameValid && isAddUsernameValid && isAddPasswordValid;

  const isEditNameValid = editFormData.name.trim().length > 0;
  const isEditUsernameValid = /^[a-zA-Z0-9_-]{3,30}$/.test(editFormData.username.trim());
  const isEditPasswordValid = !editFormData.password ? true : editFormData.password.length >= 8;
  const isEditFormValid = isEditNameValid && isEditUsernameValid && isEditPasswordValid;

  function showToast(type: 'success' | 'error', message: string) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    // Read current logged in user from cookie
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )gz-admin-user=([^;]+)'));
      if (match) {
        try {
          const user = JSON.parse(decodeURIComponent(match[2]));
          if (user?.id) setCurrentUserId(user.id);
        } catch (e) {
          // ignore
        }
      }
    }
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    setError('');
    try {
      const data = await getStaffMembers();
      setStaff(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff accounts');
      showToast('error', err.message || 'Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  }

  const handleAddFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Image size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        setFormData((prev) => ({ ...prev, avatarBase64: base64 }));
        setAddAvatarPreview(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Image size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        setEditFormData((prev) => ({ ...prev, avatarBase64: base64 }));
        setEditAvatarPreview(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setAddTouched({ name: true, username: true, password: true });

    if (!isAddFormValid) {
      showToast('error', 'Please resolve form errors before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createStaffMember({
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        avatarBase64: formData.avatarBase64 || undefined,
      });

      showToast('success', res.message || 'Staff account created successfully!');
      setIsAddModalOpen(false);
      setFormData({ name: '', username: '', password: '', role: 'RECEPTIONIST', avatarBase64: '' });
      setAddAvatarPreview(null);
      setAddTouched({ name: false, username: false, password: false });
      await loadStaff();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create staff account.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member);
    setEditFormData({
      name: member.name,
      username: member.username,
      password: '',
      role: member.role,
      isActive: member.isActive,
      avatarBase64: '',
    });
    setEditAvatarPreview(member.avatarUrl ? (member.avatarUrl.startsWith('http') ? member.avatarUrl : `${API_BASE}${member.avatarUrl}`) : null);
    setEditTouched({ name: false, username: false, password: false });
    setIsEditModalOpen(true);
  }

  async function handleUpdateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStaff) return;
    setEditTouched({ name: true, username: true, password: true });

    if (!isEditFormValid) {
      showToast('error', 'Please resolve form errors before saving.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: editFormData.name.trim(),
        username: editFormData.username.trim().toLowerCase(),
        role: editFormData.role,
        isActive: editFormData.isActive,
      };

      if (editFormData.password.trim()) {
        payload.password = editFormData.password.trim();
      }

      if (editFormData.avatarBase64) {
        payload.avatarBase64 = editFormData.avatarBase64;
      }

      const res = await updateStaffMember(editingStaff.id, payload);
      showToast('success', res.message || 'Staff account updated successfully!');
      setIsEditModalOpen(false);
      setEditingStaff(null);
      setEditAvatarPreview(null);
      if (editingStaff.id === currentUserId && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh-admin-profile'));
      }
      await loadStaff();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update staff account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(member: StaffMember) {
    if (member.id === currentUserId && member.isActive) {
      showToast('error', 'You cannot deactivate your own account.');
      return;
    }

    const action = member.isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${member.name}'s account?`)) return;

    setActionLoadingId(member.id);
    try {
      const res = await updateStaffMember(member.id, { isActive: !member.isActive });
      showToast('success', res.message || `Account ${action}d successfully`);
      await loadStaff();
    } catch (err: any) {
      showToast('error', err.message || `Failed to ${action} account`);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteStaff(member: StaffMember) {
    if (member.id === currentUserId) {
      showToast('error', 'You cannot delete your own account.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to PERMANENTLY delete ${member.name} (@${member.username})? This action cannot be undone.`
      )
    ) {
      return;
    }

    setActionLoadingId(member.id);
    try {
      const res = await deleteStaffMember(member.id);
      showToast('success', res.message || 'Staff account deleted.');
      await loadStaff();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete staff account');
    } finally {
      setActionLoadingId(null);
    }
  }

  const roleBadges: Record<
    AdminRole,
    { label: string; bg: string; text: string; border: string }
  > = {
    SUPER_ADMIN: {
      label: 'Super Admin',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    MANAGER: {
      label: 'Manager',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    },
    RECEPTIONIST: {
      label: 'Receptionist',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
  };

  const totalStaff = staff.length;
  const activeStaff = staff.filter((s) => s.isActive).length;
  const superAdminCount = staff.filter((s) => s.role === 'SUPER_ADMIN').length;
  const receptionistCount = staff.filter((s) => s.role === 'RECEPTIONIST').length;

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl text-[13px] font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-[#0b1b17] border-emerald-500/40 text-emerald-300'
                : 'bg-panel border-stop/40 text-stop'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon name={toast.type === 'success' ? 'check' : 'alert'} size={16} />
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted hover:text-text p-1 rounded transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] sm:text-[28px] font-extrabold text-text tracking-tight">
              Staff Management
            </h1>
            <span className="hidden sm:inline-flex text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Super Admin Only
            </span>
          </div>
          <p className="text-[13px] text-muted mt-1">
            Manage administrative staff, assign role permissions, and control system access.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({ name: '', username: '', password: '', role: 'RECEPTIONIST', avatarBase64: '' });
            setAddAvatarPreview(null);
            setAddTouched({ name: false, username: false, password: false });
            setIsAddModalOpen(true);
          }}
          className="btn btn-primary inline-flex items-center justify-center gap-2 self-start sm:self-auto px-4 py-2.5 shadow-lg shadow-brass/10"
        >
          <Icon name="plus" size={16} />
          <span>Add New Staff</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="panel p-4 border-line-soft">
          <p className="eyebrow text-[10px] text-muted">Total Accounts</p>
          <p className="display text-[24px] text-text font-bold mt-1">{totalStaff}</p>
        </div>
        <div className="panel p-4 border-line-soft">
          <p className="eyebrow text-[10px] text-emerald-400">Active Staff</p>
          <p className="display text-[24px] text-emerald-400 font-bold mt-1">{activeStaff}</p>
        </div>
        <div className="panel p-4 border-line-soft">
          <p className="eyebrow text-[10px] text-amber-400">Super Admins</p>
          <p className="display text-[24px] text-amber-400 font-bold mt-1">{superAdminCount}</p>
        </div>
        <div className="panel p-4 border-line-soft">
          <p className="eyebrow text-[10px] text-blue-400">Counter Receptionists</p>
          <p className="display text-[24px] text-blue-400 font-bold mt-1">{receptionistCount}</p>
        </div>
      </div>

      {/* Role Matrix Explanation Banner */}
      <div className="panel p-4 bg-subtle/30 border-line-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-brass/10 text-brass mt-0.5">
            <Icon name="shield" size={18} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-text">Role-Based Access Control Active</p>
            <p className="text-[12px] text-muted">
              • <strong className="text-amber-400">Super Admin:</strong> Full access & staff control •{' '}
              <strong className="text-blue-400">Manager:</strong> Pricing, Analytics & Offers •{' '}
              <strong className="text-emerald-400">Receptionist:</strong> Dashboard & Bookings only.
            </p>
          </div>
        </div>
      </div>

      {/* Staff Accounts Table / List */}
      <div className="panel overflow-hidden border-line shadow-sm">
        <div className="px-5 py-4 border-b border-line-soft flex items-center justify-between bg-panel">
          <div>
            <h2 className="text-[15px] font-bold text-text">Active Directory</h2>
            <p className="text-[12px] text-muted mt-0.5">
              Authorized credentials with access to the Zero One admin console.
            </p>
          </div>
          <button
            onClick={loadStaff}
            className="btn btn-secondary py-1.5 px-3 text-[12px] flex items-center gap-1.5"
            title="Refresh List"
          >
            <Icon name="refresh" size={13} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted">
            <div className="w-8 h-8 border-2 border-brass border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px]">Loading staff membersÃ¢â‚¬Â¦</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-stop">
            <Icon name="alert" size={24} className="mx-auto mb-2 text-stop" />
            <p className="text-[14px] font-bold">{error}</p>
            <button
              onClick={loadStaff}
              className="mt-3 btn btn-secondary py-1.5 px-3 text-[12px]"
            >
              Try Again
            </button>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <Icon name="users" size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-[14px] font-semibold text-text">No staff accounts found</p>
            <p className="text-[12px] text-muted mt-1">Create an account to grant access to your team.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line-soft bg-subtle/50 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Username</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {staff.map((member) => {
                  const roleConfig = roleBadges[member.role] || roleBadges.RECEPTIONIST;
                  const isSelf = member.id === currentUserId;
                  const isActionLoading = actionLoadingId === member.id;
                  const avatarSrc = member.avatarUrl
                    ? member.avatarUrl.startsWith('http')
                      ? member.avatarUrl
                      : `${API_BASE}${member.avatarUrl}`
                    : null;

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-raised/40 transition-colors ${
                        !member.isActive ? 'opacity-60 bg-subtle/20' : ''
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={member.name}
                              className="w-10 h-10 rounded-full object-cover border border-brass/40 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-brass/10 border border-brass/30 flex items-center justify-center text-brass font-bold text-[13px] shrink-0">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text">{member.name}</span>
                              {isSelf && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-brass/15 text-brass border border-brass/30">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted block font-mono">
                              ID: {member.id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-5 py-4 font-mono text-[12px] text-text">
                        @{member.username}
                      </td>

                      {/* Role Pill */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleConfig.bg} ${roleConfig.text} ${roleConfig.border}`}
                        >
                          {roleConfig.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {member.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stop">
                            <span className="w-2 h-2 rounded-full bg-stop" />
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-5 py-4 text-[12px] text-muted">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Details */}
                          <button
                            onClick={() => openEditModal(member)}
                            disabled={isActionLoading}
                            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-raised transition-colors"
                            title="Edit Account Details"
                          >
                            <Icon name="edit" size={16} />
                          </button>

                          {/* Quick Toggle Active Status */}
                          <button
                            onClick={() => handleToggleStatus(member)}
                            disabled={isActionLoading || (isSelf && member.isActive)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              member.isActive
                                ? 'text-muted hover:text-stop hover:bg-stop/10'
                                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                            } disabled:opacity-30`}
                            title={
                              isSelf && member.isActive
                                ? 'Cannot deactivate yourself'
                                : member.isActive
                                ? 'Deactivate Account'
                                : 'Activate Account'
                            }
                          >
                            <Icon name={member.isActive ? 'lock' : 'check'} size={16} />
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => handleDeleteStaff(member)}
                            disabled={isActionLoading || isSelf}
                            className="p-1.5 rounded-lg text-muted hover:text-stop hover:bg-stop/10 transition-colors disabled:opacity-30"
                            title={isSelf ? 'Cannot delete yourself' : 'Delete Account'}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Add New Staff */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="panel max-w-md w-full p-6 shadow-2xl border-line-soft animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brass/10 text-brass">
                  <Icon name="users" size={18} />
                </div>
                <h3 className="text-[17px] font-bold text-text">Add New Staff Member</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-text p-1 rounded-lg"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-5 space-y-4">
              {/* Profile Photo Upload */}
              <div>
                <label className="field-label">Profile Photo (Optional)</label>
                <div className="flex items-center gap-4 mt-1.5">
                  <div className="relative group">
                    {addAvatarPreview ? (
                      <img
                        src={addAvatarPreview}
                        alt="Preview"
                        className="w-14 h-14 rounded-full object-cover border-2 border-brass shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-subtle border border-line flex items-center justify-center text-muted">
                        <Icon name="users" size={24} className="opacity-60" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      ref={addFileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      onChange={handleAddFileSelect}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addFileInputRef.current?.click()}
                        className="btn btn-secondary py-1.5 px-3 text-[12px]"
                      >
                        {addAvatarPreview ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      {addAvatarPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddAvatarPreview(null);
                            setFormData((prev) => ({ ...prev, avatarBase64: '' }));
                          }}
                          className="text-[11px] text-stop hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted">JPG, PNG or WebP (Max 5MB)</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Usman Ali"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onBlur={() => setAddTouched((t) => ({ ...t, name: true }))}
                  className={`field transition-colors ${
                    addTouched.name && !isAddNameValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {addTouched.name && !isAddNameValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Full name is required</span>
                  </p>
                )}
              </div>

              <div>
                <label className="field-label">Username (Sign In ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. usman_counter"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  onBlur={() => setAddTouched((t) => ({ ...t, username: true }))}
                  className={`field font-mono transition-colors ${
                    addTouched.username && !isAddUsernameValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {addTouched.username && !isAddUsernameValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Username must be 3-30 letters, numbers, hyphens or underscores</span>
                  </p>
                )}
              </div>

              <div>
                <label className="field-label">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onBlur={() => setAddTouched((t) => ({ ...t, password: true }))}
                  className={`field transition-colors ${
                    addTouched.password && !isAddPasswordValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {addTouched.password && !isAddPasswordValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Password must be at least 8 characters</span>
                  </p>
                )}
              </div>

              <div>
                <Select
                  label="Assign Role"
                  value={formData.role}
                  onChange={(val) => setFormData({ ...formData, role: val as AdminRole })}
                  options={[
                    { value: 'RECEPTIONIST', label: 'Receptionist (Dashboard & Bookings)' },
                    { value: 'MANAGER', label: 'Manager (Pricing, Analytics & Offers)' },
                    { value: 'SUPER_ADMIN', label: 'Super Admin (Full Control & Staff Management)' },
                  ]}
                />
                <p className="text-[11px] text-muted mt-1.5">
                  Permissions are automatically enforced based on the selected role.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary py-2 px-4 text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isAddFormValid}
                  className="btn btn-primary py-2 px-5 text-[13px]"
                >
                  {submitting ? 'CreatingÃ¢â‚¬Â¦' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Staff */}
      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="panel max-w-md w-full p-6 shadow-2xl border-line-soft animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brass/10 text-brass">
                  <Icon name="edit" size={18} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-text">Edit Staff Member</h3>
                  <p className="text-[11px] text-muted">@{editingStaff.username}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted hover:text-text p-1 rounded-lg"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="mt-5 space-y-4">
              {/* Profile Photo Upload */}
              <div>
                <label className="field-label">Profile Photo</label>
                <div className="flex items-center gap-4 mt-1.5">
                  <div className="relative group">
                    {editAvatarPreview ? (
                      <img
                        src={editAvatarPreview}
                        alt="Preview"
                        className="w-14 h-14 rounded-full object-cover border-2 border-brass shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-brass/10 border border-brass/30 flex items-center justify-center text-brass font-bold text-lg">
                        {editFormData.name ? editFormData.name.slice(0, 2).toUpperCase() : 'ST'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      onChange={handleEditFileSelect}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="btn btn-secondary py-1.5 px-3 text-[12px]"
                      >
                        {editAvatarPreview ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      {editAvatarPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditAvatarPreview(null);
                            setEditFormData((prev) => ({ ...prev, avatarBase64: '' }));
                          }}
                          className="text-[11px] text-stop hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted">JPG, PNG or WebP (Max 5MB)</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  onBlur={() => setEditTouched((t) => ({ ...t, name: true }))}
                  className={`field transition-colors ${
                    editTouched.name && !isEditNameValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {editTouched.name && !isEditNameValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Full name is required</span>
                  </p>
                )}
              </div>

              <div>
                <label className="field-label">Username</label>
                <input
                  type="text"
                  required
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  onBlur={() => setEditTouched((t) => ({ ...t, username: true }))}
                  className={`field font-mono transition-colors ${
                    editTouched.username && !isEditUsernameValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {editTouched.username && !isEditUsernameValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Username must be 3-30 letters, numbers, hyphens or underscores</span>
                  </p>
                )}
              </div>

              <div>
                <label className="field-label">
                  Reset Password <span className="text-muted text-[11px] font-normal">(Leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  placeholder="New password (optional)"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  onBlur={() => setEditTouched((t) => ({ ...t, password: true }))}
                  className={`field transition-colors ${
                    editTouched.password && !isEditPasswordValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {editTouched.password && !isEditPasswordValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Password must be at least 8 characters</span>
                  </p>
                )}
              </div>

              <div>
                <Select
                  label="Role"
                  value={editFormData.role}
                  disabled={editingStaff.id === currentUserId}
                  onChange={(val) => setEditFormData({ ...editFormData, role: val as AdminRole })}
                  options={[
                    { value: 'RECEPTIONIST', label: 'Receptionist (Dashboard & Bookings)' },
                    { value: 'MANAGER', label: 'Manager (Pricing, Analytics & Offers)' },
                    { value: 'SUPER_ADMIN', label: 'Super Admin (Full Control & Staff Management)' },
                  ]}
                />
                {editingStaff.id === currentUserId && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    You cannot change your own Super Admin role.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-subtle border border-line-soft">
                <div>
                  <p className="text-[13px] font-semibold text-text">Account Status</p>
                  <p className="text-[11px] text-muted">
                    {editFormData.isActive ? 'Active and allowed to log in' : 'Deactivated / Blocked from login'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editFormData.isActive}
                  disabled={editingStaff.id === currentUserId}
                  onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                  className="w-4 h-4 accent-brass"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary py-2 px-4 text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isEditFormValid}
                  className="btn btn-primary py-2 px-5 text-[13px]"
                >
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
