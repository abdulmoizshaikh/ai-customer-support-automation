import clsx from 'clsx';
import type { Approval } from '../lib/types';
import { currency, relativeTime } from '../lib/format';
import Badge from './Badge';

interface ApprovalCardProps {
  approval: Approval;
  onApprove?: () => void;
  onReject?: () => void;
  isProcessing?: boolean;
}

export default function ApprovalCard({ approval, onApprove, onReject, isProcessing }: ApprovalCardProps) {
  const ticket = approval.ticket;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {ticket && (
              <span className="font-mono text-xs text-gray-400">
                Ticket #{ticket.id.slice(0, 8)}
              </span>
            )}
            <Badge value={approval.status} />
            <Badge value={approval.type} />
          </div>
          {ticket && (
            <p className="mt-1.5 text-sm text-gray-700">{ticket.message}</p>
          )}
          {ticket?.orderId && (
            <p className="mt-1 text-xs text-gray-500">Order: {ticket.orderId}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-400">{relativeTime(approval.createdAt)}</span>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        {approval.amount != null && (
          <div className="flex gap-2">
            <span className="shrink-0 text-gray-500">Amount</span>
            <span className="font-medium text-gray-800">{currency(approval.amount)}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="shrink-0 text-gray-500">Reason</span>
          <span className="min-w-0 text-gray-700">{approval.reason}</span>
        </div>
        {approval.decidedAt && (
          <div className="flex gap-2">
            <span className="shrink-0 text-gray-500">Decided</span>
            <span className="text-gray-700">{relativeTime(approval.decidedAt)}</span>
          </div>
        )}
      </div>

      {approval.status === 'PENDING' && onApprove && onReject && (
        <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onApprove}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors',
              isProcessing
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'bg-green-600 text-white hover:bg-green-700',
            )}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onReject}
            className={clsx(
              'rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition-colors',
              isProcessing
                ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                : 'text-gray-700 hover:bg-gray-50',
            )}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}