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
const escrowService = require('../services/escrowService');
const { createActivityLog } = require('./activityLogController');

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
    const isUrgent = req.query.isUrgent;
    
    let query = {};
    
    // Filter archived jobs
    const archived = req.query.archived === 'true';
    const archiveType = req.query.archiveType;
    
    if (archived) {
      query.archived = true;
      if (archiveType && (archiveType === 'hidden' || archiveType === 'removed')) {
        query.archiveType = archiveType;
      }
    } else {
      query.archived = { $ne: true };
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
    
    if (isUrgent === 'true') {
      query.isUrgent = true;
    }
    
    // Fetch jobs and populate user virtuals
    const jobs = await Job.find(query)
      .populate('userId', 'name email userType profileImage')
      .populate('assignedToId', 'name email userType profileImage')
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
      
      return {
        ...job,
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
      .populate('userId', 'name firstName lastName email phone userType profileImage location barangay city isVerified')
      .populate('assignedToId', 'name email phone userType profileImage')
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
          clientWallet.heldBalance = Math.max(0, (clientWallet.heldBalance || 0) - refundedAmount);
          clientWallet.availableBalance = (clientWallet.availableBalance || 0) + refundedAmount;
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
};

const DISPUTE_OUTCOME_LABELS = {
  pay_provider: 'Provider paid',
  refund_client: 'Client refunded',
  rebook: 'Booking continued',
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
 *  - pay_provider: the client's held payment is released the same way normal
 *    job completion releases it — through the 5-day escrow hold
 *    (escrowService.scheduleEscrowRelease), never an immediate transfer.
 *  - refund_client: full refund, job cancelled, and reverted to a Draft
 *    (with a sourceJobId trail) so the client can republish without
 *    re-entering details.
 *  - rebook: no money moves; the job's completion-confirmation state resets
 *    so the same provider can carry on and either party can confirm again.
 * Every outcome archives the dispute into completionStatus.disputeHistory
 * before clearing the live dispute field, so a rebooked job's next dispute
 * (if any) shows an admin the full pattern, not just the latest complaint.
 */
const resolveDispute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { jobId } = req.params;
    const { outcome, note } = req.body || {};
    const adminId = req.user?.id;
    const adminObjectId = adminId && mongoose.Types.ObjectId.isValid(adminId) ? adminId : null;

    const resolution = DISPUTE_RESOLUTION_MAP[outcome];
    if (!resolution) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'outcome must be one of: pay_provider, refund_client, rebook' });
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

    const disputeSnapshot = job.completionStatus.dispute;
    let refundedAmount = 0;
    let draftId = null;

    if (job.completionStatus?.paymentReleased && outcome !== 'rebook') {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Payment for this job has already been released — neither a refund nor a second payout is possible. Resolve with rebook or handle manually.',
      });
    }

    if (outcome === 'rebook' && ['cancelled', 'completed'].includes(job.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        error: `Cannot rebook a ${job.status} job — the booking is no longer active.`,
      });
    }

    if (outcome === 'pay_provider') {
      const heldTransactionId = job.paymentDetails?.heldTransaction;
      const heldTransaction = heldTransactionId
        ? await Transaction.findById(heldTransactionId).session(session)
        : null;

      if (!heldTransaction || heldTransaction.status !== 'held') {
        await session.abortTransaction();
        return res.status(400).json({ error: 'No held payment found for this job — cannot release funds to the provider.' });
      }

      const clientWallet = await Wallet.findOne({ userId: job.userId }).session(session);
      if (clientWallet && clientWallet.heldBalance >= heldTransaction.amount) {
        clientWallet.heldBalance -= heldTransaction.amount;
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
      job.completionStatus.paymentReleased = true;
      job.completionStatus.paymentReleasedAt = new Date();
      job.paymentDetails = job.paymentDetails || {};
      job.paymentDetails.isPaid = true;
      await job.save({ session });

      await escrowService.scheduleEscrowRelease(job._id, new Date(), session);
    } else if (outcome === 'refund_client') {
      const heldTransactionId = job.paymentDetails?.heldTransaction;
      const heldTransaction = heldTransactionId
        ? await Transaction.findById(heldTransactionId).session(session)
        : null;

      // Never notify "you've been refunded ₱0" — if there is no held payment
      // to return, refuse instead of silently cancelling with no refund.
      if (!heldTransaction || heldTransaction.status !== 'held') {
        await session.abortTransaction();
        return res.status(400).json({
          error: 'No held payment found for this job — there is nothing to refund. Resolve with rebook or handle manually.',
        });
      }

      if (heldTransaction && heldTransaction.status === 'held') {
        refundedAmount = heldTransaction.amount;

        const clientWallet = await Wallet.findOne({ userId: job.userId }).session(session);
        if (clientWallet) {
          clientWallet.heldBalance = Math.max(0, (clientWallet.heldBalance || 0) - refundedAmount);
          clientWallet.availableBalance = (clientWallet.availableBalance || 0) + refundedAmount;
          clientWallet.lastActivity = new Date();
          await clientWallet.save({ session });
        }

        heldTransaction.status = 'refunded';
        heldTransaction.completedAt = heldTransaction.completedAt || new Date();
        await heldTransaction.save({ session });

        await Transaction.create([{
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
        isUrgent: job.isUrgent || false,
        serviceTier: job.serviceTier || 'standard',
        paymentMethod: 'wallet',
        sourceJobId: job._id,
      }], { session });
      draftId = draft._id;

      job.status = 'cancelled';
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
    } else if (outcome === 'rebook') {
      job.completionStatus.clientConfirmed = false;
      job.completionStatus.providerConfirmed = false;
      job.completionStatus.clientConfirmedAt = null;
      job.completionStatus.providerConfirmedAt = null;
      job.completionStatus.neitherConfirmedReminderSentAt = null;
      await job.save({ session });
    }

    job.completionStatus.disputeHistory = job.completionStatus.disputeHistory || [];
    job.completionStatus.disputeHistory.push({
      raisedBy: disputeSnapshot.raisedBy,
      raisedAt: disputeSnapshot.raisedAt,
      reason: disputeSnapshot.reason,
      resolvedAt: new Date(),
      resolvedBy: adminObjectId,
      resolution,
    });
    job.completionStatus.dispute = {
      isActive: false,
      raisedBy: null,
      raisedAt: null,
      reason: null,
      resolvedAt: new Date(),
      resolvedBy: adminObjectId,
      resolution,
      internalNotes: disputeSnapshot.internalNotes || [],
    };

    await job.save({ session });
    await session.commitTransaction();

    try {
      await createActivityLog(adminId, 'dispute_resolved', `Resolved dispute on job "${job.title}": ${outcome}`, {
        targetType: 'job',
        targetId: job._id.toString(),
        targetModel: 'Job',
        metadata: { outcome, resolution, note: note || null, refundedAmount, draftId },
      });
    } catch (activityErr) {
      console.error('[resolveDispute] Activity log error:', activityErr);
    }

    const outcomeMessages = {
      pay_provider: {
        client: `Your dispute for "${job.title}" was resolved: the provider has been paid. ${note ? `Admin note: ${note}` : ''}`,
        provider: `Your dispute for "${job.title}" was resolved in your favor. Payment will be released to your available balance after the standard 5-day hold.`,
      },
      refund_client: {
        client: `Your dispute for "${job.title}" was resolved: you've been refunded ₱${refundedAmount}. The job has been saved as a draft so you can repost it whenever you're ready.`,
        provider: `The dispute for "${job.title}" was resolved in the client's favor. No payment will be released, and the job has been cancelled.`,
      },
      rebook: {
        client: `Your dispute for "${job.title}" was resolved: the booking will continue with the same provider.`,
        provider: `The dispute for "${job.title}" was resolved: the booking will continue as planned.`,
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

    res.json({ success: true, job: updatedJob, outcome, refundedAmount, draftId });
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
    const urgentJobs = await Job.countDocuments({ isUrgent: true, status: { $in: ['open', 'in_progress'] } });
    
    const totalApplications = await Application.countDocuments();
    const pendingApplications = await Application.countDocuments({ status: 'pending' });
    
    res.json({
      totalJobs,
      openJobs,
      inProgressJobs,
      completedJobs,
      cancelledJobs,
      urgentJobs,
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
        archived: true,
        archiveType: 'hidden',
        archivedAt: new Date(),
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
        archived: false,
        archiveType: null,
        archivedAt: null,
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
        archived: true,
        archiveType: 'removed',
        archivedAt: new Date(),
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
        archived: false,
        archiveType: null,
        archivedAt: null,
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
