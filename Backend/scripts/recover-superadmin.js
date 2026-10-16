/**
 * Runbook R5 — restore superadmin access when nobody can sign in.
 *
 * Makes one existing account an active superadmin with a new password, clears any restriction on it,
 * and records the recovery in the audit log. Run it from Backend/, with the connection string in the
 * environment (never on the command line, where it lands in shell history):
 *
 *   MONGODB_URI=...   (set from the host's secret store)
 *   node scripts/recover-superadmin.js <email> <new password, 12+ characters>
 *
 * The live data is in the `test` database (MONGODB_DB overrides it, e.g. for a rehearsal on a copy).
 * Ask the person to change the password after they sign in.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 12) {
    console.error('usage: node scripts/recover-superadmin.js <email> <new password, 12+ characters>');
    process.exit(2);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || 'test' });
  const db = mongoose.connection.db;
  const users = db.collection('users');

  const user = await users.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: { userType: 'superadmin', accountStatus: 'active', isRestricted: false, password: await bcrypt.hash(password, 10), updatedAt: new Date() },
      $unset: { restrictionDetails: '' },
    }
  );
  await db.collection('activitylogs').insertOne({
    adminId: user._id,
    actionType: 'admin_updated',
    targetType: 'admin',
    targetId: user._id,
    targetModel: 'User',
    description: `Superadmin access restored for ${user.name} by the recovery script`,
    metadata: { recovery: true, previousRole: user.userType, previousStatus: user.accountStatus },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Restored: ${user.name} <${user.email}> is now an active superadmin (was ${user.userType}, ${user.accountStatus}).`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
