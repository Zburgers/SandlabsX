'use client';

import React, { useState } from 'react';
import type { CreateNodeRequest, BaseImageType } from '../../lib/types';

interface AddNodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateNodeRequest) => Promise<void>;
}

const osOptions: { value: BaseImageType; label: string; icon: string }[] = [
    { value: 'ubuntu', label: 'Ubuntu', icon: '🐧' },
    { value: 'debian', label: 'Debian', icon: '🌀' },
    { value: 'alpine', label: 'Alpine', icon: '🏔️' },
    { value: 'fedora', label: 'Fedora', icon: '🎩' },
    { value: 'router', label: 'Cisco Router', icon: '🌐' },
];

export function AddNodeModal({ isOpen, onClose, onCreate }: AddNodeModalProps) {
    const [name, setName] = useState('');
    const [osType, setOsType] = useState<BaseImageType>('ubuntu');
    const [cpu, setCpu] = useState(2);
    const [ram, setRam] = useState(2048);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsCreating(true);

        try {
            await onCreate({
                name: name || undefined,
                imageType: 'base',
                baseImage: osType,
                resources: {
                    cpu,
                    ram,
                },
            });
            // Reset form
            setName('');
            setOsType('ubuntu');
            setCpu(2);
            setRam(2048);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create node');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-lab-gray rounded-2xl border border-lab-gray-light shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-lab-gray-light">
                    <h2 className="text-lg font-semibold text-white">Add New Node</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Create a new virtual machine node
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm text-gray-300 mb-2">
                            Node Name (optional)
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., web-server-1"
                            className="w-full px-4 py-2.5 bg-lab-darker border border-lab-gray-light rounded-lg text-white placeholder-gray-500 focus:border-lab-primary focus:outline-none transition-colors"
                        />
                    </div>

                    {/* OS Type */}
                    <div>
                        <label className="block text-sm text-gray-300 mb-2">
                            Operating System
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {osOptions.map((os) => (
                                <button
                                    key={os.value}
                                    type="button"
                                    onClick={() => setOsType(os.value)}
                                    className={`px-3 py-3 rounded-lg border-2 transition-all ${osType === os.value
                                            ? 'border-lab-primary bg-lab-primary/20'
                                            : 'border-lab-gray-light hover:border-gray-500'
                                        }`}
                                >
                                    <div className="text-2xl mb-1">{os.icon}</div>
                                    <div className="text-xs text-gray-300">{os.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Resources */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* CPU */}
                        <div>
                            <label className="block text-sm text-gray-300 mb-2">
                                vCPU: {cpu} cores
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="8"
                                value={cpu}
                                onChange={(e) => setCpu(Number(e.target.value))}
                                className="w-full accent-lab-primary"
                            />
                        </div>

                        {/* RAM */}
                        <div>
                            <label className="block text-sm text-gray-300 mb-2">
                                RAM: {ram >= 1024 ? `${ram / 1024}GB` : `${ram}MB`}
                            </label>
                            <input
                                type="range"
                                min="512"
                                max="16384"
                                step="512"
                                value={ram}
                                onChange={(e) => setRam(Number(e.target.value))}
                                className="w-full accent-lab-primary"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-lab-gray-light hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="flex-1 px-4 py-2.5 bg-lab-primary hover:bg-lab-primary/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {isCreating ? 'Creating...' : 'Create Node'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
