/**
 * Support Types
 */

export interface Message {
  _id?: string;
  senderType: 'Admin' | 'User';
  senderId?: string;
  senderName?: string;
  message: string;
  timestamp: string;
}

export interface ChatSupport {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userType?: string;
  userProfileImage?: string;
  subject: string;
  category: string;
  description?: string;
  status: 'open' | 'closed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  messages?: Message[];
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  unreadCount?: number;
  assignedTo?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  statusHistory?: Array<{
    status: 'resolved' | 'reopened';
    performedBy?: string;
    performedByName?: string;
    timestamp: string;
    reason?: string;
  }>;
}

export interface ChatSupportsResponse {
  success: boolean;
  chatSupports: ChatSupport[];
}

export interface ChatSupportDetailsResponse {
  success: boolean;
  chatSupport: ChatSupport;
}

export interface SendMessageRequest {
  message: string;
}

export interface SendMessageResponse {
  success: boolean;
  message: Message;
}

export interface ChatActionResponse {
  success: boolean;
  chatSupport: ChatSupport;
}

export type SupportStatus = 'open' | 'closed';
export type SupportPriority = 'urgent' | 'high' | 'medium' | 'low';
export type MessageSenderType = 'Admin' | 'User';
