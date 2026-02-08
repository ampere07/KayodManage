import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface VerificationStatusBadgeProps {
  isVerified: boolean;
  size?: 'sm' | 'md';
}

const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({ isVerified, size = 'md' }) => {
  const configs = {
    verified: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: CheckCircle,
      label: 'Verified'
    },
    unverified: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      icon: XCircle,
      label: 'Unverified'
    }
  };

  const sizeClasses = {
    sm: {
      container: 'px-1.5 py-0.5 text-[10px]',
      icon: 'h-2.5 w-2.5 mr-1'
    },
    md: {
      container: 'px-2 py-1 text-xs',
      icon: 'h-3 w-3 mr-1'
    }
  };

  const config = isVerified ? configs.verified : configs.unverified;
  const classes = sizeClasses[size];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${classes.container} ${config.bg} ${config.text}`}>
      <Icon className={classes.icon} />
      {config.label}
    </span>
  );
};

export default VerificationStatusBadge;
