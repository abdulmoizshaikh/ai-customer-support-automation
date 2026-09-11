import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';
import { currency, dateTime } from '../lib/format';
import type { User } from '../lib/types';
import AuditTimeline from '../components/AuditTimeline';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';

function DecisionCard({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return null;
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        {typeof metadata.action === 'string' && <Badge value={metadata.action} />}
        {metadata.reason != null && <span className="font-medium text-gray-800">{String(metadata.reason)}</span>}
      </div>
      {metadata.amount != null && (
        <div className="flex gap-2">
          <span className="text-gray-500">Approved amount</span>
          <span className="font-medium text-gray-800">{currency(metadata.amount as number)}</span>
        </div>
      )}
      {metadata.requiresApproval != null && (
        <div className="flex gap-2">
          <span className="text-gray-500">Requires approval</span>
          <span className="font-medium text-gray-800">{metadata.requiresApproval ? 'Yes' : 'No'}</span>
        </div>
      )}
    </div>
  );
}

export default function TicketDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const user = getUser<User>();
  const canDecide = user?.role === 'AGENT' || user?.role === 'ADMIN';

  const { data: ticket, isLoading, isError, error } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.getTicket(id),
    refetchInterval: 10_000,
  });

  const approvalMutation = useMutation({
    mutationFn: ({ action }: { action: 'approve' | 'reject' }) =>
      action === 'approve' ? api.approve(id) : api.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
        <Spinner /> Loading ticket…
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-600">{error?.message ?? 'Ticket not found'}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
          &larr; Back to dashboard
        </Link>
      </div>
    );
  }

  const decisionAudit = ticket.auditLogs.find((e) => e.event === 'DECISION_MADE');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Ticket <span className="font-mono text-lg text-gray-500">#{ticket.id.slice(0, 8)}</span>
          </h1>
          <Badge value={ticket.status} />
        </div>
        <span className="text-xs text-gray-400">{dateTime(ticket.createdAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — ticket content */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-medium text-gray-500">Customer message</h2>
            <p className="text-sm text-gray-900">{ticket.message}</p>
            {ticket.orderId && (
              <p className="mt-2 text-xs text-gray-500">Related order: {ticket.orderId}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Classification */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Classification</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500">Intent</span>
                  {ticket.intent ? <Badge value={ticket.intent} /> : <span className="text-gray-300">—</span>}
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500">Priority</span>
                  {ticket.priority ? <Badge value={ticket.priority} /> : <span className="text-gray-300">—</span>}
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500">Confidence</span>
                  <span className="font-medium text-gray-800">
                    {ticket.confidence != null ? `${(ticket.confidence * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Decision */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Decision</h3>
              <DecisionCard metadata={decisionAudit?.metadata ?? null} />
              {!decisionAudit && <span className="text-sm text-gray-300">No decision recorded</span>}
            </div>
          </div>

          {/* Refund */}
          {ticket.refund && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Refund</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-800">{currency(ticket.refund.amount, ticket.refund.currency)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500">Status</span>
                  <Badge value={ticket.refund.status} />
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500">Reason</span>
                  <span className="text-gray-700">{ticket.refund.reason}</span>
                </div>
              </div>
            </div>
          )}

          {/* Approval */}
          {ticket.approvalRequest && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Approval</h3>
                <Badge value={ticket.approvalRequest.status} />
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500">Type</span>
                  <span className="text-gray-700">{ticket.approvalRequest.type}</span>
                </div>
                {ticket.approvalRequest.amount != null && (
                  <div className="flex gap-2">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-medium text-gray-800">{currency(ticket.approvalRequest.amount)}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-gray-500">Reason</span>
                  <span className="text-gray-700">{ticket.approvalRequest.reason}</span>
                </div>
              </div>

              {ticket.approvalRequest.status === 'PENDING' && canDecide && (
                <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    disabled={approvalMutation.isPending}
                    onClick={() => approvalMutation.mutate({ action: 'approve' })}
                    className={clsx(
                      'rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors',
                      approvalMutation.isPending
                        ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                        : 'bg-green-600 text-white hover:bg-green-700',
                    )}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={approvalMutation.isPending}
                    onClick={() => approvalMutation.mutate({ action: 'reject' })}
                    className={clsx(
                      'rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition-colors',
                      approvalMutation.isPending
                        ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                        : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AI Response */}
          {ticket.aiResponse && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-medium text-gray-500">AI customer response</h3>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.aiResponse}</p>
            </div>
          )}
        </div>

        {/* Right column — execution trace */}
        <div className="lg:col-span-1">
          <AuditTimeline
            entries={ticket.auditLogs}
            ticketStatus={ticket.status}
            isAdmin={user?.role === 'ADMIN'}
            ticketId={ticket.id}
          />
        </div>
      </div>
    </div>
  );
}