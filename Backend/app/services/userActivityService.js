const mongoose = require('mongoose');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const ActivityLog = require('../models/ActivityLog');
const CredentialVerification = require('../models/CredentialVerification');
const { OPEN_REPORT_STATUSES } = require('../constants/reportTaxonomy');
// Registered for the sake of the populate() calls below, which resolve 'User'
// by name and fail outright if nothing has loaded the model first.
require('../models/User');

/**
 * User Activity Service
 *
 * Answers "what has this one user actually done?" across every collection that
 * records a user action. The app's own ActivityFeed collection is empty in
 * production, so nothing here reads it — the timeline is derived from the
 * primary records (jobs, transactions, withdrawals, reviews, quotes, tickets)
 * that the Kayod server writes as a side effect of real user activity.
 *
 * Several of those collections have no Mongoose model in this admin app
 * (withdrawals, reviews, jobquotes, supporttickets). They are read through the
 * raw driver rather than adding models we would then have to keep in step with
 * kayod/server's schemas, since this service only ever reads them.
 */

// Money in: the user's wallet grew because they funded it themselves.
const TOP_UP_TYPES = ['xendit_topup', 'wallet_topup'];

// Statuses that mean the money actually moved, as opposed to an abandoned or
// still-running attempt. Kept separate so totals never count a cancelled
// top-up the user never paid for.
const SETTLED_STATUSES = ['completed'];
const PENDING_STATUSES = ['pending', 'processing', 'held', 'escrowed'];

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const rawCollection = (name) => mongoose.connection.db.collection(name);

/**
 * Transactions record their counterparties under two generations of field
 * names. Current documents use fromUserId/toUserId; the older fromUser/toUser
 * pair still exists in the schema, so every read matches both.
 */
const outgoingMatch = (userId) => ({ $or: [{ fromUserId: userId }, { fromUser: userId }] });
const incomingMatch = (userId) => ({ $or: [{ toUserId: userId }, { toUser: userId }] });

const isSettled = (entry) => SETTLED_STATUSES.includes(entry.status);
const isPending = (entry) => PENDING_STATUSES.includes(entry.status);
const sumAmount = (entries) =>
  entries.reduce(
    (total, entry) => total + (entry.netAmount != null ? entry.netAmount : entry.amount || 0),
    0
  );

