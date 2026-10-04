'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Icon } from '@/components/Icon';
import { getGallery, uploadGalleryImage, updateGalleryImage, deleteGalleryImage, type GalleryImage } from '@/lib/api';
import { PageContainer } from '@/components/Card';

export default function AdminGalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCaption, setNewCaption] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newOrder, setNewOrder] = useState('0');
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const data = await getGallery();
      setImages(data);
    } catch (err) {
      toast.error('Failed to load gallery images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
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
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewBase64) {
      toast.error('Please select an image first');
      return;
    }

    try {
      setIsUploading(true);
      await uploadGalleryImage({
        imageBase64: previewBase64,
        caption: newCaption || undefined,
        category: newCategory || undefined,
        displayOrder: parseInt(newOrder, 10) || 0,
        isActive: true,
      });

      toast.success('Image uploaded successfully');
      setPreviewBase64(null);
      setSelectedFileName(null);
      setNewCaption('');
      setNewCategory('');
      setNewOrder('0');
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchImages();
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleActive = async (image: GalleryImage) => {
    try {
      // Optimistic update
      setImages(images.map(img => img.id === image.id ? { ...img, isActive: !image.isActive } : img));

      await updateGalleryImage(image.id, { isActive: !image.isActive });
      toast.success('Visibility updated');
    } catch (error) {
      toast.error('Failed to update visibility');
      fetchImages(); // revert
    }
  };

  const updateOrder = async (image: GalleryImage, newDisplayOrder: number) => {
    if (isNaN(newDisplayOrder)) return;
    try {
      setImages(images.map(img => img.id === image.id ? { ...img, displayOrder: newDisplayOrder } : img));
      await updateGalleryImage(image.id, { displayOrder: newDisplayOrder });
      toast.success('Order updated');
    } catch (error) {
      toast.error('Failed to update order');
      fetchImages(); // revert
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this image?')) return;

    try {
      await deleteGalleryImage(id);
      toast.success('Image deleted');
      setImages(images.filter(img => img.id !== id));
    } catch (error) {
      toast.error('Failed to delete image');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Base URL for Images (Assuming local testing runs on port 3001)
  const getFullImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads/')) return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`;
    if (url.startsWith('/images/')) return `${process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3002'}${url}`;
    return url;
  };

  return (
    <PageContainer className="p-4 sm:p-8 space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Photo Gallery</h1>
          <p className="text-muted text-sm mt-1">Manage public website photos and their ordering.</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="panel rounded-2xl border border-line p-5 sm:p-8 bg-surface">
        <h2 className="text-lg font-bold text-text mb-4">Upload New Image</h2>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Image File</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-11 px-4 rounded-xl border border-line bg-surface-raised text-sm text-text hover:bg-surface-raisedHover transition-colors flex items-center justify-between"
              >
                <span className="text-text text-xs font-semibold truncate pr-2">
                  {selectedFileName || 'Click to select image file'}
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
              <div className="relative w-48 h-32 rounded-lg overflow-hidden border border-line">
                <Image src={previewBase64} alt="Preview" fill className="object-cover" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Caption (Optional)</label>
              <input
                type="text"
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder="e.g., PS5 VIP Room"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Category</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g., General"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Order</label>
                <input
                  type="number"
                  value={newOrder}
                  onChange={(e) => setNewOrder(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-text placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 pt-2">
            <button
              type="submit"
              disabled={isUploading || !previewBase64}
              className="px-6 py-3 min-h-[44px] bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Save to Gallery'}
            </button>
          </div>
        </form>
      </div>

      {/* Grid View */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-text">Current Gallery Images ({images.length})</h2>
        {images.length === 0 ? (
          <div className="text-center py-12 bg-raised/30 border border-line border-dashed rounded-2xl text-muted text-sm">
            No images in the gallery yet. Upload one above!
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.sort((a, b) => a.displayOrder - b.displayOrder).map(image => (
              <div key={image.id} className="group relative bg-surface border border-line rounded-2xl overflow-hidden flex flex-col p-2 shadow-xs transition-shadow hover:shadow-sm">
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-raised">
                  <Image
                    src={getFullImageUrl(image.imageUrl)}
                    alt={image.caption || 'Gallery image'}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    unoptimized
                  />
                  {!image.isActive && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Hidden</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(image.id)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Image"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <div className="p-3 pb-2 flex-grow flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-bold text-text truncate" title={image.caption || 'No Caption'}>
                      {image.caption || <span className="text-muted/50 italic">No Caption</span>}
                    </div>
                    {image.category && (
                      <div className="text-[10px] text-primary font-semibold mt-0.5 uppercase tracking-wider">
                        {image.category}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-line/50 pt-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-muted">Order</label>
                      <input
                        type="number"
                        value={image.displayOrder}
                        onChange={(e) => updateOrder(image, parseInt(e.target.value, 10))}
                        className="w-12 h-7 px-1.5 rounded-md border border-line bg-raised text-[11px] text-center text-text font-bold"
                      />
                    </div>
                    <button
                      onClick={() => toggleActive(image)}
                      className="min-w-[44px] min-h-[32px] flex items-center justify-center text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors border"
                      style={{
                        backgroundColor: image.isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: image.isActive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                        borderColor: image.isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      {image.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
