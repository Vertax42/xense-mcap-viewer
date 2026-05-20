import React from 'react';

import { cn } from '@/shared/lib/utils';

export const ScrollArea: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return <div className={cn('overflow-auto', className)}>{children}</div>;
};
