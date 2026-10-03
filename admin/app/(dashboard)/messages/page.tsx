'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ContactMessage,
  getMessages,
  markMessageAsRead,
  deleteMessage,
  GetMessagesParams,
} from '@/lib/api';
import { Icon } from '@/components/Icon';

type DatePreset = 'all' | 'today' | '7days' | '30days';

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Operation States
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Calculate Date Boundaries based on preset
  const dateRange = useMemo(() => {
    if (datePreset === 'all') return { dateFrom: undefined, dateTo: undefined };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (datePreset === 'today') {
      return { dateFrom: todayStr, dateTo: todayStr };
    }

    if (datePreset === '7days') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      return { dateFrom: past7.toISOString().split('T')[0], dateTo: todayStr };
    }

    if (datePreset === '30days') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      return { dateFrom: past30.toISOString().split('T')[0], dateTo: todayStr };
    }

    return { dateFrom: undefined, dateTo: undefined };
  }, [datePreset]);

  // Fetch messages from backend with active query params
  const fetchMessagesList = useCallback(async () => {
    try {
      const params: GetMessagesParams = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        sortOrder,
      };

      const data = await getMessages(params);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load contact messages:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, dateRange, sortOrder]);

  useEffect(() => {
    fetchMessagesList();
    const interval = setInterval(fetchMessagesList, 15000);
    return () => clearInterval(interval);
  }, [fetchMessagesList]);

  // Handle selecting a message & auto-marking as read
  async function handleSelectMessage(msg: ContactMessage) {
    setSelectedMessage(msg);

    if (!msg.isRead) {
      try {
        setMarkingId(msg.id);
        const res = await markMessageAsRead(msg.id, true);
        if (res.success) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
          );
          setSelectedMessage((prev) => (prev && prev.id === msg.id ? { ...prev, isRead: true } : prev));
          // Notify layout to immediately decrement unread badge
          window.dispatchEvent(new CustomEvent('refresh-messages-count'));
        }
      } catch (err) {
        console.error('Failed to mark message as read:', err);
      } finally {
        setMarkingId(null);
      }
    }
  }

  // Handle manually toggling read status
  async function handleToggleRead(msg: ContactMessage, e?: React.MouseEvent) {
    e?.stopPropagation();
    try {
      setMarkingId(msg.id);
      const nextStatus = !msg.isRead;
      const res = await markMessageAsRead(msg.id, nextStatus);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, isRead: nextStatus } : m))
        );
        if (selectedMessage?.id === msg.id) {
          setSelectedMessage((prev) => (prev ? { ...prev, isRead: nextStatus } : null));
        }
        window.dispatchEvent(new CustomEvent('refresh-messages-count'));
      }
    } catch (err) {
      console.error('Failed to toggle read state:', err);
    } finally {
      setMarkingId(null);
    }
  }

  // Handle Deleting a message
  async function handleDeleteMessage(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
      window.dispatchEvent(new CustomEvent('refresh-messages-count'));
    } catch (err) {
      alert('Failed to delete message. Please try again.');
      console.error('Failed to delete message:', err);
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopyText(text: string, type: 'phone' | 'email') {
    navigator.clipboard.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  }

  function resetAllFilters() {
    setStatusFilter('all');
    setDatePreset('all');
    setSearch('');
    setSortOrder('desc');
  }

  const hasActiveFilters =
    statusFilter !== 'all' || datePreset !== 'all' || search.trim() !== '' || sortOrder !== 'desc';

  // Helper to format clean WhatsApp link
  function getWhatsAppUrl(phone: string, name: string) {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '92' + clean.slice(1);
    }
    const greeting = encodeURIComponent(`Hi ${name}, thank you for contacting ZEROONE Cue & Play. Regarding your inquiry: `);
    return `https://wa.me/${clean}?text=${greeting}`;
  }

  // Helper to format Mailto link
  function getMailtoUrl(email: string, subject?: string | null, name?: string) {
    const sub = encodeURIComponent(`RE: ${subject || 'ZEROONE Inquiry'} - Response from Management`);
    const body = encodeURIComponent(`Dear ${name || 'Customer'},\n\nThank you for reaching out to ZEROONE Cue & Play.\n\n`);
    return `mailto:${email}?subject=${sub}&body=${body}`;
  }

  // Helper to format Gmail Web Link (opens directly in browser tab)
  function getGmailWebUrl(email: string, subject?: string | null, name?: string) {
    const sub = encodeURIComponent(`RE: ${subject || 'ZEROONE Inquiry'} - Response from Management`);
    const body = encodeURIComponent(`Dear ${name || 'Customer'},\n\nThank you for reaching out to ZEROONE Cue & Play.\n\n`);
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${sub}&body=${body}`;
  }

  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-panel border border-line p-5 sm:p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brass/10 text-brass">
              <Icon name="message" size={22} />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-text">Customer Messages Inbox</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Review inquiries, booking questions, and customer requests submitted via the website contact form.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchMessagesList()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-raised border border-line text-text hover:bg-subtle text-xs sm:text-sm font-semibold transition-colors"
          >
            <Icon name="refresh" size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Control Bar */}
      <div className="bg-panel border border-line p-4 sm:p-5 rounded-2xl space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Filter groups */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* 1. READ / UNREAD FILTER */}
            <div className="flex items-center bg-raised/80 p-1 rounded-xl border border-line-soft">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'all'
                    ? 'bg-brass text-ink shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('unread')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'unread'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-pulse" />
                Unread
              </button>
              <button
                onClick={() => setStatusFilter('read')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'read'
                    ? 'bg-subtle text-text border border-line font-bold'
                    : 'text-muted hover:text-text'
                }`}
              >
                Read
              </button>
            </div>

            {/* 2. DATE RANGE PRESET PILLS */}
            <div className="flex items-center bg-raised/80 p-1 rounded-xl border border-line-soft overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: '30days', label: 'Last 30 Days' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setDatePreset(preset.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    datePreset === preset.id
                      ? 'bg-brass text-ink shadow-xs'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* 4. SORT ORDER TOGGLE */}
            <button
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-raised/80 hover:bg-subtle border border-line-soft text-xs font-bold text-muted hover:text-text transition-all"
              title={`Sorting ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
            >
              <span>⇅</span>
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>

          {/* Right: Search Box */}
          <div className="relative w-full lg:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-raised/90 border border-line text-xs sm:text-sm text-text placeholder:text-muted focus:outline-none focus:border-brass transition-colors"
            />
            <span className="absolute left-3 top-2.5 text-muted">
              <Icon name="search" size={15} />
            </span>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-muted hover:text-text"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 5. ACTIVE FILTER CHIPS & CLEAR BUTTON */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-line-soft">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">
              Active Filters:
            </span>

            {/* Status chip */}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brass/10 border border-brass/30 text-brass">
                <span>Status: {statusFilter === 'unread' ? 'Unread' : 'Read'}</span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className="hover:text-white transition-colors"
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            )}

            {/* Date chip */}
            {datePreset !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brass/10 border border-brass/30 text-brass">
                <span>
                  Date:{' '}
                  {datePreset === 'today'
                    ? 'Today'
                    : datePreset === '7days'
                    ? 'Last 7 Days'
                    : 'Last 30 Days'}
                </span>
                <button
                  onClick={() => setDatePreset('all')}
                  className="hover:text-white transition-colors"
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            )}

            {/* Search chip */}
            {search.trim() !== '' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brass/10 border border-brass/30 text-brass">
                <span className="truncate max-w-[150px]">Search: &quot;{search.trim()}&quot;</span>
                <button onClick={() => setSearch('')} className="hover:text-white transition-colors">
                  <Icon name="close" size={12} />
                </button>
              </span>
            )}

            {/* Sort order chip if Oldest first */}
            {sortOrder === 'asc' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brass/10 border border-brass/30 text-brass">
                <span>Sort: Oldest First</span>
                <button
                  onClick={() => setSortOrder('desc')}
                  className="hover:text-white transition-colors"
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            )}

            {/* Clear All Button */}
            <button
              onClick={resetAllFilters}
              className="text-xs font-bold text-stop hover:underline ml-auto flex items-center gap-1.5"
            >
              <Icon name="close" size={13} />
              <span>Clear All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Two-Column Inbox View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Messages List (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-panel border border-line rounded-2xl overflow-hidden shadow-sm flex flex-col max-h-[750px]">
          <div className="p-4 border-b border-line-soft bg-subtle/30 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Inbox Feed ({messages.length})
            </span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="divide-y divide-line-soft overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-muted text-sm animate-pulse space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-brass border-t-transparent animate-spin mx-auto" />
                <p>Loading inquiries...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 text-center text-muted space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-raised border border-line flex items-center justify-center mx-auto text-faint">
                  <Icon name="message" size={24} />
                </div>
                <p className="text-sm font-semibold text-text">No messages found</p>
                <p className="text-xs text-muted max-w-xs mx-auto">
                  {hasActiveFilters
                    ? 'No inquiries match the active filter criteria. Try clearing some filters.'
                    : 'Customer inquiries submitted via the website contact form will appear here.'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brass text-ink font-bold text-xs"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              messages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                const formattedDate = new Date(msg.createdAt).toLocaleDateString('en-PK', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`p-4 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? 'bg-brass/10 border-l-brass'
                        : msg.isRead
                        ? 'bg-panel border-l-transparent hover:bg-raised'
                        : 'bg-subtle/40 border-l-rose-500 hover:bg-subtle/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {!msg.isRead && (
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 ring-2 ring-rose-500/20" />
                        )}
                        <h3 className={`text-sm truncate ${msg.isRead ? 'font-medium text-text' : 'font-black text-white'}`}>
                          {msg.name}
                        </h3>
                      </div>
                      <span className="text-[11px] text-muted shrink-0">{formattedDate}</span>
                    </div>

                    <p className={`text-xs truncate mb-1 ${msg.isRead ? 'text-muted' : 'font-bold text-brass'}`}>
                      {msg.subject || 'General Inquiry'}
                    </p>

                    <p className="text-xs text-faint line-clamp-2 leading-relaxed">
                      {msg.message}
                    </p>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line-soft text-[11px] text-muted">
                      {msg.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Icon name="phone" size={12} />
                          {msg.phone}
                        </span>
                      )}
                      {msg.email && (
                        <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                          <Icon name="message" size={12} />
                          <span className="truncate">{msg.email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Message Detail View (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-panel border border-line rounded-2xl shadow-sm p-6 sm:p-8 min-h-[500px] flex flex-col">
          {selectedMessage ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-line-soft">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl sm:text-2xl font-black text-text">{selectedMessage.name}</h2>
                      {!selectedMessage.isRead ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                          Unread
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                          Read
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      Received:{' '}
                      {new Date(selectedMessage.createdAt).toLocaleString('en-PK', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </p>
                  </div>

                  {/* Actions: Toggle Read & Delete */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleToggleRead(selectedMessage, e)}
                      disabled={markingId === selectedMessage.id}
                      className="p-2 rounded-xl bg-raised border border-line text-muted hover:text-text hover:bg-subtle text-xs font-semibold transition-colors"
                      title={selectedMessage.isRead ? 'Mark as Unread' : 'Mark as Read'}
                    >
                      <Icon name={selectedMessage.isRead ? 'message' : 'check'} size={16} />
                    </button>

                    <button
                      onClick={(e) => handleDeleteMessage(selectedMessage.id, e)}
                      disabled={deletingId === selectedMessage.id}
                      className="p-2 rounded-xl bg-stop/10 border border-stop/20 text-stop hover:bg-stop/20 text-xs font-semibold transition-colors disabled:opacity-50"
                      title="Delete message"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>

                {/* Contact Coordinates Cards with Copy Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone Card */}
                  {selectedMessage.phone ? (
                    <div className="p-3.5 rounded-xl bg-raised/60 border border-line-soft flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                          Phone Number
                        </span>
                        <a
                          href={`tel:${selectedMessage.phone}`}
                          className="text-sm font-bold text-text hover:text-brass transition-colors font-mono flex items-center gap-1.5 mt-0.5"
                        >
                          <Icon name="phone" size={14} />
                          <span>{selectedMessage.phone}</span>
                        </a>
                      </div>
                      <button
                        onClick={() => handleCopyText(selectedMessage.phone!, 'phone')}
                        className="p-2 rounded-lg bg-subtle/80 hover:bg-brass/20 text-muted hover:text-brass text-xs font-semibold transition-all shrink-0 flex items-center gap-1"
                        title="Copy phone number"
                      >
                        <Icon name={copiedPhone ? 'check' : 'edit'} size={13} />
                        <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-raised/30 border border-line-soft">
                      <span className="text-[11px] text-muted">No phone number provided</span>
                    </div>
                  )}

                  {/* Email Card */}
                  {selectedMessage.email ? (
                    <div className="p-3.5 rounded-xl bg-raised/60 border border-line-soft flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                          Email Address
                        </span>
                        <a
                          href={`mailto:${selectedMessage.email}`}
                          className="text-sm font-bold text-text hover:text-brass transition-colors truncate block flex items-center gap-1.5 mt-0.5"
                        >
                          <Icon name="message" size={13} />
                          <span className="truncate">{selectedMessage.email}</span>
                        </a>
                      </div>
                      <button
                        onClick={() => handleCopyText(selectedMessage.email!, 'email')}
                        className="p-2 rounded-lg bg-subtle/80 hover:bg-brass/20 text-muted hover:text-brass text-xs font-semibold transition-all shrink-0 flex items-center gap-1"
                        title="Copy email"
                      >
                        <Icon name={copiedEmail ? 'check' : 'edit'} size={13} />
                        <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-raised/30 border border-line-soft">
                      <span className="text-[11px] text-muted">No email address provided</span>
                    </div>
                  )}
                </div>

                {/* Subject Header */}
                <div className="p-4 rounded-xl bg-subtle/40 border border-line-soft">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                    Subject / Topic
                  </span>
                  <p className="text-base font-bold text-brass">
                    {selectedMessage.subject || 'General Inquiry'}
                  </p>
                </div>

                {/* Full Message Body */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                    Message Content
                  </span>
                  <div className="p-5 rounded-2xl bg-ink/70 border border-line text-sm text-text leading-relaxed whitespace-pre-wrap font-sans select-text shadow-inner">
                    {selectedMessage.message}
                  </div>
                </div>
              </div>

              {/* Fast Reply Action Bar */}
              <div className="pt-6 border-t border-line-soft space-y-3 mt-6">
                <span className="text-xs font-bold text-muted uppercase tracking-wider block">
                  Quick Reply Channels
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* WhatsApp Button */}
                  {selectedMessage.phone && (
                    <a
                      href={getWhatsAppUrl(selectedMessage.phone, selectedMessage.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all text-center"
                    >
                      <Icon name="message" size={16} />
                      <span>WhatsApp Chat</span>
                    </a>
                  )}

                  {/* Gmail Web / Email Button */}
                  {selectedMessage.email && (
                    <a
                      href={getGmailWebUrl(selectedMessage.email, selectedMessage.subject, selectedMessage.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-[0.98] transition-all text-center"
                      title="Open in Gmail Web"
                    >
                      <Icon name="message" size={16} />
                      <span>Reply via Gmail</span>
                    </a>
                  )}

                  {/* Direct Phone Call */}
                  {selectedMessage.phone && (
                    <a
                      href={`tel:${selectedMessage.phone}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-raised border border-line text-text hover:bg-subtle hover:text-brass transition-all text-center"
                    >
                      <Icon name="phone" size={16} />
                      <span>Call ({selectedMessage.phone})</span>
                    </a>
                  )}
                </div>

                {/* Additional Client Mailto Option */}
                {selectedMessage.email && (
                  <div className="text-right">
                    <a
                      href={getMailtoUrl(selectedMessage.email, selectedMessage.subject, selectedMessage.name)}
                      className="text-[11px] text-muted hover:text-brass underline"
                    >
                      Or open in Desktop Email Client (Outlook/Thunderbird) &rarr;
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-muted space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-raised border border-line flex items-center justify-center text-faint shadow-inner">
                <Icon name="message" size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text">No Message Selected</h3>
                <p className="text-xs text-muted max-w-sm">
                  Select an inquiry from the inbox feed on the left to read the full message and send a quick response.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
