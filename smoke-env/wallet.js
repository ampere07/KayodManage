#!/usr/bin/env node
/**
 * Shows demo users' wallets, for the money cases of the manual smoke test
 * (the admin portal shows totals, never the wallet itself).
 *
 *   node smoke-env/wallet.js "Paolo Cruz" "Mae Ramos"
 *
 * Reads only, and only the demo database smoke-env/start.js runs.
 */
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'Backend/node_modules/mongodb'));

const names = process.argv.slice(2);
if (!names.length) { console.log('usage: node smoke-env/wallet.js "<user name>" ["<user name>" …]'); process.exit(1); }
const money = (n) => `₱${Number(n || 0).toLocaleString('en-PH')}`;

(async () => {
  const client = await new MongoClient('mongodb://127.0.0.1:27037/?replicaSet=rssmoke', { serverSelectionTimeoutMS: 3000 }).connect()
    .catch(() => { console.error('Cannot reach the demo database on 127.0.0.1:27037 — is `node smoke-env/start.js` running?'); process.exit(2); });
  const db = client.db('smoke_kayod');
  for (const name of names) {
    const users = await db.collection('users').find({ name }, { projection: { name: 1, email: 1 } }).toArray();
    if (!users.length) console.log(`${name}: no such user`);
    for (const u of users) {
      const w = await db.collection('wallets').findOne({ userId: u._id });
      console.log(w
        ? `${u.name} (${u.email}): balance ${money(w.balance)} · available ${money(w.availableBalance)} · held ${money(w.heldBalance)}`
        : `${u.name} (${u.email}): no wallet`);
    }
  }
  await client.close();
})();
