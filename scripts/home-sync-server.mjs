import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer as createTlsServer } from 'node:https';
import { createSecureContext } from 'node:tls';
import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mergeHomeState, homeValuesEqual } from '../src/utils/homeSyncMerge.js';

const run = promisify(execFile);
const prefix = '/api/home-sync/';
const origin = 'http://127.0.0.1:4175';
const maxRequestBytes = 32 * 1024 * 1024;
const mobilePort = 4176;
const digest = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');

function jsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function atomicJson(path, value) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  const fd = openSync(temporary, 'wx', 0o600);
  try {
    try {
      writeFileSync(fd, JSON.stringify(value));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function validState(state) {
  const record = item => item !== null && typeof item === 'object' && !Array.isArray(item);
  const collection = list => Array.isArray(list) && list.every(item => record(item) && typeof item.id === 'string' && item.id.length > 0)
    && new Set(list.map(item => item.id)).size === list.length;
  if (!record(state) || !['exercises', 'templates', 'workouts', 'maxStrengthRecords'].every(key => collection(state[key]))) return false;
  if (!state.templates.every(template => Array.isArray(template.exerciseTemplates)
    && template.exerciseTemplates.every(item => record(item) && typeof item.exerciseId === 'string'))) return false;
  return state.workouts.every(workout => collection(workout.exercises)
    && workout.exercises.every(entry => collection(entry.sets) && (entry.notes === undefined || collection(entry.notes))));
}

function rotateCopies(folder, pattern, keep) {
  const names = readdirSync(folder).filter(name => pattern.test(name)).sort();
  names.slice(0, Math.max(0, names.length - keep)).forEach(name => unlinkSync(join(folder, name)));
}

function backupPrevious(folder, file, revision) {
  const copies = join(folder, 'recovery');
  mkdirSync(copies, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const daily = join(copies, 'day-' + day + '.json');
  if (!existsSync(daily)) copyFileSync(file, daily);
  copyFileSync(file, join(copies, 'rev-' + String(revision).padStart(12, '0') + '.json'));
  rotateCopies(copies, /^day-\d{4}-\d{2}-\d{2}\.json$/, 14);
  rotateCopies(copies, /^rev-\d{12}\.json$/, 12);
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(data === undefined ? undefined : JSON.stringify(data));
}

async function body(req, limit) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Object.assign(new Error(), { status: 415 });
  if (Number(req.headers['content-length']) > limit) throw Object.assign(new Error(), { status: 413 });
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > limit) throw Object.assign(new Error(), { status: 413 });
    parts.push(part);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'), (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error();
      return value;
    });
  }
  catch { throw Object.assign(new Error(), { status: 400 }); }
}

