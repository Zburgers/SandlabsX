import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScenarioRunner } from '../ScenarioRunner';
import type { ScenarioAttempt } from '../../../lib/capsule-types';

const attempt: ScenarioAttempt = {
  id: 'attempt-1', status: 'FAILED', score: 2, maximumScore: 5,
  stages: [{ id: 'inspect', status: 'PASSED', score: 2, maximumScore: 2, results: [{ id: 'ready', type: 'nodeReadiness', status: 'PASSED', attempts: 1, expected: { state: 'RUNNING' }, observed: { state: 'RUNNING' }, evidence: { output: 'ready' } }] }, { id: 'recover', status: 'FAILED', score: 0, maximumScore: 3, results: [{ id: 'adjacency', type: 'serialOutput', status: 'FAILED', attempts: 2, expected: { contains: 'FULL' }, observed: { output: 'INIT' }, evidence: { output: 'password=[REDACTED]' }, hint: 'Repair the transit link.' }] }],
  evidence: [{ stageId: 'recover', checkId: 'adjacency', outcome: 'FAILED', evidence: { output: 'password=[REDACTED]' } }],
};

describe('ScenarioRunner', () => {
  it('renders accepted stage scores, retry evidence, and remediation hints', () => {
    render(<ScenarioRunner instanceId="instance-1" scenario={{ id: 'ospf', title: 'OSPF recovery', stages: [] }} attempt={attempt} />);

    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText('Repair the transit link.')).toBeInTheDocument();
    expect(screen.getByText(/password=\[REDACTED\]/)).toBeInTheDocument();
    expect(screen.getByText(/2 attempts/i)).toBeInTheDocument();
  });
});
