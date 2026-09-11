import clsx from 'clsx';

export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600',
        className,
      )}
      aria-label="Loading"
      role="status"
    />
  );
}