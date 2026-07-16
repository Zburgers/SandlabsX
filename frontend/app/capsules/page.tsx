'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import type { CapsuleDocument, CapsuleRecord, CapsuleVersion, LabInstance } from '../../lib/types';

const starter: CapsuleDocument = {
  apiVersion: 'sandlabx.io/v1alpha1',
  kind: 'LabCapsule',
  metadata: { name: 'new-capsule', displayName: 'New Capsule' },
  images: {},
  nodes: {},
  links: [],
  scenarios: [],
};

export default function CapsulesPage() {
  const [capsules, setCapsules] = useState<CapsuleRecord[]>([]);
  const [document, setDocument] = useState(JSON.stringify(starter, null, 2));
  const [selectedVersion, setSelectedVersion] = useState<CapsuleVersion | null>(null);
  const [instance, setInstance] = useState<LabInstance | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const response = await apiClient.listCapsules();
    if (response.success && response.data) setCapsules(response.data.capsules);
    else setMessage(response.error || 'Unable to load Capsules');
  };

  useEffect(() => { void load(); }, []);

  const createAndPublish = async () => {
    try {
      const created = await apiClient.createCapsule(JSON.parse(document));
      if (!created.success || !created.data) throw new Error(created.error || 'Capsule creation failed');
      const published = await apiClient.publishCapsule(created.data.capsule.id);
      if (!published.success || !published.data) throw new Error(published.error || 'Publication failed');
      setSelectedVersion(published.data.version);
      setMessage(`Published v${published.data.version.versionNumber}`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid Capsule JSON'); }
  };

  const createInstance = async () => {
    if (!selectedVersion) return;
    const response = await apiClient.createInstance(selectedVersion.id, `${selectedVersion.document.metadata.name}-instance`);
    if (response.success && response.data) { setInstance(response.data.instance); setMessage('Instance created in STOPPED state'); }
    else setMessage(response.error || 'Instance creation failed');
  };

  return (
    <main className="min-h-screen bg-lab-darker text-white p-8">
      <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <p className="text-sm text-lab-primary uppercase tracking-wider">SandLabX</p>
          <h1 className="text-3xl font-bold mt-2">Lab Capsules</h1>
          <p className="text-gray-400 mt-2">Author a versioned definition, publish it, then create an isolated instance.</p>
          <textarea aria-label="Capsule JSON" value={document} onChange={event => setDocument(event.target.value)} className="mt-6 w-full min-h-[420px] rounded-lg bg-black/30 border border-gray-700 p-4 font-mono text-sm" />
          <button type="button" onClick={() => void createAndPublish()} className="mt-4 rounded-lg bg-lab-primary px-4 py-2 font-semibold">Validate and publish</button>
          {selectedVersion && <button type="button" onClick={() => void createInstance()} className="mt-4 ml-3 rounded-lg border border-gray-600 px-4 py-2">Create instance</button>}
          {message && <p className="mt-4 text-sm text-gray-300" role="status">{message}</p>}
        </section>
        <section className="rounded-lg border border-gray-800 bg-black/20 p-5">
          <h2 className="text-xl font-semibold">Your Capsules</h2>
          <div className="mt-4 space-y-3">{capsules.map(capsule => <div key={capsule.id} className="rounded border border-gray-800 p-3"><div className="font-medium">{capsule.document.metadata.displayName || capsule.document.metadata.name}</div><div className="text-xs text-gray-400">{capsule.status} · revision {capsule.revision}</div></div>)}</div>
          {instance && <div className="mt-8 rounded border border-lab-primary/40 p-3"><div className="font-medium">{instance.name}</div><div className="text-xs text-gray-400">{instance.state} · version {selectedVersion?.versionNumber}</div></div>}
        </section>
      </div>
    </main>
  );
}
