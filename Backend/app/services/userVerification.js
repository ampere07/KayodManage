const mongoose = require('mongoose');
const User = require('../models/User');
const CredentialVerification = require('../models/CredentialVerification');

const OPEN_SUBMISSION_STATUSES = ['pending', 'under_review'];

const verifiedState = (verified) => (verified
  ? { isVerified: true, credentialVerificationStatus: 'approved' }
  : { isVerified: false, credentialVerificationStatus: 'none' });

const setUserVerified = async (userId, verified, reviewerId) => {
  const user = await User.findByIdAndUpdate(userId, { $set: verifiedState(verified) }, { new: true });
  if (!user || !verified) return user;
  await CredentialVerification.findOneAndUpdate(
    { userId, status: { $in: OPEN_SUBMISSION_STATUSES } },
    { $set: { status: 'approved', reviewedAt: new Date(), reviewedBy: mongoose.Types.ObjectId.isValid(reviewerId) ? reviewerId : null } },
    { sort: { submittedAt: -1 } }
  );
  return user;
};

module.exports = { setUserVerified };
