#!/usr/bin/env node
/**
 * Checks the demo database after (or during) a manual testing session.
 *
 *   node smoke-env/check-consistency.js            report on everything since the demo data was loaded
 *   node smoke-env/check-consistency.js --writes   also list every database write the session made
 *   node smoke-env/check-consistency.js --json     machine-readable output
 *
 * 1. Data rules that must always hold (money, jobs, users, verifications).
 * 2. Audit trail: every admin change made in the session has its audit-log row,
 *    and every audit row says who did it and from where.
 * 3. Writes: what each admin action wrote, read from MongoDB's own oplog, and
 *    whether the writes that belong together landed in one transaction.
 * 4. Backend errors logged since the backend started.
 *
 * Reads only. Works on the demo database that smoke-env/start.js runs, never
 * the live one. Exit code 1 when any rule fails.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { MongoClient, Timestamp } = require(path.join(ROOT, 'Backend/node_modules/mongodb'));
const DATA = path.join(__dirname, '.data');
const URI = 'mongodb://127.0.0.1:27037/?replicaSet=rssmoke';
const DB = 'smoke_kayod';
const BACKEND_APP_NAME = 'kayod-admin-demo';
const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');

const results = { rules: [], audit: [], writes: [], backendErrors: [] };
const fail = (bucket, name, detail) => results[bucket].push({ ok: false, name, detail });
const pass = (bucket, name, detail = '') => results[bucket].push({ ok: true, name, detail });
const idStr = (v) => (v == null ? '' : String(v));
const money = (n) => `₱${Number(n || 0).toLocaleString('en-PH')}`;

async function main() {
  const fixtures = JSON.parse(fs.readFileSync(path.join(DATA, 'fixture-ids.json'), 'utf8'));
  const since = new Date(fixtures.seededAt || 0);
  const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 3000 }).connect()
    .catch(() => { console.error('Cannot reach the demo database on 127.0.0.1:27037 — is `node smoke-env/start.js` running?'); process.exit(2); });
  const db = client.db(DB);
  const col = (n) => db.collection(n);
  const nameOf = new Map((await col('users').find({}, { projection: { name: 1 } }).toArray()).map((u) => [idStr(u._id), u.name]));
  const who = (id) => nameOf.get(idStr(id)) || idStr(id);

  // ── 1. Data rules ──────────────────────────────────────────────────────
  const wallets = await col('wallets').find().toArray();
  const badTotals = wallets.filter((w) => Math.abs((w.balance || 0) - ((w.availableBalance || 0) + (w.heldBalance || 0))) > 0.001);
  badTotals.length
    ? fail('rules', 'Wallet total = available + held', badTotals.map((w) => `${who(w.userId)}: balance ${money(w.balance)} ≠ ${money(w.availableBalance)} + ${money(w.heldBalance)}`).join('; '))
    : pass('rules', 'Wallet total = available + held', `${wallets.length} wallets`);
  const negative = wallets.filter((w) => ['balance', 'availableBalance', 'heldBalance'].some((k) => (w[k] || 0) < 0));
  negative.length ? fail('rules', 'No negative wallet amounts', negative.map((w) => who(w.userId)).join(', ')) : pass('rules', 'No negative wallet amounts');

  const heldTx = await col('transactions').aggregate([{ $match: { status: 'held' } }, { $group: { _id: '$fromUserId', sum: { $sum: '$amount' } } }]).toArray();
  const heldByUser = new Map(heldTx.map((h) => [idStr(h._id), h.sum]));
  const heldMismatch = wallets.filter((w) => Math.abs((w.heldBalance || 0) - (heldByUser.get(idStr(w.userId)) || 0)) > 0.001);
  heldMismatch.length
    ? fail('rules', 'Held money = held escrow transactions', heldMismatch.map((w) => `${who(w.userId)}: wallet holds ${money(w.heldBalance)}, transactions hold ${money(heldByUser.get(idStr(w.userId)))}`).join('; '))
    : pass('rules', 'Held money = held escrow transactions', `${heldTx.length} client(s) with money held`);

  const jobs = await col('jobs').find().toArray();
  const txById = new Map((await col('transactions').find().toArray()).map((t) => [idStr(t._id), t]));
  // Only before completion: a completed job keeps pointing at its payment after
  // completion captures it (status completed, release to the provider scheduled).
  const danglingHolds = jobs.filter((j) => j.status !== 'completed' && j.paymentDetails?.heldTransaction && txById.get(idStr(j.paymentDetails.heldTransaction))?.status !== 'held');
  danglingHolds.length
    ? fail('rules', "A job's held payment points at a held transaction", danglingHolds.map((j) => `"${j.title}" → ${txById.get(idStr(j.paymentDetails.heldTransaction))?.status || 'missing'}`).join('; '))
    : pass('rules', "A job's held payment points at a held transaction");
  const cancelledHolding = jobs.filter((j) => j.status === 'cancelled' && j.paymentDetails?.heldTransaction);
  cancelledHolding.length
    ? fail('rules', 'Cancelled jobs hold no payment', cancelledHolding.map((j) => `"${j.title}"`).join(', '))
    : pass('rules', 'Cancelled jobs hold no payment');

  const refundedHolds = [...txById.values()].filter((t) => t.status === 'refunded' && t.jobId);
  const missingRefund = refundedHolds.filter((t) => ![...txById.values()].some((r) => r.type === 'job_budget_refund' && idStr(r.jobId) === idStr(t.jobId) && r.amount === t.amount && idStr(r.toUserId) === idStr(t.fromUserId)));
  missingRefund.length
    ? fail('rules', 'Every refunded hold has its refund to the client', missingRefund.map((t) => `${money(t.amount)} for job ${idStr(t.jobId)}`).join('; '))
    : pass('rules', 'Every refunded hold has its refund to the client', `${refundedHolds.length} refunded hold(s)`);

  const archive = jobs.filter((j) => (j.isHidden && !j.hiddenAt) || (!j.isHidden && j.hiddenAt) || (j.isDeleted && !j.deletedAt) || (!j.isDeleted && j.deletedAt));
  archive.length ? fail('rules', 'Hidden/deleted flags match their dates', archive.map((j) => `"${j.title}"`).join(', ')) : pass('rules', 'Hidden/deleted flags match their dates');

  const users = await col('users').find({ userType: { $in: ['client', 'provider'] } }).toArray();
  const restriction = users.filter((u) => {
    const active = (u.accountStatus || 'active') === 'active';
    return active ? !!u.isRestricted || !!u.restrictionDetails?.type : !u.isRestricted || u.restrictionDetails?.type !== u.accountStatus;
  });
  restriction.length
    ? fail('rules', 'Account status, restricted flag and restriction details agree', restriction.map((u) => `${u.name}: status ${u.accountStatus}, isRestricted ${!!u.isRestricted}, details ${u.restrictionDetails?.type || 'none'}`).join('; '))
    : pass('rules', 'Account status, restricted flag and restriction details agree', `${users.length} users`);

  const reviewed = await col('credentialverifications').aggregate([
    { $sort: { submittedAt: -1 } },
    { $group: { _id: '$userId', latest: { $first: '$$ROOT' } } },
    { $match: { 'latest.reviewedAt': { $gte: since } } },
  ]).toArray();
  const userById = new Map(users.map((u) => [idStr(u._id), u]));
  const verifMismatch = reviewed.filter(({ _id, latest }) => {
    const u = userById.get(idStr(_id));
    if (!u) return true;
    return u.credentialVerificationStatus !== latest.status || (latest.status === 'approved') !== !!u.isVerified;
  });
  verifMismatch.length
    ? fail('rules', "A reviewed submission and its user's verified status agree", verifMismatch.map(({ _id, latest }) => { const u = userById.get(idStr(_id)); return `${who(_id)}: submission ${latest.status}, user ${u?.credentialVerificationStatus}/${u?.isVerified ? 'verified' : 'unverified'}`; }).join('; '))
    : pass('rules', "A reviewed submission and its user's verified status agree", `${reviewed.length} reviewed this session`);

  // ── 2. Audit trail ─────────────────────────────────────────────────────
  const logs = await col('activitylogs').find({ createdAt: { $gte: since } }).sort({ createdAt: 1 }).toArray();
  const has = (types, target) => logs.some((l) => [].concat(types).includes(l.actionType) && idStr(l.targetId) === idStr(target));
  const expected = [];
  for (const j of jobs) {
    if (j.hiddenAt >= since) expected.push([`Job hidden: "${j.title}"`, 'job_hidden', j._id]);
    if (j.deletedAt >= since) expected.push([`Job deleted: "${j.title}"`, 'job_deleted', j._id]);
    // An admin cancels through Cancel Job (force-cancel) or by ruling a dispute
    // for the client; each has its own audit action.
    if (j.cancellation?.cancelledAt >= since && j.cancellation?.cancelledBy && userById.get(idStr(j.cancellation.cancelledBy)) === undefined) {
      expected.push([`Job cancelled by an admin: "${j.title}"`, ['job_force_cancelled', 'dispute_resolved'], j._id]);
    }
  }
  for (const u of users) {
    const d = u.restrictionDetails;
    if (d?.restrictedAt >= since) {
      const type = { restricted: 'user_restricted', suspended: 'user_suspended', banned: 'user_banned', deleted: 'user_deleted' }[d.type];
      expected.push([`User ${d.type}: ${u.name}`, type, u._id]);
    }
  }
  for (const { _id, latest } of reviewed) {
    const type = { approved: 'verification_approved', rejected: 'verification_rejected', resubmission_requested: 'verification_resubmission_requested', flagged: 'verification_flagged' }[latest.status];
    if (type) expected.push([`Verification ${latest.status.replace('_', ' ')}: ${who(_id)}`, type, _id]);
  }
  for (const [label, type, target] of expected) {
    has(type, target) ? pass('audit', `${label} → logged`) : fail('audit', `${label} → logged`, `no ${[].concat(type).map((t) => `"${t}"`).join(' or ')} audit row for this change`);
  }
  const incomplete = logs.filter((l) => !l.adminId || !l.ipAddress || !l.userAgent);
  incomplete.length
    ? fail('audit', 'Every audit row records the admin, IP address and browser', incomplete.map((l) => `${l.actionType} at ${l.createdAt.toISOString()}`).join('; '))
    : pass('audit', 'Every audit row records the admin, IP address and browser', `${logs.length} rows this session`);

  // ── 3. Writes (oplog) ──────────────────────────────────────────────────
  const oplog = client.db('local').collection('oplog.rs');
  const sinceTs = new Timestamp({ t: Math.floor(since.getTime() / 1000), i: 0 });
  const entries = await oplog.find({ ts: { $gt: sinceTs }, $or: [{ ns: new RegExp(`^${DB}\\.`) }, { 'o.applyOps': { $exists: true } }] }).sort({ ts: 1 }).toArray();
  const flat = [];
  for (const e of entries) {
    if (e.wall <= since) continue; // the oplog query is to the second; the session starts mid-second
    if (e.o?.applyOps) {
      // A committed transaction is one applyOps entry. MongoDB also batches a
      // plain insertMany into applyOps, marked multiOpType 1: not a transaction.
      const txn = e.multiOpType === 1 ? null : `${e.lsid?.id?.toHexString?.() ?? idStr(e.lsid?.id)}:${e.txnNumber}`;
      for (const op of e.o.applyOps) if (op.ns?.startsWith(`${DB}.`)) flat.push({ at: e.wall, op: op.op, coll: op.ns.slice(DB.length + 1), txn, doc: op.o });
    } else if (['i', 'u', 'd'].includes(e.op)) {
      flat.push({ at: e.wall, op: e.op, coll: e.ns.slice(DB.length + 1), txn: null, doc: e.o });
    }
  }
  // An admin action = a burst of writes ending in its audit row.
  const SIDE = new Set(['activitylogs', 'notifications', 'chatsupports']);
  const bursts = [];
  for (const w of flat) {
    const last = bursts[bursts.length - 1];
    if (last && w.at - last.end < 1500 && !last.closed) { last.writes.push(w); last.end = w.at; }
    else bursts.push({ start: w.at, end: w.at, writes: [w] });
    const b = bursts[bursts.length - 1];
    if (w.coll === 'activitylogs' && w.op === 'i') { b.action = w.doc?.actionType; b.closed = true; }
  }
  for (const b of bursts) {
    const business = b.writes.filter((w) => !SIDE.has(w.coll));
    const txns = new Set(business.map((w) => w.txn));
    const atomic = business.length <= 1 || (txns.size === 1 && !txns.has(null));
    const summary = b.writes.map((w) => `${w.coll}(${{ i: 'insert', u: 'update', d: 'delete' }[w.op]}${w.txn ? ', in transaction' : ''})`).join(' · ');
    const label = `${b.start.toISOString().slice(11, 19)} ${b.action || 'no audit row'}`;
    const detail = `${business.length} record write(s)${business.length > 1 ? (atomic ? ', all in one transaction' : ', NOT in one transaction') : ''}: ${summary}`;
    atomic ? pass('writes', label, detail) : fail('writes', label, detail);
  }

  // ── 4. Backend errors since it started ─────────────────────────────────
  const logFile = path.join(DATA, 'logs', 'backend.log');
  if (fs.existsSync(logFile)) {
    const text = fs.readFileSync(logFile, 'utf8');
    const run = text.slice(text.lastIndexOf('=== backend started'));
    // Three formats reach this log: the central "[METHOD path] status message"
    // line, controllers' own "Error …" lines, and "❌ …" lines.
    const lines = run.split(/\r?\n/).filter((l) => /^\[(GET|POST|PATCH|PUT|DELETE) \/api\/[^\]]*\] \d{3} /.test(l) || /^(❌|Error\b)/.test(l));
    for (const l of lines) results.backendErrors.push({ ok: false, name: l.trim().slice(0, 200) });
  }

  await client.close();

  if (asJson) { console.log(JSON.stringify({ since, ...results }, null, 2)); return finish(); }
  const show = (title, rows, onlyFails = false) => {
    console.log(`\n${title}`);
    const list = onlyFails ? rows.filter((r) => !r.ok) : rows;
    if (!list.length) console.log('  (none)');
    for (const r of list) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`);
  };
  console.log(`Demo session since ${since.toLocaleString()}`);
  show('1. Data rules', results.rules);
  show('2. Audit trail', results.audit);
  show(`3. Writes by admin action${args.has('--writes') ? '' : ' (non-atomic only; --writes lists all)'}`, results.writes, !args.has('--writes'));
  console.log('\n4. Backend error log since the backend started');
  if (!results.backendErrors.length) console.log('  (none)');
  for (const e of results.backendErrors) console.log(`  ${e.name}`);
  finish();
}

function finish() {
  const failed = [...results.rules, ...results.audit, ...results.writes].filter((r) => !r.ok).length;
  if (!asJson) console.log(`\n${failed ? `${failed} problem(s) found` : 'No problems found'} · ${results.writes.length} admin action(s) checked`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(2); });
