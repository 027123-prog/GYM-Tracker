import { normalizeAppState } from './storage.js';

const missing = Symbol('missing');
const collectionKeys = new Map([
  ['workouts', 'id'], ['exercises', 'id'], ['templates', 'id'], ['maxStrengthRecords', 'id'],
  ['sets', 'id'], ['notes', 'id'], ['machineSettings', 'id'], ['exerciseTemplates', 'exerciseId'],
]);
const fieldNames = new Map(Object.entries({
  name: 'Name', sets: 'Sätze', reps: 'Wiederholungen', weight: 'Gewicht', comment: 'Kommentar',
  durationSeconds: 'Haltedauer', repScheme: 'Satzvorgabe', targetRepScheme: 'Satzvorgabe',
  setupNotes: 'Geräteeinstellung', exercises: 'Übungen', exerciseTemplates: 'Planübungen',
  workouts: 'Trainings', templates: 'Vorlagen', maxStrengthRecords: 'Kraftwerte', notes: 'Notizen',
  goal: 'Trainingsziel', amounts: 'Satzziele', load: 'Arbeitsgewicht', confirmed: 'Reserve',
  date: 'Datum', skipped: 'Übersprungen', settings: 'Einstellungen', archivedAt: 'Archivierung',
  completedAt: 'Abschluss', value: 'Wert', order: 'Reihenfolge',
}));

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keys(record) {
  return Object.keys(record).filter(key => record[key] !== undefined);
}

function at(record, key) {
  return isRecord(record) && Object.hasOwn(record, key) && record[key] !== undefined ? record[key] : missing;
}

// Object property insertion order and omitted JSON fields carry no training meaning.
export function sameHomeValue(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameHomeValue(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const fields = keys(left);
  return fields.length === keys(right).length && fields.every(key => sameHomeValue(left[key], at(right, key)));
}

export { sameHomeValue as homeValuesEqual };

let factory;
function factoryState() {
  factory ??= normalizeAppState();
  return factory;
}

export function isFactoryHomeState(state) {
  if (!isRecord(state)) return false;
  const seed = factoryState();
  const { meta, maxStrengthRecords, ...data } = state;
  const { meta: seedMeta, maxStrengthRecords: seedStrength, ...seedData } = seed;
  // Only known bookkeeping fields may differ on an otherwise untouched installation.
  if (isRecord(meta) && keys(meta).some(key => !Object.hasOwn(seedMeta, key))) return false;
  return sameHomeValue(data, seedData) && Array.isArray(maxStrengthRecords)
    && (!maxStrengthRecords.length || sameHomeValue(maxStrengthRecords, seedStrength));
}

function indexed(items, key) {
  const result = new Map();
  for (const item of items) {
    if (!isRecord(item) || typeof item[key] !== 'string' || !item[key] || result.has(item[key])) return null;
    result.set(item[key], item);
  }
  return result;
}

// Divide each list at the shared IDs. This keeps unique items near their neighbours
// even when the other device has inserted or removed items in the same list.
function insertionGaps(ids, shared) {
  const result = new Map();
  let run = [];
  for (const id of ids) {
    if (shared.has(id)) {
      result.set(id, run);
      run = [];
    } else run.push(id);
  }
  result.set(null, run);
  return result;
}

function chronologicalInsertions(local, remote, records, collection) {
  const timeField = collection === 'workouts' ? 'date' : ['sets', 'notes'].includes(collection) ? 'savedAt' : null;
  if (!timeField || !local.length || !remote.length) return [...local, ...remote];
  const merged = [];
  let l = 0;
  let r = 0;
  while (l < local.length && r < remote.length) {
    const left = Date.parse(records.get(local[l])[timeField]);
    const right = Date.parse(records.get(remote[r])[timeField]);
    const diff = collection === 'workouts' ? right - left : left - right;
    if (diff < 0 || (!Number.isFinite(diff) || diff === 0) && local[l] < remote[r]) merged.push(local[l++]);
    else merged.push(remote[r++]);
  }
  return merged.concat(local.slice(l), remote.slice(r));
}

function itemLabel(collection, item, index) {
  if (item.name || item.exerciseName || item.label) return String(item.name || item.exerciseName || item.label).slice(0, 60);
  if (collection === 'sets') return `Satz ${index + 1}`;
  if (collection === 'notes') return `Notiz ${index + 1}`;
  return fieldNames.get(collection) ?? collection;
}

function preview(value) {
  if (value === missing) return 'Gelöscht';
  if (value === null) return 'Leer';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'string' || typeof item === 'number')) return value.join(' · ').slice(0, 80) || 'Leer';
    return value.length + ' Einträge';
  }
  if (isRecord(value)) return String(value.name || value.comment || 'Eintrag behalten').slice(0, 80);
  return String(value).slice(0, 80);
}

