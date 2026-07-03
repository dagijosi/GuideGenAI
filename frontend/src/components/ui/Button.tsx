import { cn } from '../../lib/utils';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

// All variant/size classes must be complete strings for Tailwind v4 static scanning
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...rest }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2';

    const variantClass =
      variant === 'secondary'
        ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
        : variant === 'danger'
          ? 'bg-red-500 text-white hover:bg-red-600'
          : variant === 'ghost'
            ? 'text-gray-600 hover:bg-gray-100'
            : 'bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50'; // primary

    const sizeClass =
      size === 'sm'
        ? 'px-3 py-1.5 text-xs'
        : size === 'lg'
          ? 'px-6 py-3 text-base'
          : 'px-4 py-2 text-sm'; // md

    return (
      <button
        ref={ref}
        className={cn(base, variantClass, sizeClass, className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading && <Loader2 className='h-4 w-4 animate-spin' />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
