const mongoose = require('mongoose');
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Draft = require('../models/Draft');
const ChatSupport = require('../models/ChatSupport');
const ProviderBookingSlot = require('../models/ProviderBookingSlot');
const JobPostingSettings = require('../models/JobPostingSettings');
const { calculateNoShowPayout } = require('../utils/noShowPayout');
const {
  resolutionWentAgainstRaiser,
  raiserUserId,
  restrictForDisputeAbuse,
} = require('../utils/disputeAbuse');
const EscrowRelease = require('../models/EscrowRelease');
const { findSettleableEscrow } = require('../utils/settleableEscrow');
const { settleClientSpend } = require('../utils/clientSpend');
const { normalizeFinding, describeFinding } = require('../utils/faultFinding');
const { recordFaultFindings, restrictForConfirmedFault } = require('../utils/confirmedFault');
const escrowService = require('../services/escrowService');
const { createActivityLog } = require('./activityLogController');

// Helper function to strip random suffix from icon paths
const cleanIconPath = (iconPath) => {
  if (!iconPath || !iconPath.startsWith('ik:')) return iconPath;
  
  // Pattern: filename_[randomString].webp → filename.webp
  // Example: auto-mechanic_rLSXphs9nd.webp → auto-mechanic.webp
  return iconPath.replace(/_([^_]+)\.webp$/, '.webp');
};

const getJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const search = req.query.search;
    const status = req.query.status;
    const category = req.query.category;
    const profession = req.query.profession;
    const paymentMethod = req.query.paymentMethod;
    
    let query = {};
    
    // Filter archived jobs. "archived" is a union of isHidden and isDeleted;
    // archiveType narrows to one or the other.
    const archived = req.query.archived === 'true';
    const archiveType = req.query.archiveType;

    if (archived) {
      if (archiveType === 'hidden') {
        query.isHidden = true;
      } else if (archiveType === 'removed') {
        query.isDeleted = true;
      } else {
        // Merged via $and (not query.$or) so it can't collide with the
        // separate $or the search filter below sets.
        query.$and = [...(query.$and || []), { $or: [{ isHidden: true }, { isDeleted: true }] }];
      }
    } else {
      query.isHidden = { $ne: true };
      query.isDeleted = { $ne: true };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { professionName: { $regex: search, $options: 'i' } },
        { categoryName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (category && category !== 'all') {
      query.categoryName = { $regex: category, $options: 'i' };
    }
    
    if (profession && profession !== 'all') {
      query.professionName = { $regex: profession, $options: 'i' };
    }
    
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    // Fetch jobs and populate user virtuals
    const jobs = await Job.find(query)
      .populate('userId', 'name email phone phoneNumber userType profileImage')
      .populate('assignedToId', 'name email phone phoneNumber userType profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get job IDs for application count
    const jobIds = jobs.map(job => job._id);
    
    // Get application counts for each job
    const applicationCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$job', count: { $sum: 1 } } }
    ]);
    
    // Create a map of job ID to application count
    const countMap = {};
    applicationCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });
    
    // Add application count to each job
    const jobsWithData = jobs.map(job => {
      let locationDisplay = 'Location not specified';
      
      try {
        if (job.location && typeof job.location === 'object') {
          locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
        } else if (job.location && typeof job.location === 'string') {
          locationDisplay = job.location;
        }
      } catch (err) {
        console.error('Error parsing location for job:', job._id, err);
        locationDisplay = 'Location not specified';
      }
      
      // Clean icon path to remove random suffix
      const cleanedIcon = cleanIconPath(job.icon);
      
      return {
        ...job,
        icon: cleanedIcon,
        user: job.userId,
        assignedTo: job.assignedToId,
        applicationCount: countMap[job._id.toString()] || 0,
        locationDisplay
      };
    });
    
    const total = await Job.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    // Calculate total value of ALL jobs (not filtered)
    const totalValueResult = await Job.aggregate([
      { $group: { _id: null, totalValue: { $sum: '$budget' } } }
    ]);
    const totalValue = totalValueResult.length > 0 ? totalValueResult[0].totalValue : 0;
    
    res.json({
      jobs: jobsWithData,
      pagination: {
        page,
        limit,
        total,
        pages
      },
      stats: {
        totalValue
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch jobs', message: error.message });
  }
};

const getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId)
      .populate('userId', 'name firstName lastName email phone phoneNumber userType profileImage location barangay city isVerified')
      .populate('assignedToId', 'name email phone phoneNumber userType profileImage')
      .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get applications for this job
    const applications = await Application.find({ job: jobId })
      .populate('provider', 'name email phone')
      .sort({ appliedAt: -1 })
      .lean();
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      icon: cleanIconPath(job.icon),
      user: job.userId,
      assignedTo: job.assignedToId,
      applications,
      applicationCount: applications.length,
      locationDisplay
    };
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error fetching job details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch job details', message: error.message });
  }
};

const updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;

    // "cancelled" is deliberately excluded — cancelling a job has real money
    // and notification side effects (see forceCancelJob below) that a bare
    // status flip would skip entirely, silently stranding any held payment.
    // Use POST /:jobId/force-cancel instead.
    const validStatuses = ['open', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. To cancel a job, use POST /:jobId/force-cancel.' });
    }
    
    const updateData = { status };
    
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: `status changed to ${status}`
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error updating job status:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update job status', message: error.message });
  }
};

/**
 * forceCancelJob — the only path for an admin to cancel a job from Kayod
 * Manage. Deliberately separate from updateJobStatus: cancellation has real
 * side effects (releasing held funds, notifying both parties, recording who
 * cancelled and why) that a bare status write would silently skip, stranding
 * the client's money in heldBalance forever. Mirrors the real
 * cancelBooking's provider-cancels branch (full refund, no fee — this is an
 * admin override, not a client choosing to eat a cancellation fee).
 */
