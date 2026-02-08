import React from 'react';
import { Briefcase, User, Shield, Crown } from 'lucide-react';

interface UserTypeBadgeProps {
  userType: string;
  size?: 'sm' | 'md';
}

const UserTypeBadge: React.FC<UserTypeBadgeProps> = ({ userType, size = 'md' }) => {
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

  const sizeClasses = {
    sm: {
      container: 'gap-0.5 px-1.5 py-0.5 text-[10px]',
      icon: 'h-2.5 w-2.5'
    },
    md: {
      container: 'gap-1 px-2 py-1 text-xs',
      icon: 'h-3 w-3'
    }
  };

  const config = configs[userType.toLowerCase() as keyof typeof configs] || configs.client;
  const classes = sizeClasses[size];
  const Icon = config.icon;

  const getDisplayLabel = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType === 'client') return 'Customer';
    if (lowerType === 'provider') return 'Provider';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${classes.container} ${config.bg} ${config.text}`}>
      <Icon className={classes.icon} />
      {getDisplayLabel(userType)}
    </span>
  );
};

export default UserTypeBadge;
