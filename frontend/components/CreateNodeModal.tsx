'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { BaseImageType, CreateNodeRequest, ImageInfo, ImageSourceType } from '../lib/types';
import { Button } from './Button';
import { baseImages } from '../lib/mockData';
import { apiClient } from '../lib/api';

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateNodeRequest) => Promise<void>;
}

export const CreateNodeModal: React.FC<CreateNodeModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSelection, setImageSelection] = useState<{ type: ImageSourceType; id: string | null }>({ type: 'base', id: 'ubuntu' });
  const [nodeName, setNodeName] = useState('');
  const [resources, setResources] = useState({
    cpu: 2,
    ram: 2048,
    disk: 10,
  });
  const [customImages, setCustomImages] = useState<ImageInfo[]>([]);
  const [baseOptions, setBaseOptions] = useState<ImageInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Added memoised fallback list for offline usage
  const fallbackBaseOptions = useMemo<ImageInfo[]>(() => baseImages.map((img) => ({
    type: 'base' as const,
    id: img.type,
    name: img.name,
    description: img.description,
    path: '',
    size: img.size,
    sizeBytes: 0,
    available: img.available,
  })), []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
    const loadImages = async () => {
      setImageLoading(true);
      setImageError(null);
      try {
        const response = await apiClient.listImages();
        if (isCancelled) {
          return;
        }
        if (response.success && response.data) {
          setBaseOptions(response.data.baseImages);
          setCustomImages(response.data.customImages);
        } else {
          setImageError(response.error || 'Failed to load images');
          setBaseOptions(fallbackBaseOptions);
        }
      } catch (error) {
        if (!isCancelled) {
          setImageError(error instanceof Error ? error.message : 'Failed to load images');
          setBaseOptions(fallbackBaseOptions);
        }
      } finally {
        if (!isCancelled) {
          setImageLoading(false);
        }
      }
    };

    loadImages();

    return () => {
      isCancelled = true;
    };
  }, [fallbackBaseOptions, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageSelection.id) {
      alert('Select an image before creating the node.');
      return;
    }
    setLoading(true);
    try {
      await onCreate({
        name: nodeName || undefined,
        imageType: imageSelection.type,
        baseImage: imageSelection.type === 'base' ? (imageSelection.id as BaseImageType) : undefined,
        customImageName: imageSelection.type === 'custom' ? imageSelection.id ?? undefined : undefined,
        resources,
      });
      // Reset form
      setNodeName('');
      setImageSelection({ type: 'base', id: 'ubuntu' });
      setResources({ cpu: 2, ram: 2048, disk: 10 });
      onClose();
    } catch (error) {
      console.error('Failed to create node:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setImageError(null);
    try {
      const response = await apiClient.uploadCustomImage(file);
      if (response.success && response.data?.image) {
        const uploaded = response.data.image;
        setCustomImages((prev) => [...prev, uploaded]);
        setImageSelection({ type: 'custom', id: uploaded.id });
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Custom image upload failed:', error);
      setImageError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const renderImageCard = (image: ImageInfo, disabled: boolean, isActive: boolean, onSelect: () => void) => (
    <button
      key={`${image.type}-${image.id}`}
      type="button"
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      className={`
        relative p-4 rounded-lg border-2 transition-all text-left
        ${isActive ? 'border-lab-primary bg-lab-primary/10' : 'border-lab-gray-light bg-lab-darker'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-lab-primary/50 cursor-pointer'}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-white">{image.name || image.id}</h3>
        {!image.available && (
          <span className="text-xs bg-lab-warning/20 text-lab-warning px-2 py-1 rounded">
            Unavailable
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-2">
        {image.description || (image.type === 'custom' ? 'User provided image' : 'Base image')}
      </p>
      <p className="text-xs text-gray-500">Size: {image.size}</p>
      {isActive && (
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 bg-lab-primary rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-lab-darker"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-lab-gray rounded-2xl border border-lab-gray-light max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-lab-gray-light">
          <h2 className="text-2xl font-bold text-white">Create New Node</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Node Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Node Name (optional)
            </label>
            <input
              type="text"
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              placeholder="e.g., dev-server-1"
              className="w-full bg-lab-darker border border-lab-gray-light rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lab-primary"
            />
            <p className="mt-1 text-xs text-gray-500">
              Auto-generated if left empty
            </p>
          </div>

          {/* Base Image Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Base Image
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(baseOptions.length ? baseOptions : fallbackBaseOptions).map((image) =>
                renderImageCard(
                  image,
                  !image.available,
                  imageSelection.type === 'base' && imageSelection.id === image.id,
                  () => setImageSelection({ type: 'base', id: image.id })
                )
              )}
            </div>
            {imageError && (
              <p className="mt-2 text-xs text-lab-warning">⚠️ {imageError}</p>
            )}
            {imageLoading && (
              <p className="mt-2 text-xs text-gray-400">Loading image catalogue…</p>
            )}
          </div>

          {/* Custom Images */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300">
                Custom QCOW2 Images
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".qcow2"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCustomUploadClick}
                  loading={uploading}
                >
                  Upload QCOW2
                </Button>
              </div>
            </div>
            {customImages.length === 0 && (
              <p className="text-xs text-gray-500">No custom images uploaded yet.</p>
            )}
            {customImages.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customImages.map((image) =>
                  renderImageCard(
                    image,
                    !image.available,
                    imageSelection.type === 'custom' && imageSelection.id === image.id,
                    () => setImageSelection({ type: 'custom', id: image.id })
                  )
                )}
              </div>
            )}
          </div>

          {/* Resources - Enhanced with visual cards */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Resource Allocation
            </label>
            
            {/* CPU */}
            <div className="bg-gradient-to-br from-lab-primary/10 to-lab-primary/5 rounded-xl p-4 border border-lab-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <span className="text-sm font-medium text-gray-300">CPU Cores</span>
                </div>
                <div className="bg-lab-primary/20 px-3 py-1.5 rounded-lg">
                  <span className="text-lg font-bold text-white">{resources.cpu}</span>
                  <span className="text-xs text-gray-400 ml-1">/ 8</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                value={resources.cpu}
                onChange={(e) =>
                  setResources({ ...resources, cpu: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-lab-darker rounded-lg appearance-none cursor-pointer accent-lab-primary"
              />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>1 core</span>
                <span>8 cores</span>
              </div>
            </div>

            {/* RAM */}
            <div className="bg-gradient-to-br from-lab-secondary/10 to-lab-secondary/5 rounded-xl p-4 border border-lab-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💾</span>
                  <span className="text-sm font-medium text-gray-300">Memory (RAM)</span>
                </div>
                <div className="bg-lab-secondary/20 px-3 py-1.5 rounded-lg">
                  <span className="text-lg font-bold text-white">{resources.ram}</span>
                  <span className="text-xs text-gray-400 ml-1">MB</span>
                </div>
              </div>
              <input
                type="range"
                min="512"
                max="8192"
                step="512"
                value={resources.ram}
                onChange={(e) =>
                  setResources({ ...resources, ram: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-lab-darker rounded-lg appearance-none cursor-pointer accent-lab-secondary"
              />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>512 MB</span>
                <span>8 GB</span>
              </div>
            </div>

            {/* Disk */}
            <div className="bg-gradient-to-br from-lab-accent/10 to-lab-accent/5 rounded-xl p-4 border border-lab-accent/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💿</span>
                  <span className="text-sm font-medium text-gray-300">Disk Space</span>
                </div>
                <div className="bg-lab-accent/20 px-3 py-1.5 rounded-lg">
                  <span className="text-lg font-bold text-white">{resources.disk}</span>
                  <span className="text-xs text-gray-400 ml-1">GB</span>
                </div>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={resources.disk}
                onChange={(e) =>
                  setResources({ ...resources, disk: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-lab-darker rounded-lg appearance-none cursor-pointer accent-lab-accent"
              />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>5 GB</span>
                <span>100 GB</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={loading}
            >
              Create Node
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
