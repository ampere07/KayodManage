import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Shield,
  Clock,
  Ban,
  UserX,
  AlertCircle,
  Trash2,
  Star,
  Scale,
  FileText
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { usersService, jobsService, transactionsService, supportService } from '../../services';
import { settingsService } from '../../services/settingsService';
import { useUserJobs, useUserReviews } from '../../hooks/useUsers';
import { UserReviewsTab } from '../Users/ProviderReviews';
import UserProfileDetails from '../Users/UserProfileDetails';
import {
  UserActivityTab,
  UserJobsTab,
  UserMoneyTab
} from '../Users/UserHistoryTabs';
import type { HistoryTarget } from '../Users/UserHistoryTabs';
import RestrictionDurationPicker, {
  EMPTY_DURATION,
  durationInDays
} from '../Users/RestrictionDurationPicker';
import type { DurationChoice } from '../Users/RestrictionDurationPicker';
import JobDetailsModal from './JobDetailsModal';
import TransactionDetailsModal from './TransactionDetailsModal';
import SupportConversationModal from './SupportConversationModal';
import type {
  User,
  Verification,
  PenaltyData,
  LegalAcceptance,
  RestrictionType,
  JobCategory
} from '../../types';
import UserTypeBadge from '../UI/UserTypeBadge';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import toast from 'react-hot-toast';
import { SidebarContext } from '../Layout/Layout';

// Matches the colour of each action's footer button, so the confirm step reads
// as the same action the admin picked.
const ACTION_STYLE = {
  restrict: { text: 'text-orange-600', button: 'bg-orange-600 hover:bg-orange-700', pastTense: 'restricted' },
  suspend: { text: 'text-yellow-600', button: 'bg-yellow-600 hover:bg-yellow-700', pastTense: 'suspended' },
  ban: { text: 'text-red-600', button: 'bg-red-600 hover:bg-red-700', pastTense: 'banned' },
} as const;

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

/**
 * How each kind of sanction is presented. Keyed by restrictionDetails.type,
 * which the server sets alongside accountStatus, so a ban never reads with the
 * softer wording of a temporary restriction.
 */
const RESTRICTION_PRESENTATION: Record<
  RestrictionType,
  { label: string; panel: string; accent: string; body: string }
> = {
  restricted: {
    label: 'Account Restricted',
    panel: 'bg-amber-50 border-amber-200',
    accent: 'text-amber-700',
    body: 'text-amber-900'
  },
  suspended: {
    label: 'Account Suspended',
    panel: 'bg-orange-50 border-orange-200',
    accent: 'text-orange-700',
    body: 'text-orange-900'
  },
  banned: {
    label: 'Account Banned',
    panel: 'bg-red-50 border-red-200',
    accent: 'text-red-700',
    body: 'text-red-900'
  },
  deleted: {
    label: 'Account Deleted',
    panel: 'bg-gray-100 border-gray-300',
    accent: 'text-gray-700',
    body: 'text-gray-900'
  }
};

/**
 * The panel answers four separate questions, and an admin usually arrives with
 * only one of them. Splitting them into tabs keeps the profile readable and,
 * more importantly, keeps the history queries from running on every open.
 */
type DetailTab = 'profile' | 'reviews' | 'activity' | 'jobs' | 'money';

