'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const test = require('node:test');
const { Client, Pool } = require('pg');
const { CapsuleRepository } = require('../repositories/capsuleRepository');
const { OperationRepository } = require('../repositories/operationRepository');
const { ReservationRepository } = require('../repositories/reservationRepository');
const { AdmissionService } = require('../services/admissionService');

const run = promisify(execFile);
const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://guacamole_user:guacamole_pass@127.0.0.1:5432/guacamole_db';
const databaseName = `sandlabx_control_plane_test_${crypto.randomUUID().replaceAll('-', '')}`;
const disposableUrl = new URL(baseUrl);
disposableUrl.pathname = `/${databaseName}`;
const ownerA = '00000000-0000-0000-0000-0000000000a1';
const ownerB = '00000000-0000-0000-0000-0000000000b1';
const digest = `sha256:${'a'.repeat(64)}`;

function document(name = 'postgres-routing') {
  return { apiVersion: 'sandlabx.io/v1alpha1', kind: 'LabCapsule', metadata: { name, displayName: name }, runtime: { architecture: 'x86_64' }, policy: { network: { internetEgress: false } }, images: { router: { version: 'image-v1', digest } }, workloadProfiles: { router: { version: 'profile-v1' } }, nodes: { r1: { driver: 'qemu', image: 'router', workloadProfile: 'router', interfaces: [{ id: 'eth0' }] } }, links: [] };
}

async function migrate() { await run(process.execPath, ['scripts/migrate.js', 'up'], { cwd: __dirname + '/..', env: { ...process.env, DATABASE_URL: disposableUrl.toString() } }); }

