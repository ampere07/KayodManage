import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface VerificationStatusBadgeProps {
  isVerified: boolean;
}

const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({ isVerified }) => {
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

  const config = isVerified ? configs.verified : configs.unverified;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${config.bg} ${config.text}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </span>
  );
};

export default VerificationStatusBadge;