// All mutations, including revision checks and the atomic rename, run without yielding.
export function createSyncApi(folder, peerInfo) {
  mkdirSync(folder, { recursive: true });
  const identityFile = join(folder, 'devices.json');
  const stateFile = join(folder, 'state.json');
  if (!existsSync(identityFile)) {
    if (existsSync(stateFile)) throw new Error('Gerätekennung zur vorhandenen Datenbank fehlt.');
    atomicJson(identityFile, { serverId: randomUUID(), tokens: [] });
  }
  const identity = jsonFile(identityFile);
  if (!/^[a-f0-9-]{36}$/.test(identity.serverId) || !Array.isArray(identity.tokens)
    || !identity.tokens.every(hash => /^[a-f0-9]{64}$/.test(hash))) throw new Error('Gerätekennung beschädigt.');
  const { serverId } = identity;
  let saved = existsSync(stateFile) ? jsonFile(stateFile) : { serverId, revision: 0, state: null };
  if (saved.serverId !== serverId || !Number.isSafeInteger(saved.revision)
    || (saved.revision === 0 ? saved.state !== null : saved.revision < 1 || !validState(saved.state))) throw new Error('Lokaler Abgleichstand beschädigt.');
  let pairing;
  function commit(updated, receipt) {
    const changed = !homeValuesEqual(updated, saved.state);
    if (!changed && !receipt) return;
    const next = { serverId, revision: saved.revision + Number(changed), state: updated };
    // Allow the Android client to read every state that this server can persist.
    if (Buffer.byteLength(JSON.stringify(next)) > maxRequestBytes) throw Object.assign(new Error(), { status: 413 });
    if (saved.receipts) next.receipts = saved.receipts;
    if (receipt) {
      const recent = next.receipts?.[receipt.device] ?? [];
      const confirmed = { hash: receipt.hash, localHash: receipt.localHash, revision: next.revision };
      next.receipts = { ...next.receipts, [receipt.device]: [...recent.slice(-31), confirmed] };
    }
    if (changed && saved.revision) backupPrevious(folder, stateFile, saved.revision);
    atomicJson(stateFile, next);
    saved = next;
  }
  async function handle(req, res, remote = false) {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith(prefix)) { send(res, 404, { error: 'not_found' }); return; }
    if (remote) {
      if (req.headers.origin !== undefined) { send(res, 403, { error: 'forbidden' }); return; }
    } else if (req.headers.host !== '127.0.0.1:4175' || req.headers['x-hardgain-sync'] !== '1'
        || (req.headers.origin !== undefined && req.headers.origin !== origin)) {
      send(res, 403, { error: 'forbidden' }); return;
    }
    if (!remote && req.method === 'POST' && path === prefix + 'pairing') {
      const info = peerInfo();
      if (!info) { send(res, 503, { error: 'private_network_unavailable' }); return; }
      const code = secret();
      const expiresAt = Date.now() + 10 * 60_000;
      pairing = { hash: digest(code), expiresAt };
      const query = new URLSearchParams({ host: info.host, port: String(mobilePort), pin: info.pin, code, name: hostname() });
      send(res, 200, { link: 'hardgainwaf://pair?' + query, expiresAt: new Date(expiresAt).toISOString() });
      return;
    }
    if (remote && req.method === 'POST' && path === prefix + 'pair') {
      const input = await body(req, 4096);
      if (!pairing || Date.now() >= pairing.expiresAt || typeof input?.code !== 'string' || digest(input.code) !== pairing.hash) {
        send(res, 403, { error: 'invalid_pairing' }); return;
      }
      const token = secret();
      const tokens = [...identity.tokens, digest(token)];
      atomicJson(identityFile, { serverId, tokens });
      identity.tokens = tokens;
      pairing = null;
      send(res, 200, { serverId, token });
      return;
    }
    if (remote) {
      const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '');
      if (!bearer || !identity.tokens.includes(digest(bearer[1]))) { send(res, 401, { error: 'unauthorized' }); return; }
    }
    if (path === prefix + 'reconcile' && req.method === 'POST') {
      const input = await body(req, 2 * maxRequestBytes + 4096);
      if (!Number.isSafeInteger(input?.baseRevision) || input.baseRevision < 0
        || !(input.baseRevision === 0 ? input.baseState === null : validState(input.baseState))
        || !validState(input.localState)) { send(res, 400, { error: 'invalid_state' }); return; }
      const device = remote ? digest(req.headers.authorization) : 'pc';
      const receipts = saved.receipts?.[device] ?? [];
      if (input.serverId !== serverId || input.baseRevision > saved.revision) {
        send(res, 409, { error: 'revision_conflict', serverId, revision: saved.revision }); return;
      }
      if (input.baseRevision === saved.revision && !homeValuesEqual(input.baseState, saved.state)) {
        // A background receipt acknowledges the phone's projection before PC-only edits have arrived there.
        const baseHash = digest(JSON.stringify(input.baseState));
        if (!receipts.some(item => item.revision === input.baseRevision && item.localHash === baseHash)) {
          send(res, 409, { error: 'revision_conflict', serverId, revision: saved.revision }); return;
        }
      }
      // Retrying after a lost acknowledgement must not resurrect records later deleted on the PC.
      const hash = digest(JSON.stringify([input.baseRevision, input.baseState, input.localState]));
      const receipt = receipts.find(item => item.hash === hash);
      if (receipt) { send(res, 200, { serverId, revision: receipt.revision }); return; }
      const result = mergeHomeState(input.baseState, input.localState, saved.state);
      if (result.conflicts.length) { send(res, 409, { error: 'merge_conflict', serverId, revision: saved.revision }); return; }
      if (!validState(result.state)) { send(res, 400, { error: 'invalid_state' }); return; }
      commit(result.state, { device, hash, localHash: digest(JSON.stringify(input.localState)) });
      send(res, 200, { serverId, revision: saved.revision });
      return;
    }
    if (path !== prefix + 'state') { send(res, 404, { error: 'not_found' }); return; }
    if (req.method === 'GET') {
      const headers = { ETag: '"' + saved.revision + '"' };
      if (req.headers['if-none-match'] === headers.ETag) send(res, 304, undefined, headers);
      else send(res, 200, { serverId, revision: saved.revision, state: saved.state }, headers);
      return;
    }
    if (req.method !== 'PUT') { send(res, 405, { error: 'method' }, { Allow: 'GET, PUT' }); return; }
    const input = await body(req, maxRequestBytes);
    if (!Number.isSafeInteger(input?.revision) || input.revision < 0 || !validState(input.state)) {
      send(res, 400, { error: 'invalid_state' }); return;
    }
    if (input.revision !== saved.revision || (input.serverId !== undefined && input.serverId !== serverId)) {
      send(res, 409, { error: 'revision_conflict', serverId, revision: saved.revision }); return;
    }
    commit(input.state);
    send(res, 200, { serverId, revision: saved.revision });
  }
  return (req, res, remote) => {
    void handle(req, res, remote).catch(error => {
      if (!res.destroyed && !res.headersSent) send(res, error.status ?? 503, { error: error.status ? 'invalid_request' : 'storage_unavailable' });
    });
  };
}

