import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

import { VerificationDetailsModal } from "../components/Modals";
import UserTypeBadge from "../components/UI/UserTypeBadge";
import StatsCard from "../components/Dashboard/StatsCard";
import { useVerifications, useUpdateVerificationStatus } from "../hooks";
import type { Verification, UserInfo } from "../types";

const getInitials = (name: string): string => {
  const nameParts = name
    .trim()
    .split(" ")
    .filter((part) => part.length > 0);
  if (nameParts.length === 0) return "?";
  return nameParts[0][0].toUpperCase();
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const configs = {
    approved: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle },
    rejected: { bg: "bg-red-100", text: "text-red-800", icon: XCircle },
    pending: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      icon: AlertCircle,
    },
    under_review: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      icon: AlertCircle,
    },
    resubmission_requested: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      icon: AlertCircle,
    },
    flagged: { bg: "bg-red-100", text: "text-red-800", icon: AlertCircle },
  };

  const config = configs[status as keyof typeof configs] || configs.pending;
  const Icon = config.icon;

  const displayStatus =
    status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${config.bg} ${config.text}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {displayStatus}
    </span>
  );
};

const UserAvatar: React.FC<{ user: UserInfo; size?: "sm" | "md" | "lg" }> = ({
  user,
  size = "md",
}) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-2xl",
  };

  if (user.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={user.name}
        className={`${sizeClasses[size].split(" ").slice(0, 2).join(" ")} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gray-50 flex items-center justify-center border border-gray-100`}
    >
      <span className="font-bold text-gray-400">
        {getInitials(user.name)}
      </span>
    </div>
  );
};

