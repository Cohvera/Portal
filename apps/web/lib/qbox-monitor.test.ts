import assert from 'node:assert/strict';
import {test} from 'node:test';
import {connectionDiagnostics,eventExplanation,eventLink,type Monitor,type ReaderEvent} from './qbox-monitor';

const now = Date.parse('2026-11-24T10:00:00Z');
const time = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();
const event = (phase: string, diagnostic?: ReaderEvent['diagnostic'], secondsAgo = 10): ReaderEvent => ({
 id:phase, runId:'attempt', phase, diagnostic, observedAt:time(secondsAgo), receivedAt:time(secondsAgo),
 readerVersion:'3.10', recordCount:null, httpStatus:null,
});
const monitor = (events: ReaderEvent[], pollAt = time(20)): Monitor => ({
 configuration:{commandPollAt:pollAt,syncRequestId:null,syncAcknowledgedId:null,syncRequestedAt:null,
  projectFilter:null,availableStatuses:null,revision:0,appliedRevision:null,selectedColumns:[],schemaColumns:[],schemaReportedAt:null,readerVersion:null},
 state:'error',lastContactAt:time(10),lastImport:null,events,expectedIntervalMinutes:15,columns:[],extraColumns:[],columnSelectionEnabled:true,exportSchemaVersion:3,
});

test('HFSQL no-route error does not mark Portal command polling offline', () => {
 const hfsql = event('configuration_failed', {step:'hfsql_statuses',errno:113});
 const result = connectionDiagnostics(monitor([hfsql]),now);
 assert.equal(result.pollState,'healthy');
 assert.equal(result.hfsqlState,'error');
 assert.equal(eventLink(hfsql),'hfsql');
 assert.match(eventExplanation(hfsql),/onbereikbaar/);
});

test('upload failure and recovered command polling remain distinct from HFSQL', () => {
 const failedPoll = {...event('command_poll_failed', {step:'command_poll'}, 30),httpStatus:503};
 const failedUpload = {...event('upload_failed', {step:'portal_upload'}),httpStatus:500};
 const result = connectionDiagnostics(monitor([failedUpload,failedPoll]),now);
 assert.equal(result.pollState,'healthy');
 assert.equal(result.hfsqlState,'healthy');
 assert.equal(result.upload,failedUpload);
 assert.match(eventExplanation(failedUpload),/API-log/);
 assert.equal(connectionDiagnostics(monitor([failedPoll],time(40)),now).pollState,'error');
});

test('portal configuration failure preserves a successful HFSQL status read', () => {
 const configFailure = {...event('configuration_failed', {step:'portal_configuration'}),httpStatus:401};
 assert.equal(eventLink(configFailure),'portal');
 assert.equal(connectionDiagnostics(monitor([configFailure]),now).hfsqlState,'healthy');
 assert.equal(connectionDiagnostics(monitor([event('success', null, 3600)],time(180)),now).hfsqlState,'stale');
});
