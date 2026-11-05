import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

import { VerificationDetailsModal } from "../components/Modals";
import CounterGroups from "../components/UI/CounterGroups";
import type { Counter, CounterGroup, Tone } from "../components/UI/CounterGroups";
import { SortHeader, ListFooter, ago } from "../components/UI/ListControls";
import { useVerifications, useUpdateVerificationStatus } from "../hooks";
import type { Verification, UserInfo } from "../types";

type TypeFilter = "all" | "client" | "provider";
type DateSort = "newest" | "oldest";

const getInitials = (name: string): string => {
  const nameParts = name
    .trim()
    .split(" ")
    .filter((part) => part.length > 0);
  if (nameParts.length === 0) return "?";
  return nameParts[0][0].toUpperCase();
};

/**
 * The status counters. "Pending review" covers both a new submission (pending)
 * and one an admin has opened (under_review): both still need a decision.
 */
const STATUS_COUNTERS: { key: string; label: string; tone: Tone; hint: string; alert?: boolean; statuses: string[] }[] = [
  { key: "under_review", label: "Pending", tone: "amber", alert: true, statuses: ["pending", "under_review"], hint: "Submitted (or opened) and waiting for an admin to decide" },
  { key: "flagged", label: "Flagged", tone: "red", alert: true, statuses: ["flagged"], hint: "Marked as suspicious; needs a closer look" },
  { key: "approved", label: "Approved", tone: "emerald", statuses: ["approved"], hint: "Identity confirmed" },
  { key: "rejected", label: "Rejected", tone: "red", statuses: ["rejected"], hint: "Turned down" },
  { key: "resubmission_requested", label: "Resubmit", tone: "orange", statuses: ["resubmission_requested"], hint: "Sent back for new documents; waiting on the user" },
];
const STATUS_KEYS = ["all", ...STATUS_COUNTERS.map((s) => s.key)];
const statusesOf = (key: string) => STATUS_COUNTERS.find((s) => s.key === key)?.statuses || [key];

