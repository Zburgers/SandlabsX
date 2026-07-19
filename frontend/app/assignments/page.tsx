'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusSignal } from '../../components/ui/StatusSignal';
import { SurfaceState } from '../../components/ui/SurfaceState';
import { capsuleApi } from '../../lib/capsule-api';
import type { AssignmentSummary } from '../../lib/capsule-types';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => { capsuleApi.listAssignments().then(setAssignments).catch(error => setError(error.message)).finally(() => setLoading(false)); }, []);
  return <div className="mx-auto max-w-[88rem] px-4 py-7 sm:px-7 sm:py-10 xl:px-10"><PageHeader eyebrow="Delivery" title="Assignments" description="Eligible learners receive an exact Capsule and Scenario version. Runtime access stays scoped to assignment membership." />
    <div className="mt-8">{loading ? <SurfaceState tone="loading" title="Loading assignments" detail="Reading assignments available to your account." /> : error ? <SurfaceState tone="error" title="Assignments are unavailable" detail={error} /> : assignments.length ? <ul className="surface divide-y divide-border overflow-hidden rounded-[var(--radius-lg)]">{assignments.map(assignment => <li key={assignment.id} className="grid gap-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><h2 className="font-semibold">{assignment.title || assignment.name || `Assignment ${assignment.id.slice(0, 8)}`}</h2><p className="mt-1 text-xs text-[var(--muted)] mono">{assignment.capsuleVersionId || 'Capsule version unavailable'}</p></div><StatusSignal label={assignment.status || assignment.role || 'assigned'} tone="info" /></li>)}</ul> : <SurfaceState title="No assignments yet" detail="Assignments created for your account will appear here with their pinned Capsule and Scenario versions." />}</div>
  </div>;
}
