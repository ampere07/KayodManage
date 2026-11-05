#!/usr/bin/env node
/**
 * Makes the demo backend's next database write of one kind fail, to check that
 * an action which fails halfway leaves no half-written data behind.
 *
 *   node smoke-env/inject-fault.js insert          next insert fails (e.g. a refund or notification)
 *   node smoke-env/inject-fault.js update          next update fails (e.g. a user record)
 *   node smoke-env/inject-fault.js insert --times 2
 *   node smoke-env/inject-fault.js off             disarm
 *
 * Needs the demo started with fault injection:  node smoke-env/start.js --reset --fault-injection
 * Uses MongoDB's own failCommand fail point, limited to the backend's connections
 * (appName kayod-admin-demo), so this script and check-consistency.js are unaffected.
 */
const path = require('path');
const { MongoClient } = require(path.resolve(__dirname, '..', 'Backend/node_modules/mongodb'));

const KINDS = { insert: 'insert', update: 'update', findandmodify: 'findAndModify', delete: 'delete' };
const argv = process.argv.slice(2);
const kind = (argv[0] || '').toLowerCase();
const timesAt = argv.indexOf('--times');
const times = timesAt >= 0 ? Number(argv[timesAt + 1]) : 1;

if (!kind || kind === '--help' || (!KINDS[kind] && kind !== 'off')) {
  console.log('usage: node smoke-env/inject-fault.js <insert|update|findAndModify|delete|off> [--times N]');
  process.exit(kind && kind !== '--help' ? 1 : 0);
}

(async () => {
  const client = await new MongoClient('mongodb://127.0.0.1:27037/?directConnection=true', { serverSelectionTimeoutMS: 3000 }).connect()
    .catch(() => { console.error('Cannot reach the demo database — is `node smoke-env/start.js --fault-injection` running?'); process.exit(2); });
  try {
    await client.db('admin').command(kind === 'off'
      ? { configureFailPoint: 'failCommand', mode: 'off' }
      : {
          configureFailPoint: 'failCommand',
          mode: { times },
          data: { failCommands: [KINDS[kind]], errorCode: 2, appName: 'kayod-admin-demo' },
        });
    console.log(kind === 'off'
      ? 'Fault injection off.'
      : `Armed: the backend's next ${times === 1 ? '' : `${times} `}${KINDS[kind]} command${times === 1 ? '' : 's'} will fail. Now do the action in the browser.`);
  } catch (e) {
    console.error(/failCommand|test commands|no such command|not enabled/i.test(e.message)
      ? 'Fault injection is not enabled. Restart the demo with: node smoke-env/start.js --reset --fault-injection'
      : e.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();
