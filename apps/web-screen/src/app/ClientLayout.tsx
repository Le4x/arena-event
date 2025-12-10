'use client';

import { AuthGuard } from '@arena-event/shared/src/auth';
import { ReactNode } from 'react';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRoles={['SUPER_ADMIN', 'ORGANIZER']}>
      {children}
    </AuthGuard>
  );
}