const privateV4 = ip => /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(ip);
function addressNumber(ip) {
  return ip.split('.').reduce((n, octet) => ((n << 8) | Number(octet)) >>> 0, 0);
}

// Windows network categories can change when the user moves between networks.
async function privateInterfaces() {
  const script = "$ErrorActionPreference='Stop'; $ids=@(Get-NetConnectionProfile | Where-Object NetworkCategory -eq 'Private' | ForEach-Object InterfaceIndex); Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred | Where-Object { $ids -contains $_.InterfaceIndex } | ForEach-Object IPAddress";
  const shell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = await run(shell, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 12000 });
  const approved = new Set(stdout.trim().split(/\s+/));
  return Object.values(networkInterfaces()).flat().filter(n => n.family === 'IPv4' && !n.internal && privateV4(n.address) && approved.has(n.address));
}

export function startHomeSync(folder) {
  const configPath = join(folder, 'tls.json');
  if (!existsSync(configPath)) return null;
  const config = jsonFile(configPath);
  const pfx = Buffer.from(config.pfx, 'base64');
  const tlsOptions = { pfx, passphrase: config.passphrase, minVersion: 'TLSv1.2' };
  createSecureContext(tlsOptions);
  if (!/^[a-f0-9]{64}$/i.test(config.pin)) throw new Error('Lokaler Zertifikatsfingerabdruck ungültig.');
  const listeners = new Map();
  let closed = false;
  let refreshing = false;
  const api = createSyncApi(folder, () => {
    const host = [...listeners].find(([, server]) => server.listening)?.[0];
    return host ? { host, pin: config.pin } : null;
  });
  async function refresh() {
    if (refreshing || closed) return;
    refreshing = true;
    let networks = [];
    try { networks = await privateInterfaces(); } catch { /* Fail closed on unknown network category. */ }
    try {
      if (closed) return;
      const byAddress = new Map(networks.map(net => [net.address, net]));
      for (const [host, server] of listeners) {
        if (!byAddress.has(host)) { listeners.delete(host); server.close(); server.closeAllConnections(); }
      }
      for (const [host, net] of byAddress) {
        if (listeners.has(host)) continue;
        const server = createTlsServer({ ...tlsOptions, requestTimeout: 30000, headersTimeout: 15000 }, (req, res) => {
          const peer = req.socket.remoteAddress ?? '';
          const mask = addressNumber(net.netmask);
          if (!privateV4(peer) || (addressNumber(peer) & mask) !== (addressNumber(host) & mask)) {
            send(res, 403, { error: 'local_subnet_only' }); return;
          }
          api(req, res, true);
        });
        listeners.set(host, server);
        server.on('error', () => {
          if (listeners.get(host) === server) listeners.delete(host);
          server.close();
        });
        server.listen(mobilePort, host);
      }
    } finally { refreshing = false; }
  }
  void refresh();
  const timer = setInterval(refresh, 30000);
  timer.unref();
  return { api, close() {
    closed = true;
    clearInterval(timer);
    for (const server of listeners.values()) { server.close(); server.closeAllConnections(); }
  } };
}
