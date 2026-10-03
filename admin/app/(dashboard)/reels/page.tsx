'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Icon } from '@/components/Icon';
import { getAdminReels, addAdminReel, updateAdminReel, deleteAdminReel, type SocialReel } from '@/lib/api';

const PLATFORM_OPTIONS = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'OTHER', label: 'Other' },
];

export default function AdminReelsPage() {
  const [reels, setReels] = useState<SocialReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Form State (Add)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newPlatform, setNewPlatform] = useState('INSTAGRAM');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [newOrder, setNewOrder] = useState('0');
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Edit Modal State
  const [editingReel, setEditingReel] = useState<SocialReel | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editPlatform, setEditPlatform] = useState('INSTAGRAM');
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editOrder, setEditOrder] = useState('0');
  const [editPreviewBase64, setEditPreviewBase64] = useState<string | null>(null);
  const [editSelectedFileName, setEditSelectedFileName] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const fetchReels = async () => {
    try {
      setLoading(true);
      const data = await getAdminReels();
      setReels(data);
    } catch (err) {
      toast.error('Failed to load reels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (editDropdownRef.current && !editDropdownRef.current.contains(event.target as Node)) {
        setIsEditDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreviewBase64(null);
      setSelectedFileName(null);
      return;
    }

    setSelectedFileName(file.name);

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file for the thumbnail');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setEditPreviewBase64(null);
      setEditSelectedFileName(null);
      return;
    }

    setEditSelectedFileName(file.name);

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file for the thumbnail');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setEditPreviewBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) {
      toast.error('Please enter the reel URL');
      return;
    }

    try {
      setIsUploading(true);
      await addAdminReel({
        platform: newPlatform,
        url: newUrl.trim(),
        thumbnailBase64: previewBase64 || undefined,
        caption: newCaption.trim() || undefined,
        displayOrder: parseInt(newOrder, 10) || 0,
        isActive: true,
      });

      toast.success('Reel added successfully');
      setPreviewBase64(null);
      setSelectedFileName(null);
      setNewUrl('');
      setNewCaption('');
      setNewOrder('0');
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchReels();
    } catch (error) {
      toast.error('Failed to add reel');
    } finally {
      setIsUploading(false);
    }
  };

  const openEditModal = (reel: SocialReel) => {
    setEditingReel(reel);
    setEditUrl(reel.url);
    setEditPlatform(reel.platform || 'INSTAGRAM');
    setEditCaption(reel.caption || '');
    setEditOrder(reel.displayOrder?.toString() || '0');
    setEditPreviewBase64(null);
    setEditSelectedFileName(null);
    setIsEditDropdownOpen(false);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReel || !editUrl.trim()) return;

    try {
      setIsUploading(true);
      await updateAdminReel(editingReel.id, {
        platform: editPlatform,
        url: editUrl.trim(),
        caption: editCaption.trim() || undefined,
        displayOrder: parseInt(editOrder, 10) || 0,
        thumbnailBase64: editPreviewBase64 || undefined,
      });

      toast.success('Reel updated successfully');
      setEditingReel(null);
      fetchReels();
    } catch (error) {
      toast.error('Failed to update reel');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleActive = async (reel: SocialReel) => {
    try {
      setReels(reels.map(r => r.id === reel.id ? { ...r, isActive: !reel.isActive } : r));
      await updateAdminReel(reel.id, { isActive: !reel.isActive });
      toast.success('Visibility updated');
    } catch (error) {
      toast.error('Failed to update visibility');
      fetchReels();
    }
  };

  const updateOrder = async (reel: SocialReel, newDisplayOrder: number) => {
    if (isNaN(newDisplayOrder)) return;
    try {
      setReels(reels.map(r => r.id === reel.id ? { ...r, displayOrder: newDisplayOrder } : r));
      await updateAdminReel(reel.id, { displayOrder: newDisplayOrder });
      toast.success('Order updated');
    } catch (error) {
      toast.error('Failed to update order');
      fetchReels();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reel entry?')) return;

    try {
      await deleteAdminReel(id);
      toast.success('Reel deleted');
      setReels(reels.filter(r => r.id !== id));
    } catch (error) {
      toast.error('Failed to delete reel');
    }
  };

  const getFullThumbnailUrl = (url: string) => {
    if (!url) return '/images/social-placeholder.jpg';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads/')) return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`;
    return url;
  };

  const selectedPlatformObj = PLATFORM_OPTIONS.find(p => p.value === newPlatform) || PLATFORM_OPTIONS[0];
  const selectedEditPlatformObj = PLATFORM_OPTIONS.find(p => p.value === editPlatform) || PLATFORM_OPTIONS[0];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8 pb-32">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-text">Social Reels</h1>
        <p className="text-muted text-sm">Add links to your social media reels to showcase on the website.</p>
      </div>

      {/* Add New Reel Form */}
      <div className="panel rounded-2xl border border-line p-5 sm:p-8 bg-surface shadow-xs">
        <h2 className="text-lg font-bold text-text mb-5">Add New Reel</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Custom Styled Platform Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                Platform
              </label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full h-11 px-4 rounded-xl border border-line bg-surface-raised text-sm text-text font-medium flex items-center justify-between hover:bg-surface-raisedHover transition-colors focus:border-primary outline-none"
              >
                <span>{selectedPlatformObj.label}</span>
                <Icon
                  name="chevronDown"
                  size={16}
                  className={`text-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 bg-surface border border-line rounded-xl shadow-xl z-50 space-y-1 backdrop-blur-md">
                  {PLATFORM_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setNewPlatform(option.value);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between transition-colors ${
                        newPlatform === option.value
                          ? 'bg-primary text-white font-bold'
                          : 'text-text hover:bg-surface-raised'
                      }`}
                    >
                      <span>{option.label}</span>
                      {newPlatform === option.value && <Icon name="check" size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                Reel URL
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text placeholder:text-muted/50 focus:border-primary outline-none"
                placeholder="https://www.instagram.com/reel/..."
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                Thumbnail (Optional - Auto fetched if empty)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-11 px-4 rounded-xl border border-line bg-surface-raised text-sm text-text hover:bg-surface-raisedHover transition-colors flex items-center justify-between"
              >
                <span className="text-text text-xs font-semibold truncate pr-2">
                  {selectedFileName || 'Click to select thumbnail image'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                  <Icon name="upload" size={14} />
                  <span>Choose</span>
                </div>
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {previewBase64 && (
              <div className="relative w-36 h-24 rounded-xl overflow-hidden border border-line shadow-xs">
                <Image src={previewBase64} alt="Preview" fill className="object-cover" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Caption (Optional)
                </label>
                <input
                  type="text"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text placeholder:text-muted/50 focus:border-primary outline-none"
                  placeholder="e.g., The Starring"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Order
                </label>
                <input
                  type="number"
                  value={newOrder}
                  onChange={(e) => setNewOrder(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text placeholder:text-muted/50 focus:border-primary outline-none"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isUploading ? 'Saving...' : 'Add Reel'}
            </button>
          </div>
        </form>
      </div>

      {/* Reels List Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-text">Active Reels ({reels.length})</h2>
        {reels.length === 0 ? (
          <div className="text-center py-12 bg-raised/30 border border-line border-dashed rounded-2xl text-muted text-sm">
            No reels added yet. Fill the form above to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {reels.sort((a, b) => a.displayOrder - b.displayOrder).map(reel => (
              <div
                key={reel.id}
                className="group bg-surface border border-line rounded-2xl p-4 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-w-0 overflow-hidden"
              >
                <div className="space-y-3 min-w-0">
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-raised">
                    {reel.thumbnailUrl && !failedImages[reel.id] ? (
                      <img
                        src={getFullThumbnailUrl(reel.thumbnailUrl)}
                        alt={reel.platform}
                        onError={() => setFailedImages(prev => ({ ...prev, [reel.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-surface to-primary/20 flex flex-col items-center justify-center p-4 text-center">
                        <Icon name="video" size={28} className="text-primary/70 mb-2" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                          {reel.platform}
                        </span>
                      </div>
                    )}
                    {!reel.isActive && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider">
                        Hidden
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(reel)}
                        className="p-2 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-primary transition-colors cursor-pointer"
                        title="Edit Reel"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(reel.id)}
                        className="p-2 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-red-500 transition-colors cursor-pointer"
                        title="Delete Reel"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10 uppercase tracking-wider">
                      {reel.platform}
                    </div>
                  </div>

                  {/* Caption & Cleanly Truncated URL */}
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-xs font-bold text-text truncate" title={reel.caption || reel.platform}>
                      {reel.caption || <span className="text-muted italic">{reel.platform} Reel</span>}
                    </p>
                    <a
                      href={reel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[11px] text-primary truncate hover:underline mt-1 font-mono max-w-full"
                      title={reel.url}
                    >
                      {reel.url}
                    </a>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-line/60 pt-3 mt-2 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-muted">Order</label>
                    <input
                      type="number"
                      value={reel.displayOrder}
                      onChange={(e) => updateOrder(reel, parseInt(e.target.value, 10))}
                      className="w-12 h-7 rounded-lg border border-line bg-raised text-xs text-center text-text font-bold"
                    />
                  </div>
                  <button
                    onClick={() => toggleActive(reel)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg border uppercase transition-colors cursor-pointer ${
                      reel.isActive
                        ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                    }`}
                  >
                    {reel.isActive ? 'Active' : 'Hidden'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Reel Modal */}
      {editingReel && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text">Edit Reel</h2>
              <button
                onClick={() => setEditingReel(null)}
                className="w-8 h-8 rounded-xl bg-raised flex items-center justify-center text-muted hover:text-text transition-colors cursor-pointer"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="space-y-4">
              {/* Custom Styled Platform Dropdown for Edit Modal */}
              <div className="relative" ref={editDropdownRef}>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Platform
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditDropdownOpen(!isEditDropdownOpen)}
                  className="w-full h-11 px-4 rounded-xl border border-line bg-surface-raised text-sm text-text font-medium flex items-center justify-between hover:bg-surface-raisedHover transition-colors focus:border-primary outline-none cursor-pointer"
                >
                  <span>{selectedEditPlatformObj.label}</span>
                  <Icon
                    name="chevronDown"
                    size={16}
                    className={`text-muted transition-transform duration-200 ${isEditDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isEditDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 bg-surface border border-line rounded-xl shadow-xl z-50 space-y-1 backdrop-blur-md">
                    {PLATFORM_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setEditPlatform(option.value);
                          setIsEditDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between transition-colors cursor-pointer ${
                          editPlatform === option.value
                            ? 'bg-primary text-white font-bold'
                            : 'text-text hover:bg-surface-raised'
                        }`}
                      >
                        <span>{option.label}</span>
                        {editPlatform === option.value && <Icon name="check" size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Reel URL
                </label>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Thumbnail (Replace / Optional)
                </label>
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="w-full h-11 px-4 rounded-xl border border-line bg-surface-raised text-sm text-text hover:bg-surface-raisedHover transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="text-text text-xs font-semibold truncate pr-2">
                    {editSelectedFileName || 'Choose new thumbnail image'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                    <Icon name="upload" size={14} />
                    <span>Browse</span>
                  </div>
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={editFileInputRef}
                  onChange={handleEditFileChange}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Caption
                  </label>
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editOrder}
                    onChange={(e) => setEditOrder(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditingReel(null)}
                  className="px-5 py-2.5 rounded-xl border border-line text-xs font-bold text-muted hover:text-text transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                >
                  {isUploading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
