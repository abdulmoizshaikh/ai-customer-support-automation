import clsx from 'clsx';

// Decision / status / approval values
const TONES: Record<string, string> = {
  // green
  AUTO_REFUND: 'bg-green-100 text-green-800 ring-green-600/20',
  RESOLVED: 'bg-green-100 text-green-800 ring-green-600/20',
  COMPLETED: 'bg-green-100 text-green-800 ring-green-600/20',
  APPROVED: 'bg-green-100 text-green-800 ring-green-600/20',
  READY: 'bg-green-100 text-green-800 ring-green-600/20',
  DECISION_AUTO_REFUND: 'bg-green-100 text-green-800 ring-green-600/20',
  // amber
  REQUEST_HUMAN_APPROVAL: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  WAITING_APPROVAL: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  MEDIUM: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  // red
  REJECT_REFUND: 'bg-red-100 text-red-800 ring-red-600/20',
  FAILED: 'bg-red-100 text-red-800 ring-red-600/20',
  REJECTED: 'bg-red-100 text-red-800 ring-red-600/20',
  ORDER_NOT_FOUND: 'bg-red-100 text-red-800 ring-red-600/20',
  HIGH: 'bg-red-100 text-red-800 ring-red-600/20',
  // gray
  NO_ACTION: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  NEEDS_HUMAN_REVIEW: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  OPEN: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  PROCESSING: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  LOW: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};

const INTENTS = ['REFUND', 'ORDER_STATUS', 'DAMAGED_ORDER', 'CANCEL_ORDER', 'TECHNICAL_ISSUE', 'OTHER'];

export function badgeTone(value: string): string {
  return TONES[value] ?? (INTENTS.includes(value) ? 'bg-purple-100 text-purple-800 ring-purple-600/20' : 'bg-gray-100 text-gray-700 ring-gray-500/20');
}

export default function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        badgeTone(value),
        className,
      )}
    >
      {value}
    </span>
  );
}