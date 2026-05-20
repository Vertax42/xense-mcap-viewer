import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

export interface SpinnerProps extends React.ComponentPropsWithoutRef<typeof Loader2> {
  /** Visually hidden label for screen readers */
  label?: string;
}

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(({ className, label, ...props }, ref) => (
  <Loader2
    ref={ref}
    role={label ? 'status' : undefined}
    aria-label={label}
    className={cn('animate-spin', className)}
    {...props}
  />
));
Spinner.displayName = 'Spinner';

export { Spinner };