const humanizeType = (type) =>
  String(type || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * What a job is actually worth. Quote-based jobs are posted with budget 0 and
 * only get a number once a quote is accepted, so a plain sum over `budget`
 * reports zero for the majority of real jobs. Mirrors the precedence the Jobs
 * page already uses client-side.
 */
const jobValue = (job) =>
  (job.budget > 0 ? job.budget : null) ??
  job.agreedPrice ??
  job.acceptedProvider?.agreedPrice ??
  job.paidAmount ??
  job.softLimitBudget ??
  0;

class UserActivityService {
  /**
   * Money summary for a single user: what they put in, what they took out,
   * what they earned and what they spent.
   */
  async getUserFinancials(userId) {
    const uid = toObjectId(userId);

    const [topUps, cashOuts, ledger] = await Promise.all([
      this._getTopUps(uid),
      this._getCashOuts(uid),
      this._getEarningsAndSpending(uid)
    ]);

    return {
      topUp: {
        total: sumAmount(topUps.filter(isSettled)),
        pending: sumAmount(topUps.filter(isPending)),
        count: topUps.filter(isSettled).length,
        entries: topUps
      },
      cashOut: {
        total: sumAmount(cashOuts.filter(isSettled)),
        pending: sumAmount(cashOuts.filter(isPending)),
        count: cashOuts.filter(isSettled).length,
        entries: cashOuts
      },
      earned: ledger.earned,
      spent: ledger.spent,
      feesPaid: ledger.feesPaid,
      refunded: ledger.refunded
    };
  }

  /**
   * Per-user top-up and cash-out totals for a page of the user list. Bounded to
   * the ids actually being rendered, so the list stays a fixed number of
   * queries per page rather than one per row.
   */
  async getFinancialTotalsForUsers(userIds) {
    if (!userIds || userIds.length === 0) return {};

    const ids = userIds.map(toObjectId);
    const totals = {};
    const bucket = (id) => {
      const key = String(id);
      if (!totals[key]) {
        totals[key] = { topUpTotal: 0, topUpPending: 0, cashOutTotal: 0, cashOutPending: 0 };
      }
      return totals[key];
    };

    // Withdrawals that carry a linked transaction would otherwise be counted
    // twice — once from the withdrawals collection and once from the
    // transaction it points at. The linked ids are excluded on the
    // transaction side below.
    const withdrawalDocs = await rawCollection('withdrawals')
      .find(
        { userId: { $in: ids } },
        { projection: { userId: 1, amount: 1, netAmount: 1, status: 1, transactionId: 1 } }
      )
      .toArray();

    const linkedTransactionIds = withdrawalDocs.map((w) => w.transactionId).filter(Boolean);

    const [topUpRows, withdrawalTxRows] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            type: { $in: TOP_UP_TYPES },
            $or: [{ toUserId: { $in: ids } }, { toUser: { $in: ids } }]
          }
        },
        {
          $group: {
            _id: { user: { $ifNull: ['$toUserId', '$toUser'] }, status: '$status' },
            amount: { $sum: '$amount' }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            type: 'withdrawal',
            _id: { $nin: linkedTransactionIds },
            $or: [{ fromUserId: { $in: ids } }, { fromUser: { $in: ids } }]
          }
        },
        {
          $group: {
            _id: { user: { $ifNull: ['$fromUserId', '$fromUser'] }, status: '$status' },
            amount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    topUpRows.forEach((row) => {
      const entry = bucket(row._id.user);
      if (SETTLED_STATUSES.includes(row._id.status)) entry.topUpTotal += row.amount;
      else if (PENDING_STATUSES.includes(row._id.status)) entry.topUpPending += row.amount;
    });

    withdrawalTxRows.forEach((row) => {
      const entry = bucket(row._id.user);
      if (SETTLED_STATUSES.includes(row._id.status)) entry.cashOutTotal += row.amount;
      else if (PENDING_STATUSES.includes(row._id.status)) entry.cashOutPending += row.amount;
    });

    withdrawalDocs.forEach((doc) => {
      const entry = bucket(doc.userId);
      const amount = doc.netAmount != null ? doc.netAmount : doc.amount || 0;
      if (doc.status === 'completed') entry.cashOutTotal += amount;
      else if (doc.status !== 'failed' && doc.status !== 'cancelled') entry.cashOutPending += amount;
    });

    return totals;
  }

  /**
   * Jobs this user posted, and jobs they were assigned to work on.
   */
  async getUserJobs(userId, { page = 1, limit = 20, role = 'all' } = {}) {
    const uid = toObjectId(userId);
    const skip = (page - 1) * limit;

    const roleMatch =
      {
        posted: { userId: uid },
        worked: { assignedToId: uid }
      }[role] || { $or: [{ userId: uid }, { assignedToId: uid }] };

    const [jobs, total, postedCount, workedCount, statusRows] = await Promise.all([
      Job.find(roleMatch)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email profileImage')
        .populate('assignedToId', 'name email profileImage')
        .lean(),
      Job.countDocuments(roleMatch),
      Job.countDocuments({ userId: uid }),
      Job.countDocuments({ assignedToId: uid }),
      Job.aggregate([
        { $match: { userId: uid } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            value: {
              $sum: {
                $ifNull: [
                  { $cond: [{ $gt: ['$budget', 0] }, '$budget', null] },
                  { $ifNull: ['$agreedPrice', { $ifNull: ['$paidAmount', 0] }] }
                ]
              }
            }
          }
        }
      ])
    ]);

    const byStatus = {};
    let postedValue = 0;
    statusRows.forEach((row) => {
      byStatus[row._id || 'unknown'] = row.count;
      postedValue += row.value || 0;
    });

    return {
      jobs: jobs.map((job) => ({
        ...job,
        // Which side of this job the user was on, so the UI does not have to
        // re-derive it from two populated ids.
        userRole: String(job.userId?._id || job.userId) === String(uid) ? 'poster' : 'provider',
        value: jobValue(job)
      })),
      summary: {
        posted: postedCount,
        worked: workedCount,
        postedValue,
        byStatus
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * A single merged timeline of everything the user did, newest first.
   *
   * Each source is queried for the first (page * limit) rows it could
   * contribute, then the merged list is sorted and sliced. Over-fetching by a
   * page is what makes the merge correct without a cross-collection union: any
   * row that could land on the requested page is guaranteed to be in hand.
   */
  /**
   * What clients said about this provider: the average, the 5→1 distribution,
   * per-category averages (quality, punctuality, …) and a page of reviews with
   * the client and job they came from.
   *
   * The `reviews` collection is owned by kayod/server and holds BOTH directions
   * — a provider reviewing a client is stored with the same providerId — so
   * only reviewerType 'client' counts here. That field defaults to 'client' in
   * the server's schema, so rows written before it existed count too.
   */
  async getProviderReviews(userId, { page = 1, limit = 10, rating } = {}) {
    const uid = toObjectId(userId);
    const base = { providerId: uid, reviewerType: { $ne: 'provider' } };
    const listMatch = rating ? { ...base, rating: Number(rating) } : base;
    const reviews = rawCollection('reviews');
    const round1 = (n) => Math.round((n || 0) * 10) / 10;

    const [summaryRows, total, rows] = await Promise.all([
      reviews
        .aggregate([
          { $match: base },
          {
            $facet: {
              stats: [{ $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }],
              distribution: [{ $group: { _id: { $round: ['$rating', 0] }, count: { $sum: 1 } } }],
              categories: [
                { $unwind: '$categoryRatings' },
                {
                  $group: {
                    _id: '$categoryRatings.key',
                    label: { $first: '$categoryRatings.label' },
                    average: { $avg: '$categoryRatings.value' },
                    count: { $sum: 1 }
                  }
                },
                { $sort: { _id: 1 } }
              ]
            }
          }
        ])
        .toArray(),
      reviews.countDocuments(listMatch),
      reviews
        .aggregate([
          { $match: listMatch },
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'clientId',
              foreignField: '_id',
              pipeline: [{ $project: { name: 1, profileImage: 1 } }],
              as: 'client'
            }
          },
          {
            $lookup: {
              from: 'jobs',
              localField: 'jobId',
              foreignField: '_id',
              pipeline: [{ $project: { title: 1 } }],
              as: 'job'
            }
          }
        ])
        .toArray()
    ]);

    const { stats = [], distribution = [], categories = [] } = summaryRows[0] || {};
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach(({ _id, count }) => {
      const star = Math.min(5, Math.max(1, Number(_id) || 1));
      starCounts[star] += count;
    });

    return {
      summary: {
        average: stats[0] ? round1(stats[0].average) : 0,
        count: stats[0]?.count || 0,
        distribution: starCounts,
        categories: categories.map((category) => ({
          key: category._id,
          label: category.label || humanizeType(category._id),
          average: round1(category.average),
          count: category.count
        }))
      },
      reviews: rows.map((row) => ({
        _id: row._id,
        rating: row.rating,
        review: row.review || '',
        categoryRatings: row.categoryRatings || [],
        images: row.images || [],
        createdAt: row.createdAt,
        client: row.client[0] || null,
        job: row.job[0] || null
      })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
  }

  /**
   * Trust signals that live outside the user document: reports filed against
   * and by the user, and their support tickets. Counts only.
   *
   * Reports come from two collections: `reports` (a user, message, review…
   * reported — the target is reportedUserId) and `reportedposts` (a job
   * reported — the target is the job's poster). Support likewise spans
   * `chatsupports` (ObjectId userId) and `supporttickets` (string userId).
   */
  async getUserStanding(userId) {
    const uid = toObjectId(userId);
    const either = { $in: [uid, String(uid)] };
    const open = { $in: OPEN_REPORT_STATUSES };

    const [
      reportsAgainst,
      reportsAgainstOpen,
      postsAgainst,
      postsAgainstOpen,
      reportsFiled,
      postsFiled,
      chats,
      chatsOpen,
      tickets,
      ticketsOpen
    ] = await Promise.all([
      rawCollection('reports').countDocuments({ reportedUserId: uid }),
      rawCollection('reports').countDocuments({ reportedUserId: uid, status: open }),
      rawCollection('reportedposts').countDocuments({ $or: [{ jobPosterId: uid }, { reportedUserId: uid }] }),
      rawCollection('reportedposts').countDocuments({ $or: [{ jobPosterId: uid }, { reportedUserId: uid }], status: open }),
      rawCollection('reports').countDocuments({ reportedBy: uid }),
      rawCollection('reportedposts').countDocuments({ reportedBy: uid }),
      rawCollection('chatsupports').countDocuments({ userId: uid }),
      rawCollection('chatsupports').countDocuments({ userId: uid, status: 'open' }),
      rawCollection('supporttickets').countDocuments({ userId: either }),
      rawCollection('supporttickets').countDocuments({ userId: either, status: { $nin: ['closed', 'resolved'] } })
    ]);

    return {
      reportsAgainst: { total: reportsAgainst + postsAgainst, open: reportsAgainstOpen + postsAgainstOpen },
      reportsFiled: reportsFiled + postsFiled,
      support: { total: chats + tickets, open: chatsOpen + ticketsOpen }
    };
  }

  async getUserActivity(userId, { page = 1, limit = 25, types } = {}) {
    const uid = toObjectId(userId);
    const ceiling = page * limit;
    const wanted = types && types.length ? new Set(types) : null;
    const include = (type) => !wanted || wanted.has(type);

    // A cash-out can exist as both a withdrawal document and the transaction it
    // points at. The withdrawal is the richer record, so it is the one shown —
    // and its transaction is excluded here, or the same cash-out would appear
    // twice in the timeline the way it would once have counted twice in the
    // totals.
    const withdrawals = include('money') ? await this._fetchWithdrawals(uid, ceiling) : [];
    const linkedTransactionIds = withdrawals.map((w) => w.transactionId).filter(Boolean);

    const sources = await Promise.all([
      include('job') ? this._jobEvents(uid, ceiling) : [],
      include('money') ? this._transactionEvents(uid, ceiling, linkedTransactionIds) : [],
      this._withdrawalEvents(withdrawals),
      include('quote') ? this._quoteEvents(uid, ceiling) : [],
      include('review') ? this._reviewEvents(uid, ceiling) : [],
      include('verification') ? this._verificationEvents(uid, ceiling) : [],
      include('support') ? this._supportEvents(uid, ceiling) : [],
      include('report') ? this._reportEvents(uid, ceiling) : [],
      include('admin') ? this._adminEvents(uid, ceiling) : []
    ]);

    const merged = sources
      .flat()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const start = (page - 1) * limit;

    return {
      events: merged.slice(start, start + limit),
      pagination: {
        page,
        limit,
        // The number of rows actually in hand, not a collection-wide total:
        // the client pages forward on hasMore rather than a count no single
        // query here can produce.
        loaded: merged.length,
        hasMore: merged.length > start + limit
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * Financial sources
   * ------------------------------------------------------------------ */

  async _getTopUps(uid) {
    const rows = await Transaction.find({
      type: { $in: TOP_UP_TYPES },
      ...incomingMatch(uid)
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return rows.map((tx) => ({
      _id: tx._id,
      amount: tx.amount,
      status: tx.status,
      method: tx.paymentMethod || (tx.type === 'xendit_topup' ? 'xendit' : 'wallet'),
      description: tx.description,
      reference: tx.xenditId || null,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt || tx.processedAt || null
    }));
  }

  async _getCashOuts(uid) {
    const withdrawals = await rawCollection('withdrawals')
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const linkedIds = withdrawals.map((w) => w.transactionId).filter(Boolean);

    // Only withdrawal transactions with no withdrawal document of their own,
    // so a single cash-out is never listed (or summed) twice.
    const orphanTransactions = await Transaction.find({
      type: 'withdrawal',
      _id: { $nin: linkedIds },
      ...outgoingMatch(uid)
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const fromWithdrawals = withdrawals.map((w) => ({
      _id: w._id,
      amount: w.amount,
      netAmount: w.netAmount != null ? w.netAmount : w.amount,
      fee: w.processingFee || 0,
      status: w.status,
      destination: w.destination || null,
      destinationType: w.destinationType || null,
      accountNumber: w.accountNumber || null,
      accountHolder: w.accountHolder || null,
      method: w.withdrawalMethod || null,
      reference: w.referenceId || null,
      createdAt: w.createdAt,
      completedAt: w.completedAt || w.processedAt || null
    }));

    const fromTransactions = orphanTransactions.map((tx) => ({
      _id: tx._id,
      amount: tx.amount,
      netAmount: tx.amount,
      fee: tx.platformFee || 0,
      status: tx.status,
      destination: tx.description || null,
      destinationType: null,
      accountNumber: null,
      accountHolder: null,
      method: tx.paymentMethod || null,
      reference: tx.xenditId || null,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt || tx.processedAt || null
    }));

    return [...fromWithdrawals, ...fromTransactions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  async _getEarningsAndSpending(uid) {
    const [incoming, outgoing] = await Promise.all([
      Transaction.aggregate([
        { $match: { status: { $in: SETTLED_STATUSES }, ...incomingMatch(uid) } },
        { $group: { _id: '$type', amount: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { status: { $in: SETTLED_STATUSES }, ...outgoingMatch(uid) } },
        { $group: { _id: '$type', amount: { $sum: '$amount' } } }
      ])
    ]);

    const sumExcept = (rows, excluded) =>
      rows.filter((r) => !excluded.includes(r._id)).reduce((total, r) => total + r.amount, 0);
    const sumOf = (rows, wantedTypes) =>
      rows.filter((r) => wantedTypes.includes(r._id)).reduce((total, r) => total + r.amount, 0);

    return {
      // Everything that landed in the wallet other than the user's own top-ups.
      earned: sumExcept(incoming, TOP_UP_TYPES),
      // Everything that left the wallet other than a cash-out, which is
      // reported on its own.
      spent: sumExcept(outgoing, ['withdrawal']),
      feesPaid: sumOf(outgoing, ['platform_fee', 'fee_payment', 'cancellation_fee']),
      refunded: sumOf(incoming, ['refund', 'refund_request', 'job_budget_refund'])
    };
  }

  /* ------------------------------------------------------------------ *
   * Timeline sources
   * ------------------------------------------------------------------ */

  async _jobEvents(uid, ceiling) {
    const jobs = await Job.find({ $or: [{ userId: uid }, { assignedToId: uid }] })
      .sort({ createdAt: -1 })
      .limit(ceiling)
      .select(
        'title category status budget agreedPrice acceptedProvider paidAmount softLimitBudget userId assignedToId createdAt'
      )
      .lean();

    return jobs.map((job) => {
      const posted = String(job.userId) === String(uid);
      return {
        id: `job-${job._id}`,
        type: 'job',
        action: posted ? 'job_posted' : 'job_assigned',
        title: posted ? 'Posted a job' : 'Assigned to a job',
        description: job.title,
        amount: jobValue(job) || null,
        status: job.status,
        category: job.category || null,
        targetId: job._id,
        targetType: 'job',
        timestamp: job.createdAt
      };
    });
  }

  async _transactionEvents(uid, ceiling, linkedTransactionIds = []) {
    const transactions = await Transaction.find({
      _id: { $nin: linkedTransactionIds },
      $or: [...outgoingMatch(uid).$or, ...incomingMatch(uid).$or]
    })
      .sort({ createdAt: -1 })
      .limit(ceiling)
      .lean();

    return transactions.map((tx) => {
      const isIncoming = String(tx.toUserId || tx.toUser || '') === String(uid);
      const isTopUp = TOP_UP_TYPES.includes(tx.type);
      return {
        id: `tx-${tx._id}`,
        type: 'money',
        action: isTopUp ? 'top_up' : tx.type === 'withdrawal' ? 'cash_out' : tx.type,
        title: isTopUp
          ? 'Topped up wallet'
          : tx.type === 'withdrawal'
            ? 'Cashed out'
            : `${isIncoming ? 'Received' : 'Paid'} — ${humanizeType(tx.type)}`,
        description: tx.description,
        amount: tx.amount,
        direction: isIncoming ? 'in' : 'out',
        status: tx.status,
        targetId: tx._id,
        targetType: 'transaction',
        jobId: tx.jobId || null,
        timestamp: tx.createdAt
      };
    });
  }

  async _fetchWithdrawals(uid, ceiling) {
    return rawCollection('withdrawals')
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(ceiling)
      .toArray();
  }

  _withdrawalEvents(withdrawals) {
    return withdrawals.map((w) => ({
      id: `wd-${w._id}`,
      type: 'money',
      action: 'cash_out',
      title: 'Cashed out',
      description: [w.destination, w.accountNumber].filter(Boolean).join(' · ') || 'Withdrawal',
      amount: w.netAmount != null ? w.netAmount : w.amount,
      direction: 'out',
      status: w.status,
      // Pointed at the transaction behind the withdrawal where there is one, so
      // the row opens the transaction detail. A withdrawal with no transaction
      // of its own has no view to open, and stays inert.
      targetId: w.transactionId || null,
      targetType: w.transactionId ? 'transaction' : 'withdrawal',
      timestamp: w.createdAt
    }));
  }

  async _quoteEvents(uid, ceiling) {
    // Quotes live inside a per-job container document, so the provider's own
    // quote has to be unwound out of the array before it can be dated.
    const rows = await rawCollection('jobquotes')
      .aggregate([
        { $match: { 'quotes.providerId': uid } },
        { $unwind: '$quotes' },
        { $match: { 'quotes.providerId': uid } },
        { $sort: { 'quotes.submittedAt': -1 } },
        { $limit: ceiling },
        {
          $lookup: {
            from: 'jobs',
            localField: 'jobId',
            foreignField: '_id',
            as: 'job'
          }
        }
      ])
      .toArray();

    return rows.map((row) => ({
      id: `quote-${row.quotes._id}`,
      type: 'quote',
      action: 'quote_submitted',
      title: 'Submitted a quote',
      description: row.job?.[0]?.title || 'Job no longer available',
      amount: row.quotes.amount || null,
      status: row.quotes.status,
      targetId: row.jobId,
      targetType: 'job',
      timestamp: row.quotes.submittedAt || row.createdAt
    }));
  }

  async _reviewEvents(uid, ceiling) {
    const reviews = await rawCollection('reviews')
      .find({ $or: [{ clientId: uid }, { providerId: uid }] })
      .sort({ createdAt: -1 })
      .limit(ceiling)
      .toArray();

    return reviews.map((review) => {
      // Both directions share clientId/providerId; reviewerType says who wrote
      // it ('client' by default in kayod/server's schema). Without it, a provider's
      // review of a client read as the client having written it.
      const author = review.reviewerType === 'provider' ? review.providerId : review.clientId;
      const wrote = String(author) === String(uid);
      return {
        id: `review-${review._id}`,
        type: 'review',
        action: wrote ? 'review_given' : 'review_received',
        title: wrote ? 'Left a review' : 'Received a review',
        description: review.review || `${review.rating}-star rating`,
        rating: review.rating,
        targetId: review.jobId,
        targetType: 'job',
        timestamp: review.createdAt
      };
    });
  }

  async _verificationEvents(uid, ceiling) {
    const verifications = await CredentialVerification.find({ userId: uid })
      .sort({ submittedAt: -1 })
      .limit(ceiling)
      .lean();

    return verifications.map((v) => ({
      id: `verif-${v._id}`,
      type: 'verification',
      action: 'verification_submitted',
      title: 'Submitted credentials for verification',
      description: `Status: ${v.status}`,
      status: v.status,
      targetId: v._id,
      targetType: 'verification',
      timestamp: v.submittedAt || v.createdAt
    }));
  }

  async _supportEvents(uid, ceiling) {
    // Support has two generations of storage and both still hold recent
    // tickets. Only `chatsupports` is served by an admin endpoint — the Support
    // Center reads it and nothing reads `supporttickets` — so the two are
    // tagged differently: a chatsupport row opens its conversation, a
    // supportticket row is recorded but has nothing to open yet.
    const [chats, tickets] = await Promise.all([
      rawCollection('chatsupports')
        .find({ userId: uid })
        .sort({ createdAt: -1 })
        .limit(ceiling)
        .toArray(),
      rawCollection('supporttickets')
        // This collection stores userId as a plain string, not an ObjectId —
        // it is the only one of the raw collections read here that does, and
        // matching only the ObjectId silently returned nothing for every user.
        .find({ userId: { $in: [uid, String(uid)] } })
        .sort({ createdAt: -1 })
        .limit(ceiling)
        .toArray()
    ]);

    const toEvent = (t, subject, targetType) => ({
      id: `support-${t._id}`,
      type: 'support',
      action: 'support_ticket',
      title: 'Opened a support ticket',
      description: subject || 'Support request',
      status: t.status,
      targetId: t._id,
      targetType,
      timestamp: t.createdAt
    });

    return [
      ...chats.map((t) => toEvent(t, t.subject, 'support')),
      ...tickets.map((t) => toEvent(t, t.title, 'support_legacy'))
    ];
  }

  async _reportEvents(uid, ceiling) {
    const reports = await rawCollection('reports')
      .find({ $or: [{ reportedBy: uid }, { jobPosterId: uid }] })
      .sort({ createdAt: -1 })
      .limit(ceiling)
      .toArray();

    return reports.map((report) => {
      const filed = String(report.reportedBy) === String(uid);
      return {
        id: `report-${report._id}`,
        type: 'report',
        action: filed ? 'report_filed' : 'report_received',
        title: filed ? 'Reported a job' : 'A job of theirs was reported',
        description: report.reason || report.comment || 'Report',
        status: report.status,
        targetId: report.jobId,
        targetType: 'job',
        timestamp: report.createdAt
      };
    });
  }

  async _adminEvents(uid, ceiling) {
    const logs = await ActivityLog.find({ targetId: uid, targetModel: 'User' })
      .sort({ createdAt: -1 })
      .limit(ceiling)
      .populate('adminId', 'name email')
      .lean();

    return logs.map((log) => ({
      id: `admin-${log._id}`,
      type: 'admin',
      action: log.actionType,
      title: 'Admin action',
      description: log.description,
      actor: log.adminId?.name || 'Admin',
      metadata: log.metadata || {},
      targetId: log.targetId,
      targetType: 'user',
      timestamp: log.createdAt
    }));
  }
}

module.exports = new UserActivityService();
