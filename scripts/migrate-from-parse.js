#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Parse from 'parse/node.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAP_FILE = path.resolve(__dirname, '.parse-migration-map.json');

function log(section, message, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${section}] ${message}`, ...args);
}

function getArgFlag(name) {
  return process.argv.includes(name);
}

function getArgValue(name, def) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return def;
}

async function loadMap() {
  try {
    const buf = await fs.readFile(MAP_FILE, 'utf8');
    return JSON.parse(buf);
  } catch {
    return {
      users: {}, // legacyId -> newId
      assets: {},
      tickets: {},
      credentials: {},
      ticketComments: {},
      assetHistory: {},
    };
  }
}

async function saveMap(map) {
  await fs.mkdir(path.dirname(MAP_FILE), { recursive: true });
  await fs.writeFile(MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
}

async function connectParse() {
  const appId = process.env.PARSE_APP_ID;
  const jsKey = process.env.PARSE_JS_KEY;
  const masterKey = process.env.PARSE_MASTER_KEY;
  const serverURL = process.env.PARSE_SERVER_URL;
  if (!appId || !jsKey || !masterKey || !serverURL) {
    throw new Error('Missing PARSE_* envs (PARSE_APP_ID, PARSE_JS_KEY, PARSE_MASTER_KEY, PARSE_SERVER_URL)');
  }
  // Initialize with appId/js/masterKey
  Parse.initialize(appId, jsKey, masterKey);
  Parse.serverURL = serverURL;
  log('parse', `Initialized: ${serverURL}`);
}

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || undefined;
  if (!uri) throw new Error('Missing MONGODB_URI in env');
  await mongoose.connect(uri, { dbName });
  log('mongo', `Connected: ${mongoose.connection.name}`);
}

async function fetchAllFromParse(className, options = {}) {
  const { include = [], select = [], pageSize = 100 } = options;
  const ParseClass = Parse.Object.extend(className);
  const query = new Parse.Query(ParseClass);
  if (include && include.length) query.include(include);
  if (select && select.length) query.select(select);
  query.limit(pageSize);

  const all = [];
  let skip = 0;
  // Use skip-based pagination
  while (true) {
    query.skip(skip);
    const results = await query.find({ useMasterKey: true });
    if (!results.length) break;
    all.push(...results);
    skip += results.length;
    if (results.length < pageSize) break;
  }
  return all;
}

function ensureObjectId(value) {
  // Accept Mongo ObjectId string or ObjectId; return ObjectId
  return new mongoose.Types.ObjectId(String(value));
}

function getPointerId(ptr) {
  if (!ptr) return null;
  try {
    return typeof ptr.id === 'string' ? ptr.id : null;
  } catch {
    return null;
  }
}

async function upsertOneByLegacyId(collectionName, legacyId, doc, dryRun) {
  const col = mongoose.connection.collection(collectionName);
  if (dryRun) {
    return { _id: new mongoose.Types.ObjectId() };
  }
  const res = await col.updateOne(
    { legacyParseId: legacyId },
    { $setOnInsert: { ...doc, legacyParseId: legacyId } },
    { upsert: true }
  );
  if (res.upsertedId && res.upsertedId._id) {
    return { _id: res.upsertedId._id };
  }
  // On match, fetch existing _id
  const existing = await col.findOne({ legacyParseId: legacyId }, { projection: { _id: 1 } });
  return existing || null;
}

async function migrateUsers(map, { dryRun = false } = {}) {
  log('users', 'Fetching users from Parse...');
  const users = await fetchAllFromParse('_User');
  log('users', `Found ${users.length} users`);

  const col = 'users';
  let migrated = 0;
  for (const u of users) {
    const legacyId = u.id;
    if (map.users[legacyId]) {
      migrated++;
      continue;
    }
    const email = u.get('email') || '';
    const username = u.get('username') || email || '';
    const passwordHash = await bcrypt.hash(`TEMP_DISABLED_${legacyId}_${Date.now()}`, 8);
    const doc = {
      email,
      username,
      passwordHash,
      fullname: u.get('fullname') || '',
      role: u.get('role') || 'employee',
      department: u.get('department') || '',
      phone: u.get('phone') || '',
      emailVerified: !!u.get('emailVerified'),
      isActive: u.get('isActive') !== undefined ? !!u.get('isActive') : true,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      legacyParseId: legacyId,
      mustResetPassword: true,
    };
    const inserted = await upsertOneByLegacyId(col, legacyId, doc, dryRun);
    if (inserted && inserted._id) {
      map.users[legacyId] = String(inserted._id);
      migrated++;
      if (!dryRun) await saveMap(map);
    }
  }
  log('users', `Migrated ${migrated}/${users.length}`);
}

async function migrateAssets(map, { dryRun = false } = {}) {
  log('assets', 'Fetching assets from Parse...');
  const assets = await fetchAllFromParse('Asset', { include: ['createdBy', 'assignee'] });
  log('assets', `Found ${assets.length} assets`);
  const col = 'assets';
  let migrated = 0;
  for (const a of assets) {
    const legacyId = a.id;
    if (map.assets[legacyId]) {
      migrated++;
      continue;
    }
    const createdByLegacy = getPointerId(a.get('createdBy'));
    const assigneeLegacy = getPointerId(a.get('assignee'));
    const doc = {
      name: a.get('name') || '',
      categoryId: a.get('categoryId') || '',
      serialNumber: a.get('serialNumber') || '',
      status: a.get('status') || '',
      quantity: Number.isFinite(a.get('quantity')) ? a.get('quantity') : parseInt(a.get('quantity') || '0', 10),
      remark: a.get('remark') || '',
      createdByUserId: createdByLegacy && map.users[createdByLegacy] ? ensureObjectId(map.users[createdByLegacy]) : null,
      assigneeUserId: assigneeLegacy && map.users[assigneeLegacy] ? ensureObjectId(map.users[assigneeLegacy]) : null,
      handoverDate: a.get('handedoverdate') || null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      legacyParseId: legacyId,
    };
    const inserted = await upsertOneByLegacyId(col, legacyId, doc, dryRun);
    if (inserted && inserted._id) {
      map.assets[legacyId] = String(inserted._id);
      migrated++;
      if (!dryRun) await saveMap(map);
    }
  }
  log('assets', `Migrated ${migrated}/${assets.length}`);
}

async function migrateTickets(map, { dryRun = false } = {}) {
  log('tickets', 'Fetching tickets from Parse...');
  const tickets = await fetchAllFromParse('Ticket', { include: ['createdBy', 'assignedTo'] });
  log('tickets', `Found ${tickets.length} tickets`);
  const col = 'tickets';
  let migrated = 0;
  for (const t of tickets) {
    const legacyId = t.id;
    if (map.tickets[legacyId]) {
      migrated++;
      continue;
    }
    const createdByLegacy = getPointerId(t.get('createdBy'));
    const assignedToLegacy = getPointerId(t.get('assignedTo'));
    const doc = {
      title: t.get('title') || '',
      description: t.get('description') || '',
      category: t.get('category') || '',
      priority: t.get('priority') || '',
      status: t.get('status') || 'open',
      tags: Array.isArray(t.get('tags')) ? t.get('tags') : [],
      dueDate: t.get('dueDate') ? new Date(t.get('dueDate')) : null,
      resolution: t.get('resolution') || '',
      createdByUserId: createdByLegacy && map.users[createdByLegacy] ? ensureObjectId(map.users[createdByLegacy]) : null,
      assignedToUserId: assignedToLegacy && map.users[assignedToLegacy] ? ensureObjectId(map.users[assignedToLegacy]) : null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      legacyParseId: legacyId,
    };
    const inserted = await upsertOneByLegacyId(col, legacyId, doc, dryRun);
    if (inserted && inserted._id) {
      map.tickets[legacyId] = String(inserted._id);
      migrated++;
      if (!dryRun) await saveMap(map);
    }
  }
  log('tickets', `Migrated ${migrated}/${tickets.length}`);
}

async function migrateTicketComments(map, { dryRun = false } = {}) {
  log('comments', 'Fetching ticket comments from Parse...');
  const comments = await fetchAllFromParse('TicketComment', { include: ['ticket', 'createdBy'] });
  log('comments', `Found ${comments.length} comments`);
  const col = 'ticketcomments';
  let migrated = 0;
  for (const c of comments) {
    const legacyId = c.id;
    if (map.ticketComments[legacyId]) {
      migrated++;
      continue;
    }
    const ticketLegacy = getPointerId(c.get('ticket'));
    const userLegacy = getPointerId(c.get('createdBy'));
    const doc = {
      ticketId: ticketLegacy && map.tickets[ticketLegacy] ? ensureObjectId(map.tickets[ticketLegacy]) : null,
      createdByUserId: userLegacy && map.users[userLegacy] ? ensureObjectId(map.users[userLegacy]) : null,
      text: c.get('text') || '',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      legacyParseId: legacyId,
    };
    const inserted = await upsertOneByLegacyId(col, legacyId, doc, dryRun);
    if (inserted && inserted._id) {
      map.ticketComments[legacyId] = String(inserted._id);
      migrated++;
      if (!dryRun) await saveMap(map);
    }
  }
  log('comments', `Migrated ${migrated}/${comments.length}`);
}

async function migrateCredentials(map, { dryRun = false } = {}) {
  log('credentials', 'Fetching credentials from Parse...');
  const creds = await fetchAllFromParse('Credential', { include: ['createdBy'] });
  log('credentials', `Found ${creds.length} credentials`);
  const col = 'credentials';
  let migrated = 0;
  for (const cr of creds) {
    const legacyId = cr.id;
    if (map.credentials[legacyId]) {
      migrated++;
      continue;
    }
    const ownerLegacy = getPointerId(cr.get('createdBy'));
    const doc = {
      name: cr.get('name') || '',
      type: cr.get('type') || '',
      username: cr.get('username') || '',
      password: cr.get('password') || '',
      url: cr.get('url') || '',
      category: cr.get('category') || '',
      isEncrypted: !!cr.get('isEncrypted'),
      notes: cr.get('notes') || '',
      expiryDate: cr.get('expiryDate') ? new Date(cr.get('expiryDate')) : null,
      ownerUserId: ownerLegacy && map.users[ownerLegacy] ? ensureObjectId(map.users[ownerLegacy]) : null,
      createdAt: cr.createdAt,
      updatedAt: cr.updatedAt,
      legacyParseId: legacyId,
    };
    const inserted = await upsertOneByLegacyId(col, legacyId, doc, dryRun);
    if (inserted && inserted._id) {
      map.credentials[legacyId] = String(inserted._id);
      migrated++;
      if (!dryRun) await saveMap(map);
    }
  }
  log('credentials', `Migrated ${migrated}/${creds.length}`);
}

async function maybeMigrateAssetHistory(map, { dryRun = false } = {}) {
  // Optional class: AssetHistory
  try {
    log('assetHistory', 'Attempting to fetch AssetHistory from Parse...');
    const history = await fetchAllFromParse('AssetHistory', { include: ['asset', 'assignedTo'] });
    if (!history.length) {
      log('assetHistory', 'No AssetHistory found, skipping.');
      return;
    }
    const col = 'assethistory';
    let migrated = 0;
    for (const h of history) {
      const legacyId = h.id;
      if (map.assetHistory[legacyId]) {
        migrated++;
        continue;
      }
      const assetLegacy = getPointerId(h.get('asset'));
      const assignedLegacy = getPointerId(h.get('assignedTo'));
      const doc = {
        assetId: assetLegacy && map.assets[assetLegacy] ? ensureObjectId(map.assets[assetLegacy]) : null,
        assignedToUserId: assignedLegacy && map.users[assignedLegacy] ? ensureObjectId(map.users[assignedLegacy]) : null,
        statusChange: !!h.get('statusChange'),
        previousUserIdLegacy: getPointerId(h.get('previousUser')), // legacy pointer, may be null
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
        legacyParseId: legacyId,
      };
      const inserted = await upsertOneByLegacyId(col, legacyId, doc, dryRun);
      if (inserted && inserted._id) {
        map.assetHistory[legacyId] = String(inserted._id);
        migrated++;
        if (!dryRun) await saveMap(map);
      }
    }
    log('assetHistory', `Migrated ${migrated}/${history.length}`);
  } catch (e) {
    log('assetHistory', `Skipping (class not present or error): ${e.message}`);
  }
}

async function main() {
  const dryRun = getArgFlag('--dry-run');
  const only = getArgValue('--only', '');
  const steps = (only ? only.split(',') : ['users', 'assets', 'tickets', 'ticketComments', 'credentials', 'assetHistory'])
    .map(s => s.trim())
    .filter(Boolean);

  await connectParse();
  await connectMongo();
  // For dry-run, use an in-memory map and do not persist any changes
  const map = dryRun
    ? {
        users: {},
        assets: {},
        tickets: {},
        credentials: {},
        ticketComments: {},
        assetHistory: {},
      }
    : await loadMap();
  log('main', `Starting migration dryRun=${dryRun} steps=${steps.join(',')}`);

  if (steps.includes('users')) {
    await migrateUsers(map, { dryRun });
  }
  if (steps.includes('assets')) {
    await migrateAssets(map, { dryRun });
  }
  if (steps.includes('tickets')) {
    await migrateTickets(map, { dryRun });
  }
  if (steps.includes('ticketComments')) {
    await migrateTicketComments(map, { dryRun });
  }
  if (steps.includes('credentials')) {
    await migrateCredentials(map, { dryRun });
  }
  if (steps.includes('assetHistory')) {
    await maybeMigrateAssetHistory(map, { dryRun });
  }

  if (!dryRun) {
    await saveMap(map);
  }
  log('main', 'Done.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});


