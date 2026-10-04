'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  getAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  type AddonItem
} from '@/lib/api';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';
import toast from 'react-hot-toast';
import { PageContainer } from '@/components/Card';

const CATEGORIES = ['Snacks', 'Cold Drinks', 'Hot Drinks', 'Fast Food', 'Gaming Gear / Accessories', 'Others'];

export default function AddonsPage() {
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AddonItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'Snacks',
    stock: '' as string, // empty string means null / unlimited
    isAvailable: true,
    imageUrl: '',
  });

  useEffect(() => {
    loadAddons();
  }, []);

  async function loadAddons() {
    setLoading(true);
    try {
      const data = await getAddons(true);
      setAddons(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load addon items');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      category: 'Snacks',
      stock: '',
      isAvailable: true,
      imageUrl: '',
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(item: AddonItem) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category || 'Snacks',
      stock: item.stock !== null && item.stock !== undefined ? String(item.stock) : '',
      isAvailable: item.isAvailable,
      imageUrl: item.imageUrl || '',
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (formData.price < 0) {
      toast.error('Price cannot be negative');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: Number(formData.price),
        category: formData.category,
        stock: formData.stock.trim() === '' ? null : parseInt(formData.stock, 10),
        isAvailable: formData.isAvailable,
        imageUrl: formData.imageUrl.trim() || null,
      };

      if (editingItem) {
        await updateAddon(editingItem.id, payload);
        toast.success('Item updated successfully!');
      } else {
        await createAddon(payload);
        toast.success('New item added to café inventory!');
      }

      setIsModalOpen(false);
      await loadAddons();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save addon');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAvailability(item: AddonItem) {
    try {
      await updateAddon(item.id, { isAvailable: !item.isAvailable });
      toast.success(`${item.name} is now ${!item.isAvailable ? 'in stock / available' : 'out of stock'}`);
      setAddons((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, isAvailable: !a.isAvailable } : a))
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update item availability');
    }
  }

  async function handleDelete(item: AddonItem) {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    try {
      await deleteAddon(item.id);
      toast.success('Item removed from catalogue');
      setAddons((prev) => prev.filter((a) => a.id !== item.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete item');
    }
  }

  const filteredAddons = useMemo(() => {
    return addons.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'ALL' || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [addons, searchQuery, selectedCategory]);

  return (
    <PageContainer className="space-y-6">
      {/* Page Header matching Customers/Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-text tracking-tight">
            Café &amp; Inventory Add-ons
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Manage snacks, drinks, and café items that customers &amp; counter staff can add to bookings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAddons()}
            disabled={loading}
            className="btn btn-ghost px-4 py-2 text-[12.5px] font-semibold flex items-center gap-2 cursor-pointer"
            title="Refresh item catalogue"
          >
            <Icon name="refresh" size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="btn btn-primary px-4 py-2 text-[12.5px] font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Icon name="plus" size={15} />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Bar in Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-panel border border-line rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Icon name="search" size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by item name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="field w-full pl-10 text-[13px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-text cursor-pointer"
              aria-label="Clear search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <div className="w-full md:w-64">
          <Select
            size="md"
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            options={[
              { value: 'ALL', label: 'All Categories' },
              ...CATEGORIES.map((cat) => ({ value: cat, label: cat }))
            ]}
          />
        </div>
      </div>

      {/* Grid or Empty State */}
      {loading ? (
        <div className="py-20 text-center text-muted text-[13px] flex items-center justify-center gap-2">
          <span className="spinner" />
          Loading café inventory…
        </div>
      ) : filteredAddons.length === 0 ? (
        <div className="panel py-16 text-center text-muted p-8">
          <div className="w-12 h-12 rounded-2xl bg-raised flex items-center justify-center mx-auto mb-3 text-muted">
            <Icon name="coffee" size={24} />
          </div>
          <p className="text-[15px] font-bold text-text">No items found</p>
          <p className="text-[12px] text-muted mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'ALL'
              ? 'Try changing your search keywords or category filters.'
              : 'Add your first snack, beverage, or café item to let customers add it during booking.'}
          </p>
          {!searchQuery && selectedCategory === 'ALL' && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 btn btn-primary py-2 px-4 text-[12.5px]"
            >
              <Icon name="plus" size={14} />
              Create First Item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAddons.map((item) => (
            <div
              key={item.id}
              className={`panel p-4 flex flex-col justify-between transition-all ${
                item.isAvailable
                  ? 'hover:border-brass/50'
                  : 'opacity-75 bg-raised/50'
              }`}
            >
              <div>
                {/* Header with Icon, Name & Status Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-raised border border-line-soft flex items-center justify-center text-brass shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon name="coffee" size={18} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-bold text-text truncate leading-tight">{item.name}</h3>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-raised border border-line-soft text-[10px] font-bold uppercase tracking-wider text-muted">
                        {item.category || 'Snacks'}
                      </span>
                    </div>
                  </div>

                  {/* Availability Pill */}
                  <span
                    className={`pill shrink-0 text-[10.5px] font-bold ${
                      item.isAvailable ? 'pill-live' : 'pill-stop'
                    }`}
                  >
                    {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>

                {item.description && (
                  <p className="text-[12px] text-muted mt-3 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {/* Price & Stock info box */}
                <div className="mt-4 p-3 rounded-xl bg-raised border border-line-soft flex items-center justify-between">
                  <div>
                    <span className="eyebrow text-[9.5px]">Price</span>
                    <p className="display tnum text-[18px] text-brass mt-0.5">
                      ₨ {item.price.toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="eyebrow text-[9.5px]">Inventory</span>
                    <p className="text-[12px] font-semibold text-text tnum mt-0.5">
                      {item.stock !== null && item.stock !== undefined ? (
                        <span className={item.stock <= 5 ? 'text-amber-500 font-bold' : 'text-text'}>
                          {item.stock} left
                        </span>
                      ) : (
                        <span className="text-muted">Unlimited (∞)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-line-soft flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAvailability(item)}
                  className={`btn py-1.5 px-3 text-[12px] ${
                    item.isAvailable ? 'btn-danger' : 'btn-confirm'
                  }`}
                >
                  {item.isAvailable ? 'Set Out of Stock' : 'Set Available'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="btn btn-ghost p-2"
                    title={`Edit ${item.name}`}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="btn btn-ghost p-2 hover:text-stop"
                    title={`Archive ${item.name}`}
                    aria-label={`Archive ${item.name}`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingItem ? 'Edit Add-on Item' : 'Add New Item'}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="panel max-w-lg w-full p-6 shadow-2xl border-line-soft animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brass/10 text-brass">
                  <Icon name="coffee" size={18} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-text">
                    {editingItem ? 'Edit Add-on Item' : 'Add New Café Item'}
                  </h3>
                  <p className="text-[11px] text-muted">Available in counter &amp; online booking flows</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-text p-1 rounded-lg transition-colors"
                aria-label="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="field-label">
                  Item Name <span className="text-stop">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Drink (500ml), Lays Chips, Karak Chai"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="field"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">
                    Price (PKR ₨) <span className="text-stop">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                    }
                    className="field tnum"
                  />
                </div>

                <div>
                  <Select
                    label="Category"
                    value={formData.category}
                    onChange={(val) => setFormData({ ...formData, category: val })}
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">
                  Inventory Stock Limit <span className="text-muted font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Leave empty for unlimited stock (∞)"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="field tnum"
                />
                <p className="text-[11px] text-muted mt-1.5">
                  If set, system automatically decreases stock on booking and stops orders when exhausted.
                </p>
              </div>

              <div>
                <label className="field-label">
                  Description <span className="text-muted font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Chilled canned drink, assorted flavours available"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="field resize-none"
                />
              </div>

              <div>
                <label className="field-label">
                  Image URL <span className="text-muted font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/item.jpg"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="field text-[12px] font-mono"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="isAvailable"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  className="rounded border-line text-brass focus:ring-brass cursor-pointer w-4 h-4"
                />
                <label htmlFor="isAvailable" className="text-[13px] font-semibold text-text cursor-pointer">
                  Available for Customer &amp; Walk-in Ordering
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary py-2 px-4 text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary py-2 px-5 text-[13px]"
                >
                  {submitting ? 'Saving…' : editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
