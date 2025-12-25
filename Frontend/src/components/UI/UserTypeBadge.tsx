import React from 'react';
import { Briefcase, User, Shield, Crown } from 'lucide-react';

interface UserTypeBadgeProps {
  userType: string;
}

const UserTypeBadge: React.FC<UserTypeBadgeProps> = ({ userType }) => {
  const configs = {
    provider: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: Briefcase
    },
    client: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      icon: User
    },
    admin: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      icon: Shield
    },
    superadmin: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: Crown
    }
  };

  const config = configs[userType.toLowerCase() as keyof typeof configs] || configs.client;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${config.bg} ${config.text}`}>
      <Icon className="h-3 w-3" />
      {userType.charAt(0).toUpperCase() + userType.slice(1)}
    </span>
  );
};

export default UserTypeBadge;
