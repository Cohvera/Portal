import assert from 'node:assert/strict';
import {test} from 'node:test';
import {connectionDiagnostics,eventExplanation,eventLink,type Monitor,type ReaderEvent} from './qbox-monitor';
import {eventRemedy} from './qbox-recovery';

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

test('connection-file permission recovery explains how to configure as loxberry', () => {
 const failure = event('journal_error', {step:'journal_sync',errno:13});
 const steps = eventRemedy(failure);
 assert.ok(steps);
 assert.match(steps[1].text,/map van loxberry.*connection\.json van root/);
 assert.match(steps[2].text,/als loxberry, zonder sudo/);
 assert.ok(steps[2].command?.startsWith('./plenion.sh configure\n'));
 const exportFailure = event('read_failed', {step:'export_file',errno:13});
 assert.ok(eventRemedy(exportFailure)?.every(step => !step.command?.includes('configure')));
});

test('remedies use the failing connection and skip successful attempts', () => {
 const routeError = event('read_failed', {step:'hfsql_export',errno:113});
 assert.match(eventRemedy(routeError)?.[0].command ?? '', /nc.*HFSQL_IP/);
 const uploadError = {...event('upload_failed',{step:'portal_upload'}),httpStatus:500};
 assert.match(eventRemedy(uploadError)?.[0].command ?? '', /docker compose logs/);
 assert.equal(eventRemedy(event('success')),undefined);
});

test('network, authentication, driver and schema errors have distinct steps', () => {
 const fixes = (diagnostic:ReaderEvent['diagnostic']) => JSON.stringify(eventRemedy(event('read_failed',diagnostic)));
 assert.match(fixes({step:'hfsql_export',errno:113}),/ip neigh/);
 assert.match(fixes({step:'hfsql_export',errno:111}),/HFSQL-service/);
 assert.match(fixes({step:'hfsql_export',sqlState:'28000'}),/Control Center/);
 assert.match(fixes({step:'hfsql_export',sqlState:'IM003'}),/plenion.sh check/);
 assert.match(fixes({step:'hfsql_export',sqlState:'42S22'}),/plenion.sh columns/);
 assert.match(fixes({step:'hfsql_statuses',reason:'invalid_status_catalog'}),/PRS-regels in WERK/);
});

test('Portal errors distinguish keys, proxy, upload limits and rejected data', () => {
 const fixes = (httpStatus:number) => JSON.stringify(eventRemedy({...event('upload_failed',{step:'portal_upload'}),httpStatus}));
 assert.match(fixes(401),/upload-config/);
 assert.doesNotMatch(fixes(403),/upload-config/);
 assert.match(fixes(404),/Caddy/);
 assert.match(fixes(413),/uploadlimiet/);
 assert.match(fixes(504),/transactietime-out/);
 const portalJson = event('configuration_failed',{step:'portal_configuration',reason:'JSONDecodeError'});
 const localJson = event('read_failed',{step:'export_file',reason:'JSONDecodeError'});
 assert.match(JSON.stringify(eventRemedy(portalJson)),/route JSON/);
 assert.match(JSON.stringify(eventRemedy(localJson)),/lokaal JSON-bestand/);
});