// Row badges: the submission's own status, in the counters' colours.
const BADGE: Record<string, { label: string; badge: string; dot: string }> = {
  pending: { label: "Pending", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  under_review: { label: "Under review", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  approved: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  resubmission_requested: { label: "Resubmit", badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  flagged: { label: "Flagged", badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => {
  const look = BADGE[status] || BADGE.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase whitespace-nowrap ${small ? "px-2 py-0.5 text-[9px] tracking-tight" : "px-2.5 py-1 text-[10px] tracking-wider"} ${look.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      {look.label}
    </span>
  );
};

const day = (value?: string) => (value ? format(new Date(value), "MMM d") : "");

/** The line under a status: how long it has waited, or how it was decided. */
const statusLine = (v: Verification): { text: string; icon: LucideIcon; tone: string } => {
  switch (v.status) {
    case "pending":
    case "under_review":
      return { text: `Waiting ${formatDistanceToNowStrict(new Date(v.submittedAt))}`, icon: Clock, tone: "text-amber-600" };
    case "approved":
      return { text: `Approved ${day(v.reviewedAt)}`.trim(), icon: CheckCircle2, tone: "text-gray-500" };
    case "rejected":
      return { text: v.rejectionReason ? `“${v.rejectionReason}”` : `Rejected ${day(v.reviewedAt)}`.trim(), icon: XCircle, tone: "text-gray-500" };
    case "resubmission_requested":
      return { text: v.reviewedAt ? `Asked ${day(v.reviewedAt)} · waiting on the user` : "Waiting on the user", icon: RotateCcw, tone: "text-gray-500" };
    case "flagged":
      return { text: `Flagged ${day(v.reviewedAt)}`.trim(), icon: AlertTriangle, tone: "text-red-600 font-semibold" };
    default:
      return { text: v.status, icon: Clock, tone: "text-gray-500" };
  }
};

const StatusText: React.FC<{ v: Verification; className?: string }> = ({ v, className = "" }) => {
  const line = statusLine(v);
  const Icon = line.icon;
  return (
    <span className={`flex items-center gap-1 min-w-0 ${line.tone} ${className}`}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{line.text}</span>
    </span>
  );
};

const countOf = (value: unknown) => (Array.isArray(value) ? value.length : value ? 1 : 0);

/** What the latest submission holds: face photo, valid ID, credentials. */
const documentsOf = (v: Verification) => {
  const latestAttempt = Array.isArray(v.attempts) && v.attempts.length > 0 ? v.attempts[v.attempts.length - 1] : null;
  const source = latestAttempt || v;
  const face = countOf(source.faceVerification);
  const ids = countOf(source.validId);
  const creds = countOf(source.credentials);
  const parts = [
    face ? "face photo" : "",
    ids ? (ids > 1 ? `${ids} IDs` : "valid ID") : "",
    creds ? `${creds} credential${creds > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return { total: face + ids + creds, text: parts.length ? parts.join(", ").replace(/^\w/, (c) => c.toUpperCase()) : "No documents" };
};

/** How many times this person has submitted. */
const attemptsOf = (verifications: Verification[]) =>
  verifications.reduce((max, v) => {
    const fromAttempts = Array.isArray(v.attempts) ? v.attempts.length : 0;
    return Math.max(max, fromAttempts, v.verificationAttempts || 0);
  }, 0) || 1;

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

const RoleLabel: React.FC<{ user: UserInfo }> = ({ user }) => (
  <span className={`text-[9px] font-black uppercase tracking-wider ${user.userType === "provider" ? "text-indigo-600" : "text-purple-600"}`}>
    {user.userType === "provider" ? "Provider" : "Client"}
  </span>
);

const UserAvatar: React.FC<{ user: UserInfo; size?: "sm" | "md" }> = ({ user, size = "md" }) => {
  const box = size === "sm" ? "w-10 h-10" : "w-10 h-10";
  if (user.profileImage) {
    return <img src={user.profileImage} alt={user.name} className={`${box} rounded-full object-cover border border-gray-200 flex-shrink-0`} />;
  }
  return (
    <div className={`${box} rounded-full bg-blue-50 flex items-center justify-center border border-gray-100 flex-shrink-0`}>
      <span className="text-sm font-bold text-blue-600 uppercase">{getInitials(user.name)}</span>
    </div>
  );
};

/**
 * Verifications Page
 * One row per person, standing on their latest submission. The same counters,
 * rows and footer as the Jobs and Transactions pages: what needs review first,
 * then what was decided, and account type; every number is the rows clicking
 * it shows. The details panel is unchanged.
 */
const Verifications: React.FC = () => {
  const { data: verifications = [], isLoading: loading, isPlaceholderData } = useVerifications();
  const updateStatusMutation = useUpdateVerificationStatus();
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<DateSort>("newest");
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Status and account type live in the URL; they combine.
  const statusParam = searchParams.get("status") || "all";
  const statusFilter = STATUS_KEYS.includes(statusParam) ? statusParam : "all";
  const typeParam = searchParams.get("type") || "all";
  const typeFilter: TypeFilter = typeParam === "client" || typeParam === "provider" ? typeParam : "all";
  const setFilters = (status: string, type: TypeFilter) => {
    const next = new URLSearchParams(searchParams);
    if (status === "all") next.delete("status"); else next.set("status", status);
    if (type === "all") next.delete("type"); else next.set("type", type);
    setSearchParams(next, { replace: true });
  };
  // Clicking the selected counter again lifts that filter.
  const chooseStatus = (status: string) => setFilters(status === statusFilter ? "all" : status, typeFilter);
  const chooseType = (type: TypeFilter) => setFilters(statusFilter, type === typeFilter ? "all" : type);

  // ?id= / ?verificationId= opens that person's submission (links from elsewhere).
  useEffect(() => {
    const targetId = searchParams.get("id") || searchParams.get("verificationId");

    if (targetId && verifications.length > 0) {
      const verification = verifications.find(
        (v) => v._id === targetId || v.userId?._id === targetId,
      );

      if (verification) {
        setHighlightedUserId(verification.userId?._id || null);
        setSelectedVerification(verification);
        setModalOpen(true);

        setTimeout(() => {
          highlightedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);

        const next = new URLSearchParams(searchParams);
        next.delete("id");
        next.delete("verificationId");
        setSearchParams(next, { replace: true });
      }
    }
  }, [verifications, searchParams, setSearchParams]);

  const handleStatusUpdate = async (
    verificationId: string,
    status: string,
    notes?: string,
    reason?: string,
    banUser?: boolean,
  ): Promise<void> => {
    // No toast here: the details panel announces the outcome ("Verification
    // approved …") and apiClient reports failures, so one here doubled both.
    // Errors propagate so the panel can show which action failed.
    await updateStatusMutation.mutateAsync({
      verificationId,
      status,
      adminNotes: notes,
      rejectionReason: reason,
      banUser,
    });
    setModalOpen(false);
  };

  const openModal = (verification: Verification) => {
    setSelectedVerification(verification);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedVerification(null), 300);
    setTimeout(() => {
      setHighlightedUserId(null);
    }, 3000);
  };

  const userVerifications = useMemo(() => {
    const grouped = verifications.reduce(
      (acc, verification) => {
        if (!verification.userId) return acc;

        const userId = verification.userId._id;
        if (!acc[userId]) {
          acc[userId] = {
            user: verification.userId,
            verifications: [],
          };
        }
        acc[userId].verifications.push(verification);
        return acc;
      },
      {} as Record<string, { user: UserInfo; verifications: Verification[] }>,
    );

    return Object.values(grouped);
  }, [verifications]);

  // A user's standing is their LATEST submission (the API sorts newest first),
  // the same one the row's badge shows. Matching any past submission listed a
  // user who was rejected once and approved on retry under both Approved and
  // Rejected.
  const latestOf = (list: Verification[]) => list[0];

  // Search narrows the counters as well as the list.
  const searched = useMemo(() => {
    // "KYD: 6a…" as copied from the details panel, or the 8-character ID a row shows.
    const term = searchTerm.trim().toLowerCase().replace(/^(kyd|id):\s*/, "");
    if (!term) return userVerifications;
    return userVerifications.filter(({ user }) =>
      (user.name?.toLowerCase() ?? "").includes(term) ||
      (user.email?.toLowerCase() ?? "").includes(term) ||
      (user._id?.toLowerCase() ?? "").includes(term),
    );
  }, [userVerifications, searchTerm]);

  const matches = (row: { user: UserInfo; verifications: Verification[] }, status: string, type: TypeFilter) =>
    (status === "all" || statusesOf(status).includes(latestOf(row.verifications)?.status)) &&
    (type === "all" || row.user.userType === type);
  const countWhere = (status: string, type: TypeFilter) => searched.filter((row) => matches(row, status, type)).length;

  const filteredUsers = useMemo(() => {
    const rows = searched.filter((row) => matches(row, statusFilter, typeFilter));
    const time = (row: { verifications: Verification[] }) => new Date(latestOf(row.verifications)?.submittedAt || 0).getTime();
    return [...rows].sort((a, b) => (sort === "newest" ? time(b) - time(a) : time(a) - time(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, statusFilter, typeFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, typeFilter, sort, limit]);

  const paginatedUsers = useMemo(() => filteredUsers.slice((page - 1) * limit, page * limit), [filteredUsers, page, limit]);
  const totalPages = Math.ceil(filteredUsers.length / limit);

  const toCounter = (def: (typeof STATUS_COUNTERS)[number]): Counter => ({
    key: def.key,
    label: def.label,
    tone: def.tone,
    hint: def.hint,
    alert: def.alert,
    count: countWhere(def.key, typeFilter),
    selected: statusFilter === def.key,
    onClick: () => chooseStatus(def.key),
  });
  const groups: CounterGroup[] = [
    { label: "Needs review", cells: STATUS_COUNTERS.filter((s) => s.alert).map(toCounter) },
    {
      label: "Reviewed",
      total: ["approved", "rejected", "resubmission_requested"].reduce((n, key) => n + countWhere(key, typeFilter), 0),
      cells: STATUS_COUNTERS.filter((s) => !s.alert).map(toCounter),
    },
    {
      label: "Account type",
      cells: ([
        { key: "client", label: "Customers", tone: "purple", hint: "People who post jobs" },
        { key: "provider", label: "Providers", tone: "indigo", hint: "People who quote on jobs and do the work" },
      ] as const).map((cell) => ({
        ...cell,
        count: countWhere(statusFilter, cell.key),
        selected: typeFilter === cell.key,
        onClick: () => chooseType(cell.key),
      })),
    },
  ];

  const anyFilterActive = Boolean(searchTerm) || statusFilter !== "all" || typeFilter !== "all" || sort !== "newest";
  const clearFilters = () => {
    setSearchTerm("");
    setSort("newest");
    setFilters("all", "all");
  };

  const emptyText = statusFilter === "under_review" && !searchTerm
    ? { title: "Nothing to review", text: "Every submission has been decided." }
    : { title: "No users found", text: "Try adjusting your search or filters." };

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="hidden md:flex items-start justify-between gap-6 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  User Verifications
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {loading ? "Identity checks for providers and customers" : `${userVerifications.length.toLocaleString()} people have sent identity documents`}
                {!loading && countWhere("under_review", "all") > 0 && (
                  <span className="text-amber-600 font-semibold"> · {countWhere("under_review", "all")} waiting for review</span>
                )}
              </p>
            </div>
          </div>

          <CounterGroups
            groups={groups}
            gridClass="grid-cols-[0.8fr_2fr_3fr_2fr]"
            all={{ count: loading ? undefined : searched.length, selected: statusFilter === "all" && typeFilter === "all", onClick: () => setFilters("all", "all") }}
            filtered={anyFilterActive}
            onClear={clearFilters}
            testId="ver-counters"
            idPrefix="ver"
            allCell={{ label: "All", hint: "Everyone who has sent identity documents" }}
          />
        </div>

        {/* Filter Bar — one bar for every width. Phones stack it (search, then
            the order); from lg it's one row. */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <input
                type="text"
                data-testid="verifications-search"
                placeholder="Search by name, email or KYD ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
              />
            </div>

            {/* Page Limit - phones (the desktop one sits by the pages) */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="lg:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as DateSort)}
              aria-label="Sort verifications"
              className="lg:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`flex-1 overflow-y-auto transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading verifications...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="verifications-empty">
              <div className="text-gray-300 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">{emptyText.title}</p>
              <p className="text-sm text-gray-500 mt-1">{emptyText.text}</p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show everyone
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative overflow-hidden">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      <th className="w-[31%] xl:w-[30%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        User
                      </th>
                      <th className="w-[27%] xl:w-[28%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Documents
                      </th>
                      <th className="w-[24%] xl:w-[24%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th
                        className="w-[18%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === "newest" ? "descending" : "ascending"}
                      >
                        <SortHeader
                          label="Submitted"
                          dir={sort === "newest" ? "desc" : "asc"}
                          onClick={() => setSort(sort === "newest" ? "oldest" : "newest")}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedUsers.map(({ user, verifications: list }) => {
                      const latest = list[0];
                      const isHighlighted = highlightedUserId === user._id;
                      const docs = documentsOf(latest);
                      const attempts = attemptsOf(list);

                      return (
                        <tr
                          key={user._id}
                          data-testid={`verification-row-${user._id}`}
                          ref={isHighlighted ? highlightedRowRef : null}
                          onClick={() => openModal(latest)}
                          className={`group h-20 cursor-pointer transition-colors ${isHighlighted ? "bg-blue-50/60" : "hover:bg-gray-50/70"}`}
                        >
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar user={user} />
                              <div className="min-w-0">
                                <RoleLabel user={user} />
                                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{user.name}</p>
                                <p className="text-[11px] text-gray-500 truncate">
                                  <span className="font-mono text-gray-400">ID {user._id.slice(-8).toUpperCase()}</span>
                                  {user.email && <> · {user.email}</>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate" title={docs.text}>{docs.text}</span>
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500">
                              {attempts > 1 ? `${ordinal(attempts)} attempt` : "First attempt"}
                              {docs.total > 0 && <> · {docs.total} file{docs.total > 1 ? "s" : ""}</>}
                            </p>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <div className="flex flex-col items-start gap-1.5 min-w-0">
                              <StatusBadge status={latest.status} />
                              <StatusText v={latest} className="text-[11px] max-w-full" />
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <p className="text-xs font-bold text-gray-900 truncate">{ago(latest.submittedAt)}</p>
                            <p className="text-[10px] font-medium text-gray-400 mt-1">{format(new Date(latest.submittedAt), "MMM d, yyyy")}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones and tablets */}
              <div className="lg:hidden bg-white">
                <div className="px-3 py-3 space-y-2">
                  {paginatedUsers.map(({ user, verifications: list }) => {
                    const latest = list[0];
                    const docs = documentsOf(latest);
                    const attempts = attemptsOf(list);
                    const isHighlighted = highlightedUserId === user._id;

                    return (
                      <div
                        key={user._id}
                        data-testid={`verification-card-${user._id}`}
                        onClick={() => openModal(latest)}
                        className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer ${isHighlighted ? "ring-2 ring-blue-500" : ""}`}
                      >
                        <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
                          <UserAvatar user={user} size="sm" />
                          <div className="flex-1 min-w-0">
                            <RoleLabel user={user} />
                            <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{user.name}</p>
                            <StatusText v={latest} className="mt-1 text-[11px]" />
                          </div>
                          <StatusBadge status={latest.status} small />
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <p className="flex-1 min-w-0 text-[10px] font-semibold text-gray-500 truncate">
                            {docs.text}{attempts > 1 ? ` · ${ordinal(attempts)} attempt` : ""}
                          </p>
                          <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {ago(latest.submittedAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && filteredUsers.length > 0 && (
          <ListFooter page={page} limit={limit} total={filteredUsers.length} pages={totalPages} onPage={setPage} onLimit={setLimit} />
        )}
      </div>

      <VerificationDetailsModal
        isOpen={modalOpen}
        onClose={closeModal}
        verification={selectedVerification}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
};

export default Verifications;
