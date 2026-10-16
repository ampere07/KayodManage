#!/usr/bin/env node
/**
 * Where the time actually goes on the admin list routes.
 *
 * READ-ONLY. Connects to the live database, runs the same queries the list
 * endpoints run, and times each stage separately, because "the transactions
 * page feels slow" can mean the query, the population, the count, the
 * serialisation, or the number of round trips — and the fix is different for
 * each. Measure first; the answer at this data size is not the obvious one.
 *
 *   node tools/listRouteBenchmark.js [--limit=20] [--runs=5]
 */

require('dotenv').config();
const mongoose = require('mongoose');

const flag = (name, fallback) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const PAGE_SIZE = flag('limit', 20);
const RUNS = flag('runs', 5);

/** Median of repeated runs — a single timing against a network database is noise. */
const time = async (label, fn) => {
  const samples = [];
  let last;
  for (let i = 0; i < RUNS; i += 1) {
    const started = process.hrtime.bigint();
    last = await fn();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  return { label, median, result: last };
};

const row = (label, ms, note = '') =>
  console.log(`  ${label.padEnd(46)} ${`${ms.toFixed(1)} ms`.padStart(9)}  ${note}`);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'test',
    serverSelectionTimeoutMS: 30000,
  });
  console.log(`Connected to "${mongoose.connection.name}" — read-only benchmark`);
  console.log(`page size ${PAGE_SIZE}, median of ${RUNS} runs\n`);

  // User must be registered before any populate() that references it.
  require('../app/models/User');
  const Transaction = require('../app/models/Transaction');
  const total = await Transaction.estimatedDocumentCount();
  const deepSkip = Math.max(0, total - PAGE_SIZE);

  const POPULATE = [
    { path: 'fromUserId', select: 'name email userType profileImage' },
    { path: 'toUserId', select: 'name email userType profileImage' },
  ];

  console.log(`── Transactions list (${total} documents) ${'─'.repeat(20)}`);

  const first = await time('offset page 1  (skip 0)', () =>
    Transaction.find({}).populate(POPULATE).sort({ createdAt: -1 }).skip(0).limit(PAGE_SIZE).lean(),
  );
  row(first.label, first.median);

  const deep = await time(`offset last page (skip ${deepSkip})`, () =>
    Transaction.find({})
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .skip(deepSkip)
      .limit(PAGE_SIZE)
      .lean(),
  );
  row(deep.label, deep.median, `skip cost: ${(deep.median - first.median).toFixed(1)} ms`);

  // Cursor pagination: same page, addressed by the last row's sort key instead
  // of by an offset, so the server never walks the rows it is skipping.
  const anchor = first.result[first.result.length - 1]?.createdAt;
  const cursor = await time('cursor page 2  (createdAt < anchor)', () =>
    Transaction.find({ createdAt: { $lt: anchor } })
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
  );
  row(cursor.label, cursor.median);

  const counted = await time('countDocuments (for totalPages)', () =>
    Transaction.countDocuments({}),
  );
  row(counted.label, counted.median, 'runs on every page request');

  const noPopulate = await time('same page WITHOUT populate', () =>
    Transaction.find({}).sort({ createdAt: -1 }).limit(PAGE_SIZE).lean(),
  );
  row(noPopulate.label, noPopulate.median, `populate costs ${(first.median - noPopulate.median).toFixed(1)} ms`);

  const hydrated = await time('same page WITHOUT .lean() (hydrated)', () =>
    Transaction.find({}).populate(POPULATE).sort({ createdAt: -1 }).limit(PAGE_SIZE),
  );
  row(hydrated.label, hydrated.median, `.lean() saves ${(hydrated.median - first.median).toFixed(1)} ms`);

  const payload = first.result;
  const serialize = await time('JSON.stringify of that page', async () => JSON.stringify(payload));
  row(
    serialize.label,
    serialize.median,
    `${(Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1)} KB`,
  );

  console.log(`\n── The stats panel ${'─'.repeat(38)}`);
  console.log('  The transactions page asks for five counts by calling the list');
  console.log('  endpoint five times with limit=1 and reading pagination.total.\n');

  const STATUSES = ['pending', 'completed', 'failed', 'cancelled'];

  const fiveCalls = await time('5 list calls, as the page does it today', async () => {
    const results = [];
    // Sequential on purpose: this is five HTTP requests from the browser, each
    // repeating the whole find + populate + count pipeline server-side.
    results.push(await Transaction.find({}).populate(POPULATE).sort({ createdAt: -1 }).limit(1).lean());
    results.push(await Transaction.countDocuments({}));
    for (const status of STATUSES) {
      results.push(
        await Transaction.find({ status }).populate(POPULATE).sort({ createdAt: -1 }).limit(1).lean(),
      );
      results.push(await Transaction.countDocuments({ status }));
    }
    return results;
  });
  row(fiveCalls.label, fiveCalls.median, '5 round trips');

  const oneAggregate = await time('1 aggregation returning all five counts', () =>
    Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  );
  row(oneAggregate.label, oneAggregate.median, '1 round trip');

  console.log(
    `\n  stats panel saving: ${(fiveCalls.median - oneAggregate.median).toFixed(1)} ms ` +
      `(${(fiveCalls.median / Math.max(oneAggregate.median, 0.001)).toFixed(1)}x faster)`,
  );

  // ── Equivalence: the replacement must return the same numbers ─────────────
  // Faster is worthless if it is also different. These are the counts the page
  // actually renders, computed both ways and compared.
  console.log(`\n── Replacement correctness ${'─'.repeat(30)}`);

  const oldWay = {
    total: await Transaction.countDocuments({}),
    pending: await Transaction.countDocuments({ status: 'pending' }),
    completed: await Transaction.countDocuments({ status: 'completed' }),
    failed: await Transaction.countDocuments({ status: 'failed' }),
    cancelled: await Transaction.countDocuments({ status: 'cancelled' }),
  };

  const grouped = await Transaction.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ]);
  const byStatus = grouped.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
  const newWay = {
    total: grouped.reduce((sum, r) => sum + r.count, 0),
    pending: byStatus.pending || 0,
    completed: byStatus.completed || 0,
    failed: byStatus.failed || 0,
    cancelled: byStatus.cancelled || 0,
  };

  let mismatches = 0;
  for (const key of Object.keys(oldWay)) {
    const same = oldWay[key] === newWay[key];
    if (!same) mismatches += 1;
    console.log(
      `  ${same ? 'PASS' : 'FAIL'}  ${key.padEnd(12)} five calls: ${String(oldWay[key]).padStart(5)}   aggregation: ${String(newWay[key]).padStart(5)}`,
    );
  }
  console.log(
    `\n  ${mismatches === 0 ? 'Identical results' : `${mismatches} MISMATCH(ES)`} — ` +
      `${(fiveCalls.median / Math.max(oneAggregate.median, 0.001)).toFixed(1)}x faster`,
  );

  console.log(`\n${'═'.repeat(72)}`);
  console.log('Read the skip cost and the stats saving against each other before');
  console.log('choosing what to optimise.');
  console.log('═'.repeat(72));

  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('benchmark failed:', error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exitCode = 1;
});