export function mergeHomeState(base, local, remote, { prefer = 'local' } = {}) {
  const conflicts = [];
  if (remote === null || remote === undefined) return { state: local, conflicts };
  if (base == null && isFactoryHomeState(local)) return { state: remote, conflicts };
  if (base == null && isFactoryHomeState(remote)) return { state: local, conflicts };

  function conflict(path, labels, l, r, localPreview = preview(l), remotePreview = preview(r)) {
    conflicts.push({ path, label: labels.join(' · '), localPreview, remotePreview });
    return prefer === 'remote' ? r : l;
  }

  function mergeCollection(b, l, r, path, labels, key, seed) {
    const collection = path.at(-1);
    const baseline = indexed(b === missing ? [] : b, key);
    const left = indexed(l, key);
    const right = indexed(r, key);
    if (!baseline || !left || !right) return conflict(path, labels, l, r);
    const defaults = Array.isArray(seed) ? indexed(seed, key) : null;
    const merged = new Map();
    const positions = new Map(l.map((item, index) => [item[key], index]));
    r.forEach((item, index) => { if (!positions.has(item[key])) positions.set(item[key], index); });
    for (const id of positions.keys()) {
      const a = left.get(id) ?? missing;
      const z = right.get(id) ?? missing;
      const item = a === missing ? z : a;
      if (b === missing && defaults?.has(id) && (a === missing || z === missing)
        && sameHomeValue(item, defaults.get(id))) continue;
      const name = itemLabel(collection, item, positions.get(id));
      const value = merge(baseline.get(id) ?? missing, a, z, [...path, id], [...labels.slice(0, -1), name], defaults?.get(id));
      if (value !== missing) merged.set(id, value);
    }
    const lIds = [...left.keys()].filter(id => merged.has(id));
    const rIds = [...right.keys()].filter(id => merged.has(id));
    const lOrder = lIds.filter(id => right.has(id));
    const shared = new Set(lOrder);
    const rOrder = rIds.filter(id => shared.has(id));
    let order = lOrder;
    if (!sameHomeValue(lOrder, rOrder)) {
      const originalOrder = b === missing && defaults ? defaults : baseline;
      const ancestry = [...originalOrder.keys()].filter(id => shared.has(id));
      const commonL = lOrder.filter(id => originalOrder.has(id));
      const commonR = rOrder.filter(id => originalOrder.has(id));
      const localReordered = !sameHomeValue(commonL, ancestry);
      const remoteReordered = !sameHomeValue(commonR, ancestry);
      if (remoteReordered && !localReordered) order = rOrder;
      else if (!localReordered || remoteReordered) {
        const describeOrder = ids => preview(ids.slice(0, 6).map(id => merged.get(id).name || id));
        order = conflict([...path, '$order'], [...labels, 'Reihenfolge'], lOrder, rOrder, describeOrder(lOrder), describeOrder(rOrder));
      }
    }
    const leftGaps = insertionGaps(lIds, shared);
    const rightGaps = insertionGaps(rIds, shared);
    const result = [];
    for (const anchor of [...order, null]) {
      const gap = chronologicalInsertions(leftGaps.get(anchor), rightGaps.get(anchor), merged, collection);
      for (const id of gap) result.push(merged.get(id));
      if (anchor !== null) result.push(merged.get(anchor));
    }
    return result;
  }

  function merge(b, l, r, path, labels, seed) {
    if (sameHomeValue(l, r)) return l;
    if (sameHomeValue(l, b)) return r;
    if (sameHomeValue(r, b)) return l;
    if (l === missing || r === missing) return conflict(path, labels, l, r);
    // On first contact known factory fields can distinguish a customized plan
    // from the shipped placeholder. Unknown IDs on either device always survive.
    if (base == null && seed !== undefined) {
      if (sameHomeValue(l, seed)) return r;
      if (sameHomeValue(r, seed)) return l;
    }
    const field = path.at(-1);
    if (Array.isArray(l) && Array.isArray(r) && (Array.isArray(b) || b === missing)) {
      if (field === 'weightOptions') {
        const old = new Set(b === missing ? [] : b);
        const a = new Set(l), z = new Set(r);
        return [...new Set([...l, ...r])].filter(value => !old.has(value) || (a.has(value) && z.has(value))).sort((x, y) => x - y);
      }
      if (collectionKeys.has(field)) return mergeCollection(b, l, r, path, labels, collectionKeys.get(field), seed);
    }
    if (isRecord(l) && isRecord(r) && (isRecord(b) || b === missing)) {
      const entries = [];
      for (const k of new Set([...keys(l), ...keys(r)])) {
        const seedValue = at(seed, k);
        const value = merge(at(b, k), at(l, k), at(r, k), [...path, k], [...labels, fieldNames.get(k) ?? k],
          seedValue === missing ? undefined : seedValue);
        if (value !== missing) entries.push([k, value]);
      }
      return Object.fromEntries(entries);
    }
    if (['updatedAt', 'lastSyncAt', 'draftStartedAt'].includes(field)
      && typeof l === 'string' && typeof r === 'string' && Number.isFinite(Date.parse(l)) && Number.isFinite(Date.parse(r))) {
      const takeLocal = field === 'draftStartedAt' ? Date.parse(l) <= Date.parse(r) : Date.parse(l) >= Date.parse(r);
      return takeLocal ? l : r;
    }
    return conflict(path, labels, l, r);
  }

  return { state: merge(base ?? missing, local, remote, [], [], base == null ? factoryState() : undefined), conflicts };
}
