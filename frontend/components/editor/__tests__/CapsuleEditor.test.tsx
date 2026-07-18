import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CapsuleEditor } from '../CapsuleEditor';
import type { CapsuleDraft } from '../../../lib/capsule-types';

const draft: CapsuleDraft = {
  id: 'capsule-1', revision: 4, status: 'DRAFT',
  document: { apiVersion: 'sandlabx.io/v1alpha1', kind: 'LabCapsule', metadata: { name: 'routing' }, images: {}, nodes: {}, links: [], scenarios: [] },
};

describe('CapsuleEditor', () => {
  it('starts on a blank canvas and adds a canonical node from its profile', () => {
    const onSave = vi.fn();
    render(<CapsuleEditor draft={draft} profiles={[{ id: 'router', name: 'Router', interfaces: ['eth0', 'eth1'] }]} onSave={onSave} />);

    expect(screen.getByText(/blank canvas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add router/i }));
    expect(screen.getByText('Router')).toBeInTheDocument();
    expect(screen.getByText('eth0')).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nodes: expect.objectContaining({ router: expect.any(Object) }) }));
  });
});