test('PostgreSQL control plane persists authoritative drafts, immutable private/public revisions, ordered events, rollback, and owner-scoped resumes', async (t) => {
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${databaseName}`);
  await migrate();
  const pool = new Pool({ connectionString: disposableUrl.toString(), max: 8 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`); await admin.end(); });
  await pool.query("INSERT INTO sandlabx_users (id,email,password_hash,role) VALUES ($1,'owner-a@example.test','x','instructor'),($2,'owner-b@example.test','x','instructor')", [ownerA, ownerB]);

  const capsules = new CapsuleRepository({ pool });
  const draft = await capsules.createDraft(ownerA, document());
  const stored = await pool.query('SELECT draft_document FROM sandlabx_capsules WHERE id=$1', [draft.id]);
  assert.deepEqual(stored.rows[0].draft_document, {});
  assert.equal((await pool.query('SELECT document FROM sandlabx_capsule_drafts WHERE capsule_id=$1', [draft.id])).rowCount, 1);
  const [firstUpdate, secondUpdate] = await Promise.allSettled([
    capsules.updateDraft(draft.id, 1, { metadata: { ...draft.document.metadata, description: 'first' } }),
    capsules.updateDraft(draft.id, 1, { metadata: { ...draft.document.metadata, description: 'second' } }),
  ]);
  assert.equal([firstUpdate, secondUpdate].filter(result => result.status === 'fulfilled').length, 1);
  assert.equal([firstUpdate, secondUpdate].filter(result => result.status === 'rejected')[0].reason.code, 'REVISION_CONFLICT');

  const privateRevision = await capsules.createVersion({ capsuleId: draft.id, authorId: ownerA, visibility: 'PRIVATE', document: draft.document });
  const publishedVersion = await capsules.createVersion({ capsuleId: draft.id, authorId: ownerA, visibility: 'PUBLISHED', document: draft.document });
  assert.equal(privateRevision.visibility, 'PRIVATE');
  assert.equal(publishedVersion.visibility, 'PUBLISHED');
  const [nextPrivateA, nextPrivateB] = await Promise.all([
    capsules.createVersion({ capsuleId: draft.id, authorId: ownerA, visibility: 'PRIVATE', document: { ...draft.document, images: { router: { version: 'image-v2', digest: `sha256:${'b'.repeat(64)}` } } } }),
    capsules.createVersion({ capsuleId: draft.id, authorId: ownerA, visibility: 'PRIVATE', document: { ...draft.document, images: { router: { version: 'image-v3', digest: `sha256:${'c'.repeat(64)}` } } } }),
  ]);
  assert.deepEqual([nextPrivateA.versionNumber, nextPrivateB.versionNumber].sort((a, b) => a - b), [2, 3]);
  assert.equal((await capsules.getVersion(privateRevision.id)).visibility, 'PRIVATE');
  assert.equal((await capsules.getVersion(publishedVersion.id)).visibility, 'PUBLISHED');
  await assert.rejects(pool.query('UPDATE sandlabx_capsule_private_revisions SET normalized_document = $1 WHERE id = $2', [{ changed: true }, privateRevision.id]), /immutable version rows cannot be modified/);
  await assert.rejects(pool.query('UPDATE sandlabx_capsule_versions SET normalized_document = $1 WHERE id = $2', [{ changed: true }, publishedVersion.id]), /immutable version rows cannot be modified/);

  await assert.rejects(capsules.transaction(async client => { await capsules.createDraft(ownerA, document('rolled-back'), client); throw new Error('rollback'); }), /rollback/);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM sandlabx_capsules WHERE name='rolled-back'")).rows[0].count, 0);

  const operations = new OperationRepository({ pool });
  const [sameA, sameB] = await Promise.all([
    operations.create({ ownerId: ownerA, type: 'START', resourceType: 'instance', idempotencyKey: 'duplicate-key' }),
    operations.create({ ownerId: ownerA, type: 'START', resourceType: 'instance', idempotencyKey: 'duplicate-key' }),
  ]);
  assert.equal(sameA.id, sameB.id);
  const other = await operations.create({ ownerId: ownerB, type: 'START', resourceType: 'instance', idempotencyKey: 'owner-b-key' });
  const eventResults = await Promise.allSettled([...Array(20)].map((_, index) => operations.appendEvent({ operationId: sameA.id, type: 'PROGRESS', payload: { index } })));
  assert.deepEqual(eventResults.map(result => result.status), Array(20).fill('fulfilled'));
  const events = eventResults.map(result => result.value);
  await operations.appendEvent({ operationId: other.id, type: 'PROGRESS', payload: { index: 'other' } });
  assert.deepEqual(events.map(event => event.sequence).sort((a, b) => a - b), [...Array(20)].map((_, index) => index + 1));
  const ownerEvents = await operations.listEventsForOwner(ownerA, 0);
  assert.equal(ownerEvents.length, 20);
  assert.deepEqual(ownerEvents.map(event => event.cursor), [...ownerEvents.map(event => event.cursor)].sort((a, b) => a - b));
  const resumed = await operations.listEventsForOwner(ownerA, ownerEvents[9].cursor);
  assert.deepEqual(resumed.map(event => event.cursor), ownerEvents.slice(10).map(event => event.cursor));

  const admission = new AdmissionService({ reservations: new ReservationRepository({ pool }) });
  const instanceA = '10000000-0000-0000-0000-000000000001'; const instanceB = '10000000-0000-0000-0000-000000000002';
  await pool.query('INSERT INTO sandlabx_lab_instances (id,capsule_version_id,owner_user_id,name) VALUES ($1,$2,$3,$4),($5,$2,$3,$6)', [instanceA, publishedVersion.id, ownerA, 'admission-a', instanceB, 'admission-b']);
  const host = { id: 'host-a', capabilities: ['kvm'], capacity: { vcpus: 2, memoryMiB: 2048, storageGiB: 20, consolePorts: 2 } };
  const plan = (instanceId) => ({ instanceId, resources: { vcpus: 2, memoryMiB: 2048, storageGiB: 10 }, interfaces: [{ tap: `tap-${instanceId}`, mac: `02:00:00:00:00:${instanceId.endsWith('1') ? '01' : '02'}` }], segments: [], consoles: [{ port: instanceId.endsWith('1') ? 5901 : 5902 }] });
  await admission.admit({ plan: plan(instanceA), host, requiredCapabilities: ['kvm'] });
  await assert.rejects(admission.admit({ plan: plan(instanceB), host, requiredCapabilities: ['kvm'] }), error => error.code === 'INSUFFICIENT_VCPU_CAPACITY');
  await admission.releaseForStoppedInstance(instanceA);
  await admission.admit({ plan: plan(instanceB), host, requiredCapabilities: ['kvm'] });
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM sandlabx_resource_reservations WHERE state='ACTIVE' AND instance_id=$1", [instanceB])).rows[0].count, 6);
});