const forceCancelJob = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { jobId } = req.params;
    const { reason } = req.body || {};
    const adminId = req.user?.id;

    const job = await Job.findById(jobId).session(session);
    if (!job) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Job is already cancelled' });
    }

    if (job.status === 'completed') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Cannot cancel a completed job' });
    }

    const heldTransactionId = job.paymentDetails?.heldTransaction;
    let refundedAmount = 0;

    if (heldTransactionId) {
      const heldTransaction = await Transaction.findById(heldTransactionId).session(session);

      if (heldTransaction && heldTransaction.status === 'held') {
        refundedAmount = heldTransaction.amount;

        // 1. Release the full amount from the client's heldBalance back to
        //    availableBalance — no fee, no split. This is an admin override,
        //    not a client-initiated cancellation, so the client should never
        //    be charged for an action they didn't take.
        const clientWallet = await Wallet.findOne({ userId: job.userId }).session(session);
        if (clientWallet) {
          // Measured, not assumed. If completion already captured this hold the
          // subtraction clamps to zero, and passing the face value as a debit
          // would invent spend that never left the wallet. Net effect: money
          // returned to the client comes back off their lifetime spend, which is
          // the reversal the reported inaccuracy asked for.
          const heldBefore = clientWallet.heldBalance || 0;
          clientWallet.heldBalance = Math.max(0, heldBefore - refundedAmount);
          clientWallet.availableBalance = (clientWallet.availableBalance || 0) + refundedAmount;
          settleClientSpend(clientWallet, {
            heldDebited: heldBefore - clientWallet.heldBalance,
            refunded: refundedAmount,
          });
          clientWallet.lastActivity = new Date();
          await clientWallet.save({ session });
        }

        // 2. Mark the held transaction as refunded — keep the record for
        //    audit history, don't delete it.
        heldTransaction.status = 'refunded';
        heldTransaction.completedAt = heldTransaction.completedAt || new Date();
        await heldTransaction.save({ session });

        // 3. Create a new refund transaction so this is visible in the
        //    client's wallet history, same pattern the real cancelBooking uses.
        await Transaction.create([{
          fromUserId: null,
          toUserId: job.userId,
          amount: refundedAmount,
          type: 'job_budget_refund',
          status: 'completed',
          jobId: job._id,
          description: `Refund — job cancelled by admin: ${job.title}`,
          completedAt: new Date(),
          metadata: {
            reason: reason || 'Cancelled by admin',
            cancelledBy: 'admin',
            adminId: adminId || null
          }
        }], { session });
      }
    }

    // 4. Clear the job's payment fields.
    job.paymentDetails = job.paymentDetails || {};
    job.paymentDetails.isPaid = false;
    job.paymentDetails.paidAt = null;
    job.paymentDetails.heldTransaction = null;
    job.paymentStatus = 'pending';

    // 5. If a dispute is active, archive and clear it — a force-cancel refunds
    //    the client in full, so the honest resolution label is client_refunded.
    //    Leaving dispute.isActive on a cancelled job creates a zombie the 72h
    //    escalation (active statuses only) can never pick up.
    if (job.completionStatus?.dispute?.isActive) {
      const activeDispute = job.completionStatus.dispute;
      const adminObjectId = adminId && mongoose.Types.ObjectId.isValid(adminId) ? adminId : null;
      job.completionStatus.disputeHistory = job.completionStatus.disputeHistory || [];
      job.completionStatus.disputeHistory.push({
        raisedBy: activeDispute.raisedBy,
        raisedAt: activeDispute.raisedAt,
        reason: activeDispute.reason,
        resolvedAt: new Date(),
        resolvedBy: adminObjectId,
        resolution: 'client_refunded'
      });
      job.completionStatus.dispute = {
        isActive: false,
        raisedBy: null,
        raisedAt: null,
        reason: null,
        resolvedAt: new Date(),
        resolvedBy: adminObjectId,
        resolution: 'client_refunded',
        internalNotes: activeDispute.internalNotes || []
      };
    }

    // 6. Write the cancellation, last — only after the refund above succeeded.
    job.status = 'cancelled';
    job.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: adminId && mongoose.Types.ObjectId.isValid(adminId) ? adminId : null,
      reason: reason || 'Cancelled by admin',
      feeApplied: 0
    };

    await job.save({ session });
    await ProviderBookingSlot.releaseForJob(job._id, session);
    await session.commitTransaction();

    // 5. Notify the client and the assigned provider — best-effort, after commit.
    try {
      const notifications = [];
      if (job.userId) {
        notifications.push({
          userId: job.userId,
          title: 'Booking Cancelled',
          message: `Your booking for "${job.title}" was cancelled by an admin. ${refundedAmount > 0 ? `₱${refundedAmount} has been refunded to your wallet.` : ''}`,
          type: 'admin_action',
          relatedId: job._id,
          relatedModel: 'Job',
          priority: 'high',
          data: { jobId: job._id.toString(), refundedAmount, reason: reason || null }
        });
      }
      if (job.assignedToId) {
        notifications.push({
          userId: job.assignedToId,
          title: 'Booking Cancelled',
          message: `The booking for "${job.title}" was cancelled by an admin.`,
          type: 'admin_action',
          relatedId: job._id,
          relatedModel: 'Job',
          priority: 'high',
          data: { jobId: job._id.toString(), reason: reason || null }
        });
      }
      if (notifications.length) {
        await Notification.insertMany(notifications);
      }
    } catch (notifyErr) {
      console.error('[forceCancelJob] Notification error:', notifyErr);
    }

    // Force-cancel resolves any active dispute as client_refunded (see step 5
    // above) — close both parties' dispute threads with that outcome so no
    // zombie mediation chats stay open on a cancelled job.
    await closeDisputeThreadsForJob(job, {
      outcome: 'refund_client',
      adminObjectId: adminId && mongoose.Types.ObjectId.isValid(adminId)
        ? new mongoose.Types.ObjectId(adminId)
        : null,
      adminName: req.admin?.name || req.user?.username || 'Support Agent',
      summaryFor: (isClient) =>
        isClient
          ? `Your booking for "${job.title}" was cancelled by support and you've been refunded in full.`
          : `The booking for "${job.title}" was cancelled by support. The dispute has been closed.`,
    });

    try {
      await createActivityLog(adminId, 'job_force_cancelled', `Force-cancelled job: ${job.title}`, {
        targetType: 'job',
        targetId: job._id.toString(),
        targetModel: 'Job',
        metadata: { reason: reason || null, refundedAmount }
      });
    } catch (activityErr) {
      console.error('[forceCancelJob] Activity log error:', activityErr);
    }

    const updatedJob = await Job.findById(jobId)
      .populate('userId', 'name email userType profileImage')
      .populate('assignedToId', 'name email userType profileImage')
      .lean();

    try {
      const { io } = require('../../server');
      io.to('admin').emit('job:updated', {
        job: updatedJob,
        updateType: 'force-cancelled'
      });
    } catch (socketErr) {
      // best-effort
    }

    res.json({ success: true, job: updatedJob, refundedAmount });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error force-cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job', message: error.message });
  } finally {
    session.endSession();
  }
};