const DETAIL_TABS: { key: DetailTab; label: string; providersOnly?: boolean }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'reviews', label: 'Reviews', providersOnly: true },
  { key: 'activity', label: 'Activity' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'money', label: 'Money' }
];

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onVerify: (userId: string, isVerified: boolean) => void;
  onAction: (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict' | 'delete', duration?: number, reason?: string) => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  isOpen,
  onClose,
  user,
  onVerify,
  onAction
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('profile');
  // The job or transaction an activity row points at, opened on top of this
  // panel so the admin keeps their place in the user's history.
  const [openTarget, setOpenTarget] = useState<
    | { type: 'job'; data: any }
    | { type: 'transaction'; data: any }
    | { type: 'support'; data: any }
    | null
  >(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<Verification | null>(null);
  // What this user has affirmed, and to which version of the agreements.
  // The one thing support needs when a user disputes a clause.
  const [legalAcceptances, setLegalAcceptances] = useState<LegalAcceptance[]>([]);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<'ban' | 'suspend' | 'restrict' | 'unrestrict' | 'delete' | null>(null);
  const [duration, setDuration] = useState<DurationChoice>(EMPTY_DURATION);
  const [reason, setReason] = useState<string>('');
  const [penaltyData, setPenaltyData] = useState<PenaltyData>({
    totalPenalties: 0,
    activeWarnings: 0,
    lastPenalty: null
  });
  const [loadingPenalties, setLoadingPenalties] = useState(false);
  const [restrictionTimer, setRestrictionTimer] = useState<string | null>(null);
  const [restrictedByAdmin, setRestrictedByAdmin] = useState<{ _id: string; name: string } | null>(null);
  const [loadingRestrictedBy, setLoadingRestrictedBy] = useState(false);
  const { setIsHeaderHidden } = React.useContext(SidebarContext);

  // Profile "at a glance" data. The Rating tile only needs the review summary,
  // so one review is enough; jobs counts are only fetched while Profile is open.
  const isProviderUser = user?.userType === 'provider';
  const glanceJobs = useUserJobs(user?._id, { page: 1, limit: 1, role: 'all' }, isOpen && activeTab === 'profile');
  const glanceReviews = useUserReviews(user?._id, { page: 1, limit: 1 }, isOpen && isProviderUser);
  const { data: categoriesData } = useQuery({
    queryKey: ['job-categories'],
    queryFn: () => settingsService.getJobCategories(),
    enabled: isOpen,
  });
  const jobCategories: JobCategory[] = categoriesData?.categories || [];

  useEffect(() => {
    if (activeTab === 'reviews' && !isProviderUser) setActiveTab('profile');
  }, [activeTab, isProviderUser]);

  // Re-runs when a nested detail closes: that modal resets the flag on unmount,
  // and this panel is still open and still wants the header hidden.
  useEffect(() => {
    if (setIsHeaderHidden) {
      setIsHeaderHidden(isOpen);
    }
    return () => {
      if (setIsHeaderHidden) {
        setIsHeaderHidden(false);
      }
    };
  }, [isOpen, openTarget, setIsHeaderHidden]);

  // Calculate remaining restriction time
  useEffect(() => {
    if (!user || !user.restrictionDetails?.expiresAt) {
      setRestrictionTimer(null);
      return;
    }

    const calculateTimeRemaining = () => {
      if (!user?.restrictionDetails?.expiresAt) {
        setRestrictionTimer(null);
        return;
      }
      const expiresAt = new Date(user.restrictionDetails.expiresAt);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs <= 0) {
        setRestrictionTimer('Expired');
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      let timeString = '';
      if (days > 0) timeString += `${days}d `;
      if (hours > 0) timeString += `${hours}h `;
      if (minutes > 0) timeString += `${minutes}m `;
      if (seconds > 0 && days === 0) timeString += `${seconds}s`;

      setRestrictionTimer(timeString.trim());
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (isOpen && user?.isVerified) {
      fetchVerificationDetails();
    }
    if (isOpen && user) {
      fetchPenaltyData();
      if (user.restrictionDetails?.restrictedBy) {
        const restrictedById = typeof user.restrictionDetails.restrictedBy === 'string'
          ? user.restrictionDetails.restrictedBy
          : user.restrictionDetails.restrictedBy._id;
        fetchRestrictedByAdmin(restrictedById);
      }
    }
    if (!isOpen) {
      setActiveTab('profile');
      setOpenTarget(null);
      setConfirmingAction(null);
      setDuration(EMPTY_DURATION);
      setReason('');
      setRestrictedByAdmin(null);
    }
  }, [isOpen, user]);

  const fetchVerificationDetails = async () => {
    if (!user?._id) return;

    setLoadingVerification(true);
    try {
      // Use getUserById which now includes verificationAudit to avoid extra API confusion
      const fullUser = await usersService.getUserById(user._id);
      if (fullUser && fullUser.verificationAudit) {
        setVerificationDetails(fullUser.verificationAudit);
      } else {
        setVerificationDetails(null);
      }
      // Same round-trip: the acceptance history rides along on getUserById
      // rather than costing a second request, since support opens this modal
      // for one reason at a time and usually already has it loaded.
      setLegalAcceptances(
        Array.isArray(fullUser?.legalAcceptances) ? fullUser.legalAcceptances : []
      );
    } catch (error) {
      console.error('Error fetching verification details:', error);
      setVerificationDetails(null);
    } finally {
      setLoadingVerification(false);
    }
  };

  const fetchRestrictedByAdmin = async (adminId: string) => {
    setLoadingRestrictedBy(true);
    try {
      const admin = await usersService.getUserById(adminId);
      if (admin) {
        setRestrictedByAdmin({ _id: admin._id, name: admin.name });
      }
    } catch (error) {
      console.error('Error fetching restricted by admin:', error);
    } finally {
      setLoadingRestrictedBy(false);
    }
  };

  const fetchPenaltyData = async () => {
    if (!user?._id) return;

    setLoadingPenalties(true);
    try {
      const data = await usersService.getPenaltyData(user._id);

      const activeWarnings = (user.accountStatus === 'restricted' || user.accountStatus === 'suspended' || user.accountStatus === 'banned') ? 1 : 0;

      setPenaltyData({
        ...data,
        activeWarnings
      });
    } catch (error) {
      console.error('Error fetching penalty data:', error);
    } finally {
      setLoadingPenalties(false);
    }
  };

  /**
   * Open what an activity row points at. The row carries only an id, so the
   * full record is fetched on demand — the timeline deliberately does not
   * embed whole jobs and transactions it would mostly never need.
   */
  const handleOpenTarget = async (target: HistoryTarget) => {
    if (loadingTarget) return;

    setLoadingTarget(true);
    try {
      if (target.type === 'job') {
        const response: any = await jobsService.getJobById(target.id);
        const job = response?.job || response;
        if (!job?._id) {
          toast.error('That job no longer exists');
          return;
        }
        setOpenTarget({ type: 'job', data: job });
      } else if (target.type === 'support') {
        const response: any = await supportService.getChatSupportById(target.id);
        const ticket = response?.chatSupport || response;
        if (!ticket?._id) {
          toast.error('That support ticket no longer exists');
          return;
        }
        setOpenTarget({ type: 'support', data: ticket });
      } else {
        const transaction = await transactionsService.getTransactionById(target.id);
        if (!transaction) {
          toast.error('That transaction no longer exists');
          return;
        }
        setOpenTarget({ type: 'transaction', data: transaction });
      }
    } catch (error: any) {
      console.error('Error opening activity target:', error);
      // The server answers 404 for a ticket this admin may not read, so ticket
      // ids cannot be probed across support agents. Say what that means rather
      // than reporting it as a generic failure.
      if (target.type === 'support' && error?.response?.status === 404) {
        toast.error('You do not have access to this ticket');
      } else {
        toast.error('Failed to load details');
      }
    } finally {
      setLoadingTarget(false);
    }
  };

  const handleActionClick = (actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict' | 'delete') => {
    setConfirmingAction(actionType);
  };

  const needsDuration = confirmingAction === 'restrict' || confirmingAction === 'suspend' || confirmingAction === 'ban';
  // undefined = open-ended (permanent ban / restriction until lifted); null = not chosen yet.
  const durationDaysValue = needsDuration ? durationInDays(duration) : undefined;
  const canConfirm =
    confirmingAction === 'unrestrict' ||
    (reason.trim().length > 0 && (!needsDuration || durationDaysValue !== null));

  const handleConfirmYes = () => {
    if (confirmingAction && user) {
      if (needsDuration && durationDaysValue === null) {
        toast.error('Please choose how long the restriction lasts');
        return;
      }

      if (confirmingAction !== 'unrestrict' && !reason.trim()) {
        toast.error('Please provide a reason for the restriction');
        return;
      }

      onAction(
        user,
        confirmingAction,
        needsDuration ? durationDaysValue ?? undefined : undefined,
        confirmingAction === 'unrestrict' ? undefined : reason
      );
      setConfirmingAction(null);
      setDuration(EMPTY_DURATION);
      setReason('');
      setTimeout(() => {
        fetchPenaltyData();
      }, 1000);
    }
  };

  const handleConfirmNo = () => {
    setConfirmingAction(null);
    setDuration(EMPTY_DURATION);
    setReason('');
  };

  const getActionLabel = () => {
    switch (confirmingAction) {
      case 'ban': return 'Ban';
      case 'suspend': return 'Suspend';
      case 'restrict': return 'Restrict';
      case 'delete': return 'Delete';
      default: return '';
    }
  };

  if (!isOpen || !user) return null;

  const isRestricted = user.accountStatus ? user.accountStatus !== 'active' : user.isRestricted;

  // What the sanction was, why, and who imposed it. The type on
  // restrictionDetails is authoritative; accountStatus is the fallback for
  // older records written before the subdocument carried one.
  const restriction = user.restrictionDetails;
  const restrictionType: RestrictionType | null =
    (restriction?.type as RestrictionType | undefined) ||
    (user.accountStatus && user.accountStatus !== 'active'
      ? (user.accountStatus as RestrictionType)
      : null);
  const presentation =
    (restrictionType && RESTRICTION_PRESENTATION[restrictionType]) ||
    RESTRICTION_PRESENTATION.restricted;
  // Populated by the server on some responses, fetched by id on the rest.
  const restrictedByName =
    restriction?.restrictedBy && typeof restriction.restrictedBy === 'object'
      ? restriction.restrictedBy.name
      : restrictedByAdmin?.name;
  const formatStamp = (value?: Date | string) =>
    value
      ? new Date(value).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : null;

  const formatKYDNumber = (id: string) => {
    return `KYD: ${id}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('KYD copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy KYD');
    });
  };

  // "At a glance". The jobs hook keeps the previous query's data as a
  // placeholder, which must never show under this user's name.
  const jobsSummary = glanceJobs.data && !glanceJobs.isPlaceholderData ? glanceJobs.data.summary : null;
  const reviewSummary = glanceReviews.data?.summary;
  const glanceTiles: { label: string; value: React.ReactNode; sub?: string; onClick?: () => void; testId: string }[] = [
    isProviderUser
      ? {
          label: 'Rating',
          testId: 'glance-rating',
          value: reviewSummary?.count ? (
            <span className="inline-flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {reviewSummary.average.toFixed(1)}
            </span>
          ) : reviewSummary ? 'No reviews' : '…',
          sub: reviewSummary?.count ? `${reviewSummary.count} review${reviewSummary.count === 1 ? '' : 's'} · see all` : undefined,
          onClick: reviewSummary?.count ? () => setActiveTab('reviews') : undefined
        }
      : {
          label: 'Jobs posted',
          testId: 'glance-posted',
          value: jobsSummary ? jobsSummary.posted : '…',
          sub: jobsSummary ? `${jobsSummary.byStatus?.completed || 0} completed` : undefined
        },
    isProviderUser
      ? {
          label: 'Jobs worked',
          testId: 'glance-worked',
          value: jobsSummary ? jobsSummary.worked : '…',
          sub: user.completedJobs != null ? `${user.completedJobs} completed` : undefined
        }
      : { label: 'Wallet', testId: 'glance-wallet', value: `₱${(user.wallet?.balance || 0).toLocaleString()}` },
    {
      label: 'Member for',
      testId: 'glance-member',
      value: user.createdAt ? formatDistanceToNowStrict(new Date(user.createdAt)) : '—',
      sub: user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : undefined
    },
    {
      // lastLogin is stamped by kayod/server only on an actual sign-in (password,
      // Google, Facebook) — reopening the app on a saved session doesn't move it,
      // so this is "last login", not "last seen". isOnline isn't shown: neither
      // app ever sets it to true.
      label: 'Last login',
      testId: 'glance-last-login',
      value: user.lastLogin
        ? formatDistanceToNowStrict(new Date(user.lastLogin), { addSuffix: true })
        : 'Never',
      sub: user.lastLogin
        ? new Date(user.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : undefined
    }
  ];

  const FINDING_REASON: Record<string, string> = {
    no_show: 'No-show',
    late_cancel: 'Late cancellation',
    access_failure: 'Could not access the site',
    emergency: 'Emergency',
    other: 'Other'
  };
  const faultFindings = (user.faultFindings || []).filter(finding => finding.faultParty);

  // Both detail modals portal to the body at a fixed z-index of their own
  // (job 90/100, transaction 100/101). Rather than raise theirs — which would
  // reach every other page that opens them — this panel steps below while one
  // is stacked on top of it, so their backdrop dims it the way it should.
  const layer = openTarget
    ? { overlay: 'z-[88]', panel: 'z-[89]' }
    : { overlay: 'z-[100]', panel: 'z-[101]' };

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 ${layer.overlay} transition-opacity`}
        onClick={onClose}
      />

      <div className={`fixed right-0 top-0 h-full w-full md:w-[500px] bg-white ${layer.panel} shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">User Information</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Quick Info (Sticky on Mobile) */}
        <div className="sticky top-[61px] md:relative md:top-0 z-20 bg-white border-b border-gray-100 px-4 md:px-6 py-6 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover ring-2 ring-gray-100"
                  />
                ) : (
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-blue-50 flex items-center justify-center ring-2 ring-blue-50">
                    <span className="text-xl md:text-2xl font-bold text-blue-600">
                      {getInitials(user.name)}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate">{user.name}</h3>
                <button
                  onClick={() => copyToClipboard(user._id)}
                  className="text-xs md:text-sm font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1"
                >
                  {formatKYDNumber(user._id)}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <VerificationStatusBadge isVerified={user.isVerified} />
              {user.userType && <UserTypeBadge userType={user.userType} />}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-[61px] z-20 bg-white border-b border-gray-200 px-4 md:px-6">
          <div className="flex gap-1">
            {DETAIL_TABS.filter(tab => !tab.providersOnly || isProviderUser).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`user-tab-${tab.key}`}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-6 space-y-8">
            {activeTab === 'activity' && (
              <UserActivityTab userId={user._id} onOpenTarget={handleOpenTarget} />
            )}
            {activeTab === 'jobs' && (
              <UserJobsTab userId={user._id} onOpenTarget={handleOpenTarget} />
            )}
            {activeTab === 'money' && <UserMoneyTab userId={user._id} />}
            {activeTab === 'reviews' && isProviderUser && (
              <UserReviewsTab userId={user._id} storedRating={user.ratings} onOpenTarget={handleOpenTarget} />
            )}

            {activeTab === 'profile' && (
            <div className="space-y-4">
            {/* The account's standing first — the full panel is in Security Audit below. */}
            {isRestricted && (
              <div className={`flex items-start gap-2 p-3 border rounded-lg ${presentation.panel}`} data-testid="user-status-banner">
                <Ban className={`w-4 h-4 mt-0.5 flex-shrink-0 ${presentation.accent}`} />
                <div className="min-w-0 text-xs">
                  <p className={`font-bold ${presentation.accent}`}>
                    {presentation.label}
                    {(restriction?.suspendedUntil || restriction?.expiresAt)
                      ? ` until ${formatStamp(restriction.suspendedUntil || restriction.expiresAt)}`
                      : restrictionType !== 'deleted' ? ' · no end date' : ''}
                  </p>
                  {restriction?.reason && <p className={`mt-0.5 ${presentation.body}`}>“{restriction.reason}”</p>}
                </div>
              </div>
            )}

            {/* At a glance */}
            {/* Wide, short tiles: two per row, value and its detail on one line. */}
            <section className="grid grid-cols-2 gap-2" data-testid="user-at-a-glance">
              {glanceTiles.map(tile => {
                const Tile = tile.onClick ? 'button' : 'div';
                return (
                  <Tile
                    key={tile.testId}
                    {...(tile.onClick ? { type: 'button' as const, onClick: tile.onClick } : {})}
                    data-testid={tile.testId}
                    className={`min-w-0 text-left rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 ${tile.onClick ? 'hover:border-amber-200 hover:bg-amber-50/50 transition-colors' : ''}`}
                  >
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{tile.label}</p>
                    <p className="flex items-baseline gap-1.5 mt-0.5 min-w-0 whitespace-nowrap">
                      <span className="text-sm font-black text-gray-900">{tile.value}</span>
                      {tile.sub && <span className="text-[11px] text-gray-500 truncate">· {tile.sub}</span>}
                    </p>
                  </Tile>
                );
              })}
            </section>


            <UserProfileDetails
              user={user}
              jobCategories={jobCategories}
              verification={{
                reviewedBy: (verificationDetails?.reviewedBy as { name?: string } | undefined)?.name || null,
                reviewedAt: verificationDetails?.reviewedAt || null,
                loading: loadingVerification
              }}
            />


            {/* Penalty Tracker */}
            <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4" data-testid="user-security-audit">
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3"><Shield className="w-3.5 h-3.5 text-gray-400" />Security Audit</h3>
              {loadingPenalties ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Bans</p>
                      <p className="text-lg font-bold text-red-600">{penaltyData.totalPenalties}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Warnings</p>
                      <p className="text-lg font-bold text-yellow-600">{penaltyData.activeWarnings}</p>
                    </div>
                  </div>

                  {/* Why this account is sanctioned. Shown for every non-active
                      status, not only the ones with a countdown: a permanent ban
                      has no expiry, and its reason is exactly what support opens
                      this modal to read. */}
                  {isRestricted && (
                    <div
                      className={`p-4 border rounded-lg ${presentation.panel}`}
                      data-testid="user-restriction-details"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Ban className={`w-4 h-4 ${presentation.accent}`} />
                        <p className={`text-xs font-bold uppercase tracking-wider ${presentation.accent}`}>
                          {presentation.label}
                        </p>
                      </div>

                      <p className={`text-[10px] font-bold uppercase tracking-wider opacity-70 ${presentation.accent}`}>
                        Reason
                      </p>
                      {restriction?.reason ? (
                        <p
                          className={`mt-1 text-sm font-medium ${presentation.body}`}
                          data-testid="user-restriction-reason"
                        >
                          "{restriction.reason}"
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500 italic">
                          No reason recorded for this account.
                        </p>
                      )}

                      <div className={`mt-3 pt-3 border-t border-black/10 grid grid-cols-2 gap-3 ${presentation.body}`}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                            {restrictionTimer ? 'Time Remaining' : 'Duration'}
                          </p>
                          <p className="text-sm font-bold">
                            {restrictionTimer || 'Permanent'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Issued</p>
                          <p className="text-sm font-medium">
                            {formatStamp(restriction?.restrictedAt) || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Issued By</p>
                          <p className="text-sm font-medium">
                            {loadingRestrictedBy ? '...' : restrictedByName || 'System'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                            {restriction?.suspendedUntil ? 'Suspended Until' : 'Appeal'}
                          </p>
                          <p className="text-sm font-medium">
                            {restriction?.suspendedUntil
                              ? formatStamp(restriction.suspendedUntil)
                              : restriction?.appealAllowed === false
                                ? 'Not allowed'
                                : 'Allowed'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* What admins found when ruling on this user's disputes. */}
                  {faultFindings.length > 0 && (
                    <div className="rounded-lg border border-gray-200 p-3" data-testid="user-fault-findings">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5" /> Dispute findings against this user ({faultFindings.length})
                      </p>
                      <ul className="space-y-2">
                        {faultFindings.map((finding, index) => (
                          <li key={`${finding.jobId}-${index}`} className="text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">
                                {FINDING_REASON[finding.findingReason || 'other'] || finding.findingReason}
                                {finding.role && <span className="font-normal text-gray-500"> · as {finding.role}</span>}
                                {finding.faultParty === 'both' && <span className="font-normal text-gray-500"> · shared fault</span>}
                              </span>
                              <span className="text-gray-400 flex-shrink-0">
                                {finding.decidedAt ? new Date(finding.decidedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                              </span>
                            </div>
                            {finding.sanctioned && <span className="text-[10px] font-bold text-red-600 uppercase">Sanctioned</span>}
                            {finding.notes && <p className="text-gray-600 mt-0.5">{finding.notes}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>


            {/* Legal Acceptances.
                Appended by the Kayod server whenever this user affirms the
                agreements — at sign-up, at booking, when posting a job. Never
                edited here: it is an audit trail, and a mutable one proves
                nothing. Empty for accounts created before acceptances were
                recorded, which is meaningful in itself and so is said plainly
                rather than rendered as a blank list. */}
            <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4" data-testid="user-legal">
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3"><FileText className="w-3.5 h-3.5 text-gray-400" />Legal Agreements</h3>
              {legalAcceptances.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No recorded acceptances. Accounts created before agreement
                  tracking was added will show nothing here.
                </p>
              ) : (
                <div className="space-y-2">
                  {legalAcceptances
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.acceptedAt).getTime() -
                        new Date(a.acceptedAt).getTime()
                    )
                    .map((entry, index) => (
                      <div
                        key={`${entry.acceptedAt}-${index}`}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-gray-900 capitalize">
                            {String(entry.context || "").replace("-", " ")}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                            v{entry.version}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {entry.acceptedAt
                            ? new Date(entry.acceptedAt).toLocaleString()
                            : "—"}
                        </p>
                        {Array.isArray(entry.documentIds) &&
                        entry.documentIds.length > 0 ? (
                          <p className="text-[11px] text-gray-400 mt-1">
                            {entry.documentIds.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>
              )}
            </section>
            </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-30 bg-white border-t border-gray-200 px-4 md:px-6 py-4">
          {confirmingAction ? (
            <div className="space-y-4">
              {(confirmingAction === 'restrict' || confirmingAction === 'suspend' || confirmingAction === 'ban') && (
                <div className="space-y-4">
                  <div className={`flex items-center gap-2 text-sm font-bold ${ACTION_STYLE[confirmingAction].text}`}>
                    {confirmingAction === 'restrict' && <Shield className="w-4 h-4" />}
                    {confirmingAction === 'suspend' && <Clock className="w-4 h-4" />}
                    {confirmingAction === 'ban' && <Ban className="w-4 h-4" />}
                    {getActionLabel()} {user.name}
                  </div>
                  <RestrictionDurationPicker
                    action={confirmingAction}
                    value={duration}
                    onChange={setDuration}
                  />
                  <textarea
                    data-testid="user-action-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={`Why is this account being ${ACTION_STYLE[confirmingAction].pastTense}?`}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                  />
                </div>
              )}
              {confirmingAction === 'delete' && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm font-bold text-red-600">Warning: This action cannot be undone</p>
                    </div>
                    <p className="text-sm text-red-700">
                      Deleting this user will permanently remove their account from the system. They will not be able to access the platform anymore.
                    </p>
                  </div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for deletion..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmNo}
                  data-testid="user-action-cancel"
                  className="flex-1 h-11 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmYes}
                  data-testid="user-action-confirm"
                  disabled={!canConfirm}
                  className={`flex-1 h-11 text-sm font-bold text-white rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                    confirmingAction === 'restrict' || confirmingAction === 'suspend' || confirmingAction === 'ban'
                      ? ACTION_STYLE[confirmingAction].button
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Confirm {getActionLabel()}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {!isRestricted ? (
                <>
                  <button
                    onClick={() => handleActionClick('restrict')}
                    data-testid="user-action-restrict"
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100"
                  >
                    <Shield className="w-5 h-5" />
                    Restrict
                  </button>
                  <button
                    onClick={() => handleActionClick('suspend')}
                    data-testid="user-action-suspend"
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-100 rounded-lg hover:bg-yellow-100"
                  >
                    <Clock className="w-5 h-5" />
                    Suspend
                  </button>
                  <button
                    onClick={() => handleActionClick('ban')}
                    data-testid="user-action-ban"
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100"
                  >
                    <Ban className="w-5 h-5" />
                    Ban
                  </button>
                  <button
                    onClick={() => handleActionClick('delete')}
                    data-testid="user-action-delete"
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleActionClick('unrestrict')}
                  data-testid="user-action-unrestrict"
                  className="w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100"
                >
                  <UserX className="w-5 h-5" />
                  Restore Account Access
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* What an activity row pointed at, stacked over this panel. Closing it
          returns to the history exactly where it was left. */}
      <JobDetailsModal
        isOpen={openTarget?.type === 'job'}
        onClose={() => setOpenTarget(null)}
        job={openTarget?.type === 'job' ? openTarget.data : null}
      />
      <TransactionDetailsModal
        isOpen={openTarget?.type === 'transaction'}
        onClose={() => setOpenTarget(null)}
        transaction={openTarget?.type === 'transaction' ? openTarget.data : null}
      />
      <SupportConversationModal
        isOpen={openTarget?.type === 'support'}
        onClose={() => setOpenTarget(null)}
        ticket={openTarget?.type === 'support' ? openTarget.data : null}
      />
    </>,
    document.body
  );
};

export default UserDetailsModal;