const Verifications: React.FC = () => {
  const { data: verifications = [], isLoading: loading, refetch } = useVerifications();
  const updateStatusMutation = useUpdateVerificationStatus();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState<
    "all" | "client" | "provider"
  >("all");
  const [selectedVerification, setSelectedVerification] =
    useState<Verification | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(
    null,
  );
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    const id = searchParams.get("id");
    const verificationId = searchParams.get("verificationId");
    const targetId = id || verificationId;

    if (targetId && verifications.length > 0) {
      const verification = verifications.find(
        (v) => v._id === targetId || v.userId?._id === targetId,
      );

      if (verification) {
        setHighlightedUserId(verification.userId?._id || null);
        setSelectedVerification(verification);
        setModalOpen(true);

        setTimeout(() => {
          highlightedRowRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 300);

        searchParams.delete("id");
        searchParams.delete("verificationId");
        setSearchParams(searchParams, { replace: true });
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
    try {
      await updateStatusMutation.mutateAsync({
        verificationId,
        status,
        adminNotes: notes,
        rejectionReason: reason,
        banUser,
      });
      setModalOpen(false);
      toast.success("Verification status updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
      throw error;
    }
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

  const stats = useMemo(() => {
    const total = userVerifications.length;
    const pending = userVerifications.filter(({ verifications }) =>
      verifications.some((v) => v.status === "pending" || v.status === "under_review")
    ).length;
    const approved = userVerifications.filter(({ verifications }) =>
      verifications.some((v) => v.status === "approved")
    ).length;
    const rejected = userVerifications.filter(({ verifications }) =>
      verifications.some((v) => v.status === "rejected")
    ).length;
    
    return { total, pending, approved, rejected };
  }, [userVerifications]);

  const filteredUsers = useMemo(() => {
    return userVerifications.filter(({ user, verifications }) => {
      const matchesSearch =
        (user.name?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() ?? "").includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        verifications.some((v) => {
          if (statusFilter === "under_review") {
            return v.status === "under_review" || v.status === "pending";
          }
          return v.status === statusFilter;
        });

      const matchesUserType =
        userTypeFilter === "all" || user.userType === userTypeFilter;

      return matchesSearch && matchesStatus && matchesUserType;
    });
  }, [userVerifications, searchTerm, statusFilter, userTypeFilter]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchTerm, statusFilter, userTypeFilter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, pagination.page, pagination.limit]);

  const totalPages = Math.ceil(filteredUsers.length / pagination.limit);

  if (loading) {
    return (
      <div className="fixed inset-0 md:left-72 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-gray-100 border-t-blue-600 animate-spin" />
            <ShieldCheck className="absolute inset-0 m-auto h-6 w-6 text-blue-600 animate-pulse" />
          </div>
          <div className="flex flex-col items-center italic">
            <p className="text-sm font-black text-gray-900 tracking-widest uppercase">Loading Verifications</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Establishing Secure Connection</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-6 py-5">
          <div className="hidden md:flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  User Verifications
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Review and manage identity compliance for providers and customers
              </p>
            </div>
            

          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="cursor-pointer" onClick={() => setStatusFilter('all')}>
              <StatsCard
                title="Total Users"
                value={stats.total.toString()}
                icon={User}
                color="blue"
                variant="tinted"
                isActive={statusFilter === 'all'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setStatusFilter('under_review')}>
              <StatsCard
                title="Pending Review"
                value={stats.pending.toString()}
                icon={AlertCircle}
                color="orange"
                variant="tinted"
                isActive={statusFilter === 'under_review'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setStatusFilter('approved')}>
              <StatsCard
                title="Approved"
                value={stats.approved.toString()}
                icon={CheckCircle}
                color="green"
                variant="tinted"
                isActive={statusFilter === 'approved'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setStatusFilter('rejected')}>
              <StatsCard
                title="Rejected"
                value={stats.rejected.toString()}
                icon={XCircle}
                color="red"
                variant="tinted"
                isActive={statusFilter === 'rejected'}
                smallIcon={true}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 w-full md:contents">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by name, email or KYD ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all shadow-sm"
              />
            </div>

            {/* Mobile-only Limit */}
            <div className="flex md:hidden items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select 
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
            <button
              onClick={() => setUserTypeFilter('all')}
              className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                userTypeFilter === 'all'
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setUserTypeFilter('client')}
              className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                userTypeFilter === 'client'
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setUserTypeFilter('provider')}
              className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                userTypeFilter === 'provider'
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Providers
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
            <select 
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
              className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No users found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative">
                <table className="min-w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-[30%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Verification Subject
                      </th>
                      <th className="w-[18%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Category
                      </th>
                      <th className="w-[18%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="w-[17%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Attempts
                      </th>
                      <th className="w-[17%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Submission
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {paginatedUsers.map(({ user, verifications }) => {
                      const latestVerification = verifications[0];
                      const isHighlighted = highlightedUserId === user._id;
                      
                      const attemptCount = verifications.reduce((max, v) => {
                        const fromAttempts = Array.isArray(v.attempts) ? v.attempts.length : 0;
                        const fromField = v.verificationAttempts || 0;
                        return Math.max(max, Math.max(fromAttempts, fromField));
                      }, 0) || 1;

                      return (
                        <tr
                          key={user._id}
                          ref={isHighlighted ? highlightedRowRef : null}
                          onClick={() => openModal(latestVerification)}
                          className={`group transition-all duration-150 cursor-pointer ${
                            isHighlighted ? "bg-blue-50/30 shadow-inner" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                            <div className="flex items-center gap-4">
                              <div className="relative flex-shrink-0">
                                <UserAvatar user={user} size="md" />
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${user.userType === 'provider' ? 'bg-indigo-500' : 'bg-purple-500'}`}>
                                  <ShieldCheck className="h-2 w-2 text-white" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 group-hover:text-black transition-colors truncate">
                                  {user.name}
                                </p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                  ID: {user._id.slice(-8).toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="flex justify-center">
                              <UserTypeBadge userType={user.userType} />
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="flex justify-center">
                              <StatusBadge status={latestVerification.status} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center border-b border-gray-300">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-100">
                              <RefreshCw className="h-3 w-3 text-gray-400" />
                              <span className="text-xs font-black text-gray-700">{attemptCount}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="flex flex-col items-center">
                              <p className="text-xs font-bold text-gray-900">
                                {formatDistanceToNow(new Date(latestVerification.submittedAt), { addSuffix: true })}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase mt-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(latestVerification.submittedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {paginatedUsers.map(({ user, verifications }) => {
                  const latestVerification = verifications[0];
                  const totalDocuments = verifications.reduce((sum, v) => {
                    const latestAttempt = Array.isArray(v.attempts) && v.attempts.length > 0
                      ? v.attempts[v.attempts.length - 1]
                      : null;
                    const faceCount = latestAttempt?.faceVerification ? 1 : 0;
                    const idCount = latestAttempt?.validId ? (Array.isArray(latestAttempt.validId) ? latestAttempt.validId.length : 1) : 0;
                    const credCount = latestAttempt?.credentials ? (Array.isArray(latestAttempt.credentials) ? latestAttempt.credentials.length : 1) : 0;
                    return sum + faceCount + idCount + credCount;
                  }, 0);
                  const isHighlighted = highlightedUserId === user._id;

                  return (
                    <div
                      key={user._id}
                      onClick={() => openModal(latestVerification)}
                      className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-all ${
                        isHighlighted ? "ring-2 ring-blue-500 shadow-lg" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={latestVerification.status} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100 uppercase tracking-widest">
                          {formatDistanceToNow(new Date(latestVerification.submittedAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <UserAvatar user={user} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-900 leading-tight mb-0.5">
                              {user.name}
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 truncate">
                              {user.email}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <UserTypeBadge userType={user.userType} />
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                <RefreshCw className="h-2 w-2" />
                                {verifications.length} ATTEMPTS
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              </div>
                              <span className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em]">View</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-dashed border-gray-100">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Documents</span>
                              <span className="text-xs font-black text-gray-900">{totalDocuments} Files</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">User ID</span>
                              <span className="text-xs font-mono font-bold text-gray-600">ID: {user._id.slice(-6).toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs md:text-sm text-gray-700">
                        Showing{" "}
                        <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{" "}
                        <span className="font-medium">{Math.min(pagination.page * pagination.limit, filteredUsers.length)}</span> of{" "}
                        <span className="font-medium">{filteredUsers.length}</span> results
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                        disabled={pagination.page === totalPages}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