const DISPUTE_RESOLUTION_MAP = {
  pay_provider: 'provider_paid',
  refund_client: 'client_refunded',
  rebook: 'rebook',
  no_show_payout: 'no_show_payout',
};

const DISPUTE_OUTCOME_LABELS = {
  pay_provider: 'Provider paid',
  refund_client: 'Client refunded',
  rebook: 'Booking continued',
  no_show_payout: 'Client did not appear',
};

/**
 * Close both parties' dispute ChatSupport threads for a job — a summary
 * message, a "Ticket has been resolved" system message, closed status with
 * history, and the outcome recorded in metadata.disputeOutcome so the app
 * can badge the result. Used by resolveDispute and forceCancelJob (which
 * resolves an active dispute as client_refunded). Best-effort: errors are
 * logged, never thrown.
 */
const closeDisputeThreadsForJob = async (job, { outcome, adminObjectId, adminName, summaryFor }) => {
  try {
    const disputeThreads = await ChatSupport.find({
      'metadata.jobId': job._id.toString(),
      'metadata.kind': 'dispute',
      status: 'open',
    });

    const { emitChatSupportUpdate } = require('../socket/socketHandlers');
    const resolvedAt = new Date();
    const senderId = adminObjectId || new mongoose.Types.ObjectId('000000000000000000000000');
    const outcomeLabel = DISPUTE_OUTCOME_LABELS[outcome] || outcome;

    for (const thread of disputeThreads) {
      const isClient = thread.userId.toString() === job.userId.toString();
      thread.messages.push({
        senderId,
        senderName: adminName,
        senderType: 'Admin',
        message: summaryFor(isClient),
        timestamp: resolvedAt,
      });
      thread.messages.push({
        senderId,
        senderName: adminName,
        senderType: 'Admin',
        message: `Ticket has been resolved: ${outcomeLabel}`,
        timestamp: resolvedAt,
      });

      thread.status = 'closed';
      thread.closedAt = resolvedAt;
      if (!thread.statusHistory) {
        thread.statusHistory = [];
      }
      thread.statusHistory.push({
        status: 'resolved',
        performedBy: adminObjectId,
        performedByName: adminName,
        timestamp: resolvedAt,
        reason: `Dispute resolved: ${outcomeLabel}`,
      });
      thread.metadata = { ...(thread.metadata || {}), disputeOutcome: outcome };
      thread.markModified('metadata');
      await thread.save();

      emitChatSupportUpdate(thread._id, {
        status: thread.status,
        closedAt: thread.closedAt,
        updatedAt: thread.updatedAt,
        messages: thread.messages,
        statusHistory: thread.statusHistory,
        metadata: thread.metadata,
      });
    }
  } catch (threadErr) {
    console.error('[closeDisputeThreadsForJob] Dispute thread update error:', threadErr);
  }
};

/**
 * resolveDispute — the only path for an admin to close out an active dispute
 * (see completionController.raiseDispute in kayod/server, which is what
 * opens one). Three outcomes, matching the mediation buttons in Support.tsx:
 *  - pay_provider: the payment goes out through the escrow hold, never as an
 *    immediate transfer. If the dispute paused an existing hold, that hold
 *    RESUMES on its original release date (or pays out now if that date has
 *    already passed) — it is not restarted. The hold is a warranty on
 *    delivered work, and the work was delivered once; restarting it made a
 *    provider who won the dispute serve a second full warranty. Only when there
 *    was no hold yet (dispute raised before completion) is a first hold
 *    scheduled from now.
 *  - refund_client: full refund, job cancelled, and reverted to a Draft
 *    (with a sourceJobId trail) so the client can republish without
 *    re-entering details.
 *  - rebook: the work gets redone by the same provider. No money moves in
 *    either direction — the held funds are the leverage that makes the redo
 *    happen — but the escrow hold is SUSPENDED so its countdown stops instead
 *    of paying out for work that is not finished. On re-completion the same
 *    hold is revived with a fresh window measured from the new completion (see
 *    kayod/server EscrowService.scheduleEscrowRelease, which reuses suspended
 *    records). Allowed on a completed-and-in-escrow job, which is the main case
 *    for it — substandard work the provider should come back and fix. Requires a
 *    redo deadline, without which the client's money would be held open-ended.
 * Every outcome archives the dispute into completionStatus.disputeHistory
 * before clearing the live dispute field, so a rebooked job's next dispute
 * (if any) shows an admin the full pattern, not just the latest complaint.
 */
