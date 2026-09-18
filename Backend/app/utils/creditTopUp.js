const mongoose = require('mongoose');

async function creditTopUp(userId, amount) {
  if (!userId) {
    throw new Error('creditTopUp needs the id of the wallet holder');
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`creditTopUp needs a positive amount, got ${amount}`);
  }

  const wallets = mongoose.connection.db.collection('wallets');
  const candidateIds = [];
  try {
    candidateIds.push(new mongoose.Types.ObjectId(userId.toString()));
  } catch {
    candidateIds.length = 0;
  }
  candidateIds.push(userId.toString());

  for (const id of candidateIds) {
    const wallet = await wallets.findOne({ userId: id });
    if (!wallet) continue;

    const availableBalance = (wallet.availableBalance || 0) + amount;
    const heldBalance = wallet.heldBalance || 0;
    const balance = availableBalance + heldBalance;

    await wallets.updateOne(
      { _id: wallet._id },
      {
        $set: { availableBalance, balance, lastActivity: new Date() },
        $inc: { 'statistics.totalTopUps': amount },
      }
    );

    return { availableBalance, heldBalance, balance };
  }

  return null;
}

module.exports = { creditTopUp };
