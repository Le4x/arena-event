import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

export interface TimerProps {
  endsAt: Date;
  onExpire?: () => void;
  className?: string;
  warningThreshold?: number; // seconds
}

export const Timer: React.FC<TimerProps> = ({
  endsAt,
  onExpire,
  className,
  warningThreshold = 10,
}) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endsAt).getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));

      setTimeLeft(diff);

      if (diff === 0 && onExpire) {
        onExpire();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  const isWarning = timeLeft <= warningThreshold && timeLeft > 0;
  const isExpired = timeLeft === 0;

  return (
    <div
      className={clsx(
        'text-4xl font-bold text-center transition-colors duration-200',
        isExpired && 'text-red-600',
        isWarning && 'text-orange-500 animate-pulse',
        !isWarning && !isExpired && 'text-gray-800',
        className
      )}
    >
      {timeLeft}s
    </div>
  );
};