const resolveDispute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { jobId } = req.params;
    const { outcome, note, rebookDeadlineAt, faultParty, findingReason, findingNotes } = req.body || {};

    // What the admin FOUND, separate from where the money went. `resolution`
    // cannot carry this: the same `client_refunded` covers "the provider never
    // arrived", "the work was unacceptable" and "both sides called it off" — three
    // findings with three different consequences. An unstated finding normalises
    // to `uncertain`, which records honestly and sanctions nobody.
    const finding = normalizeFinding({ faultParty, findingReason, notes: findingNotes });
    const adminId = req.user?.id;
    const adminObjectId = adminId && mongoose.Types.ObjectId.isValid(adminId) ? adminId : null;

    const resolution = DISPUTE_RESOLUTION_MAP[outcome];
    if (!resolution) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'outcome must be one of: pay_provider, refund_client, rebook, no_show_payout' });
    }

    const job = await Job.findById(jobId).session(session);
    if (!job) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.completionStatus?.dispute?.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'This job has no active dispute to resolve.' });
    }

    // A COPY, not a reference. `job.completionStatus.dispute = {...}` below
    // does not rebind this variable — Mongoose overwrites the existing
    // subdocument in place — so every field read after that assignment came
    // back as the cleared value. The repeat-dispute abuse check reads
    // `raisedBy` there and saw null on every ruling, so it concluded no ruling
    // had ever gone against a raiser and the restriction never fired for
    // anyone. The history entry pushed just above it was correct, which is what
    // made this invisible: the archive said `client` while the check said
    // nobody.
    const activeDispute = job.completionStatus.dispute;
    const disputeSnapshot = {
      raisedBy: activeDispute.raisedBy,
      raisedAt: activeDispute.raisedAt,
      reason: activeDispute.reason,
      internalNotes: Array.isArray(activeDispute.internalNotes)
        ? [...activeDispute.internalNotes]
        : [],
    };
    let refundedAmount = 0;
    let draftId = null;
    // Populated by pay_provider and no_show_payout so the notifications and the
    // API response can state the real release date rather than assuming a fixed
    // window.
    let escrowOutcome = null;
    // Populated by no_show_payout: how the held amount was split.
    let noShowSettlement = null;

    if (job.completionStatus?.paymentReleased && outcome !== 'rebook') {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Payment for this job has already been released — neither a refund nor a second payout is possible. Resolve with rebook or handle manually.',
      });
    }

    // A cancelled job has no booking left to redo. "completed" IS rebookable —
    // a dispute raised during the escrow hold is always on a completed job, and
    // ordering the work redone is the natural remedy for substandard work. The
    // branch below walks such a job back to in_progress and suspends its hold.
    if (outcome === 'rebook' && job.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Cannot rebook a cancelled job — the booking is no longer active.',
      });
    }

    let rebookDeadline = null;
    if (outcome === 'rebook') {
      // The held funds stay held through a rebook, so an open-ended rebook is
      // an open-ended hold on the client's money. Require the deadline that
      // autoConfirmCompletion escalates on.
      if (!rebookDeadlineAt) {
        await session.abortTransaction();
        return res.status(400).json({
          error: 'A redo deadline is required to resolve with rebook — the client\'s payment stays held until the work is redone.',
        });
      }
      rebookDeadline = new Date(rebookDeadlineAt);
      if (Number.isNaN(rebookDeadline.getTime())) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'rebookDeadlineAt is not a valid date.' });
      }
      if (rebookDeadline <= new Date()) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'The redo deadline must be in the future.' });
      }
    }

    if (outcome === 'pay_provider') {
      // Settleable in EITHER resting state: still held pre-completion, or
      // already moved into the warranty hold by completion. See
      // utils/settleableEscrow.js — requiring 'held' alone made every
      // post-completion dispute unresolvable.
      const settleable = await findSettleableEscrow(job, session);
      if (!settleable) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'No held payment found for this job — cannot release funds to the provider.' });
      }
      const heldTransaction = settleable.heldTransaction;

      const clientWallet = await Wallet.findOne({ userId: job.userId }).session(session);
      if (clientWallet && clientWallet.heldBalance >= heldTransaction.amount) {
        clientWallet.heldBalance -= heldTransaction.amount;
        // Inside the same guard as the debit, so the spend is recognised only
        // when this branch is the one that actually captures the hold. A dispute
        // raised AFTER completion finds the hold already captured (and already
        // counted), the guard is false, and nothing is double-counted.
        settleClientSpend(clientWallet, { heldDebited: heldTransaction.amount });
        clientWallet.lastActivity = new Date();
        await clientWallet.save({ session });
      }

      heldTransaction.status = 'completed';
      heldTransaction.completedAt = new Date();
      await heldTransaction.save({ session });

      job.escrowAmount = heldTransaction.amount;
      job.escrowStatus = 'pending';
      job.status = 'completed';
      job.completionStatus.completedAt = job.completionStatus.completedAt || new Date();
      // Do NOT set paymentReleased/paymentReleasedAt here — the hold resumed or
      // scheduled below is what actually moves the money. Flipping this flag now
      // (before money actually moves) makes the wallet UI show "Released"
      // immediately and, worse, makes kayod/server's
      // EscrowService.processEscrowRelease see paymentReleased already true when
      // the real release runs and skip crediting the provider entirely (see its
      // "already released" guard).
      job.paymentDetails = job.paymentDetails || {};
      job.paymentDetails.isPaid = true;
      await job.save({ session });

      // Resume the hold the dispute paused, on its ORIGINAL release date — a
      // provider who won the dispute must not serve a second warranty period
      // for the same delivered work. resumeEscrowRelease returns null when
      // there is no live hold (dispute raised before the job ever completed),
      // and only then is a first hold scheduled from now, for this job's own
      // window (see app/config/serviceClasses.js).
      escrowOutcome = await escrowService.resumeEscrowRelease(job._id, session);
      if (!escrowOutcome) {
        const scheduled = await escrowService.scheduleEscrowRelease(job._id, new Date(), session);
        escrowOutcome = {
          escrowRelease: scheduled,
          originalScheduledFor: null,
          scheduledFor: scheduled.scheduledFor,
          releasedImmediately: false,
        };
      }
    } else if (outcome === 'refund_client') {
      // Never notify "you've been refunded ₱0" — if there is nothing left to
      // return, refuse instead of silently cancelling with no refund. Both
      // resting states count as something: see utils/settleableEscrow.js.
      const settleable = await findSettleableEscrow(job, session);
      if (!settleable) {
        await session.abortTransaction();
        return res.status(400).json({
          error: 'No held payment found for this job — there is nothing to refund. Resolve with rebook or handle manually.',
        });
      }
      const heldTransaction = settleable.heldTransaction;

      // Braced to keep the settlement's locals out of the rebook-draft code
      // that follows, which declares its own.
      {
        refundedAmount = heldTransaction.amount;

        const clientWallet = await Wallet.findOne({ userId: job.userId }).session(session);
        if (clientWallet) {
          // Measured, not assumed. If completion already captured this hold the
          // subtraction clamps to zero, and passing the face value as a debit
          // would invent spend that never left the wallet. Net effect: money
          // returned to the client comes back off their lifetime spend, which is
          // the reversal the reported inaccuracy asked for.
          const heldBefore = clientWallet.heldBalance || 0;
          clientWallet.heldBalance = Math.max(0, heldBefore - refundedAmount);
          clientWallet.availableBalance = (clientWallet.availableBalance || 0) + refundedAmount;
          settleClientSpend(clientWallet, {
            heldDebited: heldBefore - clientWallet.heldBalance,
            refunded: refundedAmount,
          });
          clientWallet.lastActivity = new Date();
          await clientWallet.save({ session });
        }

        heldTransaction.status = 'refunded';
        heldTransaction.completedAt = heldTransaction.completedAt || new Date();
        await heldTransaction.save({ session });

        const [refundTransaction] = await Transaction.create([{
          fromUserId: null,
          toUserId: job.userId,
          amount: refundedAmount,
          type: 'job_budget_refund',
          status: 'completed',
          jobId: job._id,
          description: `Refund — dispute resolved in your favor: ${job.title}`,
          completedAt: new Date(),
          metadata: { reason: note || 'Dispute resolved: client refunded', resolvedBy: 'admin', adminId: adminObjectId },
        }], { session });

        // A dispute raised during the escrow hold leaves a live
        // EscrowRelease record (scheduled/processing/failed) pointing at this
        // job. Without cancelling it here, clearing dispute.isActive below
        // would let the next scheduler tick pay the provider out of that
        // stale record — after the client was just refunded the same money.
        await EscrowRelease.updateMany(
          { jobId: job._id, status: { $in: ['scheduled', 'processing', 'failed'] } },
          { $set: { status: 'refunded', refundTransactionId: refundTransaction._id } },
          { session }
        );
      }

      const [draft] = await Draft.create([{
        userId: job.userId,
        title: job.title || '',
        description: job.description || '',
        category: job.categoryName || '',
        professionName: job.professionName || null,
        icon: job.icon || '',
        media: job.media || [],
        location: job.location || null,
        locationDetails: job.locationDetails || '',
        date: job.date || null,
        selectedDates: job.selectedDates || [],
        timeWindows: job.timeWindows || [],
        dateDetails: job.dateDetails || null,
        paymentMethod: 'wallet',
        sourceJobId: job._id,
      }], { session });
      draftId = draft._id;

      job.status = 'cancelled';
      job.escrowStatus = 'refunded';
      job.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: adminObjectId,
        reason: note || 'Dispute resolved: client refunded',
        feeApplied: 0,
      };
      job.paymentDetails = job.paymentDetails || {};
      job.paymentDetails.isPaid = false;
      job.paymentDetails.heldTransaction = null;
      job.paymentStatus = 'pending';
      await job.save({ session });
      await ProviderBookingSlot.releaseForJob(job._id, session);
    } else if (outcome === 'no_show_payout') {
      // The client did not appear. The provider held the slot, so they take a
      // share of the held amount (the reserved-time payout) and the rest goes
      // back to the client. A partial settlement, which is why this is its own
      // outcome rather than a flavor of pay_provider.
      //
      // Only ever reachable from an issue somebody actually raised. A booking
      // that lapsed in silence is refunded in full by the app's own scheduler
      // and never arrives here — see kayod/server NoShowReviewService for why
      // paying anyone for silence would be free money for doing nothing.
      const settleable = await findSettleableEscrow(job, session);
      if (!settleable) {
        await session.abortTransaction();
        return res.status(400).json({
          error: 'No held payment found for this job — there is nothing to split. Handle this one manually.',
        });
      }
      const heldTransaction = settleable.heldTransaction;

      // scheduleEscrowRelease needs the provider still assigned, so unlike
      // refund_client this branch must not clear assignedToId.
      if (!job.assignedToId) {
        await session.abortTransaction();
        return res.status(400).json({
          error: 'This job has no assigned provider, so there is nobody to pay the reserved-time payout to.',
        });
      }

      const noShowConfig = await JobPostingSettings.getNoShowConfig();
      const heldAmount = heldTransaction.amount;
      const { payout, refundAmount: clientRefund } = calculateNoShowPayout(heldAmount, noShowConfig);
      noShowSettlement = { payout, clientRefund, heldAmount };
      refundedAmount = clientRefund;

      const clientWallet = await Wallet.findOne({ userId: job.userId }).session(session);
      if (clientWallet) {
        // The whole held amount leaves heldBalance — the payout portion is now
        // owed to the provider and is tracked by the EscrowRelease below, not
        // by the client's wallet.
        const heldBefore = clientWallet.heldBalance || 0;
        clientWallet.heldBalance = Math.max(0, heldBefore - heldAmount);
        clientWallet.availableBalance = (clientWallet.availableBalance || 0) + clientRefund;
        // The reserved-time payout is genuinely spent and the rest is returned,
        // so the lifetime figure nets to the payout — whether or not completion
        // had already recognised this hold.
        settleClientSpend(clientWallet, {
          heldDebited: heldBefore - clientWallet.heldBalance,
          refunded: clientRefund,
        });
        clientWallet.lastActivity = new Date();
        await clientWallet.save({ session });
      }

      heldTransaction.status = 'completed';
      heldTransaction.completedAt = new Date();
      await heldTransaction.save({ session });

      if (clientRefund > 0) {
        await Transaction.create([{
          fromUserId: null,
          toUserId: job.userId,
          amount: clientRefund,
          type: 'job_budget_refund',
          status: 'completed',
          jobId: job._id,
          description: `Partial refund — booking not attended: ${job.title}`,
          completedAt: new Date(),
          metadata: {
            reason: note || 'No-show resolved: reserved-time payout to provider',
            resolvedBy: 'admin',
            adminId: adminObjectId,
            noShowPayout: payout,
          },
        }], { session });
      }

      // The payout is recorded now and paid after the hold, the same as any
      // other completed job's money. The record exists immediately so the
      // provider can see what they are owed and when.
      await Transaction.create([{
        fromUserId: job.userId,
        toUserId: job.assignedToId,
        amount: payout,
        type: 'no_show_payout',
        status: 'held',
        jobId: job._id,
        description: `Reserved-time payout — client did not appear: ${job.title}`,
        metadata: {
          reason: note || 'No-show resolved by admin',
          resolvedBy: 'admin',
          adminId: adminObjectId,
          heldAmount,
          clientRefund,
        },
      }], { session });

      // Cancelled, not completed: nobody did the work, and telling the client
      // their unattended booking was "completed" would be a lie on the one
      // screen where they go to check. kayod/server's escrow release knows to
      // settle a job in this state from the dispute resolution instead of the
      // status — see its processEscrowRelease.
      job.status = 'cancelled';
      job.escrowAmount = payout;
      // NOT 'refunded': that value makes kayod/server cancel the scheduled
      // release outright, which would strand the payout.
      job.escrowStatus = 'pending';
      job.paymentDetails = job.paymentDetails || {};
      job.paymentDetails.isPaid = true;
      job.paymentDetails.heldTransaction = null;
      job.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: adminObjectId,
        reason: note || 'No-show resolved: client did not appear',
        feeApplied: payout,
      };
      await job.save({ session });

      // The hold window is its own setting, defaulting to this job's own
      // snapshotted window when left at 0 — a ruling should be reversible for
      // as long as a normal completion is.
      const overrideReleaseHours = noShowConfig.noShowPayoutHoldHours > 0
        ? noShowConfig.noShowPayoutHoldHours
        : null;
      const scheduled = await escrowService.scheduleEscrowRelease(
        job._id,
        new Date(),
        session,
        { overrideReleaseHours },
      );
      escrowOutcome = {
        escrowRelease: scheduled,
        originalScheduledFor: null,
        scheduledFor: scheduled.scheduledFor,
        releasedImmediately: false,
      };

      // The provider keeps the slot released either way — the booking is over.
      await ProviderBookingSlot.releaseForJob(job._id, session);
    } else if (outcome === 'rebook') {
      job.completionStatus.clientConfirmed = false;
      job.completionStatus.providerConfirmed = false;
      job.completionStatus.clientConfirmedAt = null;
      job.completionStatus.providerConfirmedAt = null;

      // Walk a completed-and-in-escrow job back to an active booking. Without
      // this the job would sit at "completed" with its confirmations cleared,
      // which no completion flow can act on — the provider has no way to mark
      // the redone work complete again.
      if (job.status === 'completed') {
        job.status = 'in_progress';
        job.completionStatus.completedAt = null;
      }

      job.completionStatus.rebook = {
        orderedAt: new Date(),
        orderedBy: adminObjectId,
        deadlineAt: rebookDeadline,
        escalatedAt: null,
      };

      // Stop the payout countdown. The money neither releases nor refunds — it
      // stays held as the leverage that makes the redo happen — but leaving the
      // hold "scheduled" would pay the provider on the original date for work
      // that has just been ruled unfinished. On re-completion kayod/server
      // revives this same record with a fresh window from the new completion.
      await escrowService.suspendEscrowRelease(
        job._id,
        note ? `Rebook ordered: ${note}` : 'Rebook ordered by dispute resolution',
        session
      );
      job.escrowStatus = 'pending';
      job.escrowReleaseAt = null;

      await job.save({ session });
    }

    job.completionStatus.disputeHistory = job.completionStatus.disputeHistory || [];
    job.completionStatus.disputeHistory.push({
      raisedBy: disputeSnapshot.raisedBy,
      raisedAt: disputeSnapshot.raisedAt,
      reason: disputeSnapshot.reason,
      // Both sides' accounts travel into the archive with the ruling. A rebooked
      // job disputed again shows the next admin what each party said last time;
      // keeping only the outcome would hide the pattern this history is for.
      claims: disputeSnapshot.claims || [],
      finding: {
        faultParty: finding.faultParty,
        findingReason: finding.findingReason,
        notes: finding.notes,
      },
      resolvedAt: new Date(),
      resolvedBy: adminObjectId,
      resolution,
    });
    job.completionStatus.dispute = {
      isActive: false,
      raisedBy: null,
      raisedAt: null,
      reason: null,
      claims: [],
      // The finding stays legible on the closed case, not only in the archive:
      // both apps render "what support decided" from the live field, and a party
      // told only where their money went learns nothing about why.
      finding: {
        faultParty: finding.faultParty,
        findingReason: finding.findingReason,
        notes: finding.notes,
        decidedBy: adminObjectId,
        decidedAt: new Date(),
      },
      resolvedAt: new Date(),
      resolvedBy: adminObjectId,
      resolution,
      internalNotes: disputeSnapshot.internalNotes || [],
    };

    await job.save({ session });

    // A dispute resolved AGAINST the party who raised it now counts toward a
    // rolling restriction. Deliberately AFTER the history entry above, so the
    // count includes this loss, and inside the transaction so a restriction can
    // never be applied for a ruling that then rolls back.
    let raiserRestricted = false;
    const raisedBy = disputeSnapshot.raisedBy;
    if (resolutionWentAgainstRaiser(raisedBy, resolution)) {
      const abuseConfig = await JobPostingSettings.getDisputeAbuseConfig();
      raiserRestricted = await restrictForDisputeAbuse(
        raiserUserId(job, raisedBy),
        raisedBy,
        abuseConfig.disputeLossRestrictionCount,
        session,
      );
    }

    // The finding itself, recorded against whoever it names — the thing that was
    // missing entirely. A confirmed no-show used to move money and leave nothing
    // behind, so the next admin to look at that account saw a clean record.
    //
    // Independent of the dispute-loss branch above, and deliberately: losing a
    // dispute you raised and being found at fault are different facts, and a
    // single ruling can produce one, both, or neither.
    const faultRecorded = await recordFaultFindings(job, finding, {
      adminId: adminObjectId,
      session,
      decidedAt: new Date(),
    });

    // Restriction reads the RECORD, not this ruling — so the threshold is about a
    // party's pattern of proven absences rather than whichever case is being
    // closed right now.
    const faultRestricted = [];
    if (faultRecorded.some((entry) => entry.sanctioned)) {
      const { confirmedFaultRestrictionCount } = await JobPostingSettings.getNoShowConfig();
      for (const entry of faultRecorded) {
        if (!entry.sanctioned) continue;
        const flipped = await restrictForConfirmedFault(
          entry.userId,
          entry.role,
          confirmedFaultRestrictionCount,
          session,
        );
        if (flipped) faultRestricted.push(entry);
      }
    }

    await session.commitTransaction();

    // Notified separately from the ruling: one message is about this job, the
    // other is about a pattern across several, and merging them would read as
    // punishment for this single dispute.
    if (raiserRestricted) {
      try {
        const restrictedId = raiserUserId(job, raisedBy);
        await Notification.create({
          userId: restrictedId,
          title: 'Account Restricted',
          message:
            'Your account has been temporarily restricted after repeated disputes that were not upheld. You can appeal this from Support.',
          type: 'admin_action',
          relatedId: job._id,
          relatedModel: 'Job',
          priority: 'high',
          data: { jobId: job._id.toString(), reason: 'dispute_abuse' },
        });
      } catch (notifyErr) {
        console.error('[resolveDispute] Dispute-abuse restriction notification failed:', notifyErr);
      }
    }

    // Told separately from the ruling, and told WHAT was found. A party who only
    // learns where the money went cannot tell a finding against them from a
    // routine refund, which is the gap that let confirmed no-shows go unnoticed
    // by the people committing them.
    for (const entry of faultRestricted) {
      try {
        await Notification.create({
          userId: entry.userId,
          title: 'Account Restricted',
          message:
            `Your account has been temporarily restricted: support found that ${describeFinding(finding)} on a recent booking, and this is not the first. You can appeal this from Support.`,
          type: 'admin_action',
          relatedId: job._id,
          relatedModel: 'Job',
          priority: 'high',
          data: {
            jobId: job._id.toString(),
            reason: 'confirmed_fault',
            faultParty: finding.faultParty,
            findingReason: finding.findingReason,
          },
        });
      } catch (notifyErr) {
        console.error('[resolveDispute] Confirmed-fault restriction notification failed:', notifyErr);
      }
    }

    try {
      await createActivityLog(adminId, 'dispute_resolved', `Resolved dispute on job "${job.title}": ${outcome}`, {
        targetType: 'job',
        targetId: job._id.toString(),
        targetModel: 'Job',
        metadata: {
          outcome,
          resolution,
          note: note || null,
          refundedAmount,
          draftId,
          escrowScheduledFor: escrowOutcome?.scheduledFor || null,
          escrowResumedFrom: escrowOutcome?.originalScheduledFor || null,
          escrowReleasedImmediately: escrowOutcome?.releasedImmediately || false,
          rebookDeadlineAt: rebookDeadline || null,
        },
      });
    } catch (activityErr) {
      console.error('[resolveDispute] Activity log error:', activityErr);
    }

    // State the actual release date rather than a nominal hold length: a
    // resumed hold keeps its original date, and one whose date already passed
    // during mediation pays out on the next scheduler tick.
    const formatDate = (date) =>
      date
        ? new Date(date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
        : null;
    const providerPayoutTiming = escrowOutcome?.releasedImmediately
      ? 'Payment will be released to your available balance shortly — the original hold period has already elapsed.'
      : `Payment will be released to your available balance on ${formatDate(escrowOutcome?.scheduledFor)}, the original hold date for this job.`;
    const rebookDeadlineText = formatDate(rebookDeadline);
    // The hold length is per-job now (see app/config/serviceClasses.js), so the
    // rebook copy has to name this job's own window rather than a constant —
    // an on-the-spot service redone under a 24-hour hold must not be told to
    // expect five days.
    const rebookHoldText = escrowService.describeReleaseWindow(job);

    // A job on a zero-hold class has no window to name, so the sentence has to
    // change shape rather than interpolate an empty one — otherwise the client
    // is told "a new null hold starts", on a notification about their money.
    const rebookClientHoldSentence = rebookHoldText
      ? `a new ${rebookHoldText} hold starts once the redone work is completed and confirmed`
      : 'your payment is released once the redone work is completed and confirmed';
    const rebookProviderHoldSentence = rebookHoldText
      ? `after which this job's standard ${rebookHoldText} hold applies`
      : 'after which payment is released without a further hold';

    const outcomeMessages = {
      pay_provider: {
        client: `Your dispute for "${job.title}" was resolved: the provider has been paid. ${note ? `Admin note: ${note}` : ''}`,
        provider: `Your dispute for "${job.title}" was resolved in your favor. ${providerPayoutTiming}`,
      },
      refund_client: {
        client: `Your dispute for "${job.title}" was resolved: you've been refunded ₱${refundedAmount}. The job has been saved as a draft so you can repost it whenever you're ready.`,
        provider: `The dispute for "${job.title}" was resolved in the client's favor. No payment will be released, and the job has been cancelled.`,
      },
      rebook: {
        client: `Your dispute for "${job.title}" was resolved: the same provider will redo the work by ${rebookDeadlineText}. Your payment stays held until then — it is not released and not refunded — and ${rebookClientHoldSentence}.`,
        provider: `The dispute for "${job.title}" was resolved: you are to redo the work by ${rebookDeadlineText}. The client's payment stays held until the redone work is completed and confirmed, ${rebookProviderHoldSentence}.`,
      },
      no_show_payout: {
        client: `The issue on "${job.title}" was reviewed and it was found that the booking was not attended. ₱${noShowSettlement?.payout ?? 0} has been paid to the provider for the time they reserved, and ₱${noShowSettlement?.clientRefund ?? 0} has been refunded to your wallet.${note ? ` Admin note: ${note}` : ''}`,
        provider: `The issue on "${job.title}" was reviewed in your favor. You are owed ₱${noShowSettlement?.payout ?? 0} for the time you reserved. ${escrowOutcome?.releasedImmediately ? 'It will reach your available balance shortly.' : `It will reach your available balance on ${formatDate(escrowOutcome?.scheduledFor)}.`}`,
      },
    };

    try {
      const notifications = [];
      if (job.userId) {
        notifications.push({
          userId: job.userId,
          title: 'Dispute Resolved',
          message: outcomeMessages[outcome].client,
          type: 'admin_action',
          relatedId: job._id,
          relatedModel: 'Job',
          priority: 'high',
          data: { jobId: job._id.toString(), outcome, refundedAmount, draftId },
        });
      }
      if (job.assignedToId) {
        notifications.push({
          userId: job.assignedToId,
          title: 'Dispute Resolved',
          message: outcomeMessages[outcome].provider,
          type: 'admin_action',
          relatedId: job._id,
          relatedModel: 'Job',
          priority: 'high',
          data: { jobId: job._id.toString(), outcome },
        });
      }
      if (notifications.length) {
        await Notification.insertMany(notifications);
      }
    } catch (notifyErr) {
      console.error('[resolveDispute] Notification error:', notifyErr);
    }

    // Post a summary into each party's own dispute support thread and close
    // it — the ruling ends the mediation, so the threads become read-only
    // transcripts (shown under Messages → Archived in the app) with the
    // outcome recorded on the ticket.
    await closeDisputeThreadsForJob(job, {
      outcome,
      adminObjectId,
      adminName: req.admin?.name || req.user?.username || 'Support Agent',
      summaryFor: (isClient) =>
        isClient ? outcomeMessages[outcome].client : outcomeMessages[outcome].provider,
    });

    const updatedJob = await Job.findById(jobId)
      .populate('userId', 'name email userType profileImage')
      .populate('assignedToId', 'name email userType profileImage')
      .lean();

    try {
      const { io } = require('../../server');
      io.to('admin').emit('job:updated', { job: updatedJob, updateType: 'dispute-resolved' });
    } catch (socketErr) {
      // best-effort
    }

    res.json({
      success: true,
      job: updatedJob,
      outcome,
      refundedAmount,
      draftId,
      escrow: escrowOutcome
        ? {
            scheduledFor: escrowOutcome.scheduledFor,
            originalScheduledFor: escrowOutcome.originalScheduledFor,
            releasedImmediately: escrowOutcome.releasedImmediately,
            resumed: Boolean(escrowOutcome.originalScheduledFor),
          }
        : null,
      rebookDeadlineAt: rebookDeadline || null,
      // How the held amount was split, so the admin UI can confirm the exact
      // figures it just committed rather than recomputing them client-side.
      noShowSettlement,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute', message: error.message });
  } finally {
    session.endSession();
  }
};

const assignJobToProvider = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { providerId } = req.body;
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        assignedToId: providerId,
        status: 'in_progress'
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Application.findOneAndUpdate(
      { job: jobId, provider: providerId },
      { status: 'accepted' }
    );
    
    await Application.updateMany(
      { job: jobId, provider: { $ne: providerId } },
      { status: 'rejected' }
    );
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: 'assigned to provider'
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error assigning job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to assign job', message: error.message });
  }
};

const getJobStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const openJobs = await Job.countDocuments({ status: 'open' });
    const inProgressJobs = await Job.countDocuments({ status: 'in_progress' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });
    const cancelledJobs = await Job.countDocuments({ status: 'cancelled' });
    
    const totalApplications = await Application.countDocuments();
    const pendingApplications = await Application.countDocuments({ status: 'pending' });
    
    res.json({
      totalJobs,
      openJobs,
      inProgressJobs,
      completedJobs,
      cancelledJobs,
      totalApplications,
      pendingApplications
    });
  } catch (error) {
    console.error('Error fetching job stats:', error);
    res.status(500).json({ error: 'Failed to fetch job stats' });
  }
};

const hideJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('🔒 Hide Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      {
        isHidden: true,
        hiddenAt: new Date(),
        hiddenBy: adminName
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const notificationMessage = reason
      ? `Your job "${job.title}" has been hidden by admin. Reason: ${reason}`
      : `Your job "${job.title}" has been hidden by admin for review.`;
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Hidden by Admin',
      message: notificationMessage,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'high',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        hiddenBy: adminName,
        hiddenAt: new Date(),
        reason: reason || 'No reason provided'
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_hidden');
      const activityLog = await createActivityLog(
        adminId,
        'job_hidden',
        `Hidden job "${job.title}" posted by ${job.userId.name}${reason ? `. Reason: ${reason}` : ''}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name,
            reason: reason || 'No reason provided'
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: 'hidden'
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error hiding job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to hide job', message: error.message });
  }
};

const unhideJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('🔓 Unhide Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      {
        isHidden: false,
        hiddenAt: null,
        hiddenBy: null
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Restored',
      message: `Your job "${job.title}" has been restored and is now visible.`,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'medium',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        restoredBy: adminName,
        restoredAt: new Date()
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_unhidden');
      const activityLog = await createActivityLog(
        adminId,
        'job_unhidden',
        `Restored job "${job.title}" posted by ${job.userId.name}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const applicationCount = await Application.countDocuments({ job: jobId });
    
    let locationDisplay = 'Location not specified';
    try {
      if (job.location && typeof job.location === 'object') {
        locationDisplay = job.location?.address || job.location?.city || 'Location not specified';
      } else if (job.location && typeof job.location === 'string') {
        locationDisplay = job.location;
      }
    } catch (err) {
      console.error('Error parsing location for job:', jobId, err);
    }
    
    const jobWithData = {
      ...job,
      user: job.userId,
      assignedTo: job.assignedToId,
      applicationCount,
      locationDisplay
    };
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: jobWithData,
      updateType: 'unhidden'
    });
    
    res.json(jobWithData);
  } catch (error) {
    console.error('Error unhiding job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to unhide job', message: error.message });
  }
};

