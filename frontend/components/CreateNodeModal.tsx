'use client';

import React, { useState } from 'react';
import type { BaseImageType, CreateNodeRequest } from '../lib/types';
import { Button } from './Button';
import { baseImages } from '../lib/mockData';

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
  const [selectedImage, setSelectedImage] = useState<BaseImageType>('ubuntu');
  const [nodeName, setNodeName] = useState('');
  const [resources, setResources] = useState({
    cpu: 2,
    ram: 2048,
    disk: 10,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate({
        name: nodeName || undefined,
        baseImage: selectedImage,
        resources,
      });
      // Reset form
      setNodeName('');
      setSelectedImage('ubuntu');
      setResources({ cpu: 2, ram: 2048, disk: 10 });
      onClose();
    } catch (error) {
      console.error('Failed to create node:', error);
    } finally {
      setLoading(false);
    }
  };

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
              {baseImages.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => image.available && setSelectedImage(image.type)}
                  disabled={!image.available}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all text-left
                    ${
                      selectedImage === image.type
                        ? 'border-lab-primary bg-lab-primary/10'
                        : 'border-lab-gray-light bg-lab-darker'
                    }
                    ${
                      image.available
                        ? 'hover:border-lab-primary/50 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white">{image.name}</h3>
                    {!image.available && (
                      <span className="text-xs bg-lab-warning/20 text-lab-warning px-2 py-1 rounded">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    {image.description}
                  </p>
                  <p className="text-xs text-gray-500">Size: {image.size}</p>
                  {selectedImage === image.type && (
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
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">
              Resources
            </label>
            
            {/* CPU */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">CPU Cores</span>
                <span className="text-sm font-semibold text-white">
                  {resources.cpu}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                value={resources.cpu}
                onChange={(e) =>
                  setResources({ ...resources, cpu: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>

            {/* RAM */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">RAM (MB)</span>
                <span className="text-sm font-semibold text-white">
                  {resources.ram} MB
                </span>
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
                className="w-full"
              />
            </div>

            {/* Disk */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Disk (GB)</span>
                <span className="text-sm font-semibold text-white">
                  {resources.disk} GB
                </span>
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
                className="w-full"
              />
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