const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('🗑️ Delete Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: adminName
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Removed by Admin',
      message: `Your job "${job.title}" has been removed by administration.`,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'high',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        deletedBy: adminName,
        deletedAt: new Date()
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_deleted');
      const activityLog = await createActivityLog(
        adminId,
        'job_deleted',
        `Deleted job "${job.title}" posted by ${job.userId.name}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: { _id: job._id },
      updateType: 'deleted'
    });
    
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to delete job', message: error.message });
  }
};

const restoreJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.admin?.id;
    const adminName = req.admin?.name || 'Admin';
    
    console.log('♻️ Restore Job - Admin Info:', { adminId, adminName, reqAdmin: req.admin });
    
    const job = await Job.findByIdAndUpdate(
      jobId,
      {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        isHidden: false,
        hiddenAt: null,
        hiddenBy: null
      },
      { new: true }
    )
    .populate('userId', 'name email userType profileImage')
    .populate('assignedToId', 'name email userType profileImage')
    .lean();
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await Notification.create({
      userId: job.userId._id,
      title: 'Job Restored',
      message: `Your job "${job.title}" has been restored by administration and is now visible.`,
      type: 'admin_action',
      relatedId: job._id,
      relatedModel: 'Job',
      priority: 'medium',
      data: {
        jobId: job._id,
        jobTitle: job.title,
        restoredBy: adminName,
        restoredAt: new Date()
      }
    });
    
    if (adminId) {
      console.log('📝 Creating activity log for job_restored');
      const activityLog = await createActivityLog(
        adminId,
        'job_restored',
        `Restored job "${job.title}" posted by ${job.userId.name}`,
        {
          targetType: 'job',
          targetId: job._id,
          targetModel: 'Job',
          metadata: {
            jobTitle: job.title,
            userId: job.userId._id,
            userName: job.userId.name
          }
        }
      );
      console.log('✅ Activity log created:', activityLog?._id);
    } else {
      console.warn('⚠️ No adminId found, activity log NOT created');
    }
    
    const { io } = require('../../server');
    io.to('admin').emit('job:updated', {
      job: { _id: job._id },
      updateType: 'restored'
    });
    
    res.json({ success: true, message: 'Job restored successfully' });
  } catch (error) {
    console.error('Error restoring job:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to restore job', message: error.message });
  }
};

module.exports = {
  getJobs,
  getJobDetails,
  updateJobStatus,
  forceCancelJob,
  resolveDispute,
  assignJobToProvider,
  getJobStats,
  hideJob,
  unhideJob,
  deleteJob,
  restoreJob
};
