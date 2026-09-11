import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import clsx from 'clsx';
import type { AuditLogEntry, TicketStatus } from '../lib/types';
import { api } from '../lib/api';
import { currency, formatDuration, relativeTime, shortTime } from '../lib/format';
import Badge from './Badge';
import Spinner from './Spinner';

// ---------------------------------------------------------------------------
// Event presentation — titles + metadata rendering per backend audit event
// ---------------------------------------------------------------------------

const EVENT_TITLE: Record<string, string> = {
  TICKET_CREATED: 'Ticket received',
  AI_CLASSIFICATION: 'AI classified the ticket',
  RAG_RETRIEVED: 'Policies retrieved',
  ORDER_LOOKED_UP: 'Order looked up',
  DECISION_MADE: 'Decision made',
  REFUND_CREATED: 'Refund issued',
  ORDER_STATUS_TRANSITIONED: 'Order status updated',
  APPROVAL_REQUESTED: 'Escalated to human',
  APPROVAL_APPROVED: 'Approved by agent',
  APPROVAL_REJECTED: 'Rejected by agent',
  RESPONSE_GENERATED: 'Customer response written',
  TICKET_RESOLVED: 'Ticket resolved',
  TICKET_FAILED: 'Ticket failed',
  TICKET_RETRY_SUCCEEDED: 'Retry succeeded',
  TICKET_RETRY_FAILED: 'Retry failed',
};

const ACTOR_COLORS: Record<string, string> = {
  AI: 'bg-purple-500',
  SYSTEM: 'bg-gray-400',
  HUMAN: 'bg-blue-500',
  AGENT: 'bg-green-500',
};

interface MetaField {
  label: string;
  value: ReactNode;
}

function fieldsFor(event: string, meta: Record<string, unknown> | null): MetaField[] {
  if (!meta) return [];
  switch (event) {
    case 'TICKET_CREATED':
      return [{ label: 'Message preview', value: <span className="italic text-gray-500">"{String(meta.messagePreview ?? '—')}"</span> }];
    case 'AI_CLASSIFICATION':
      return [
        { label: 'Intent', value: <Badge value={String(meta.intent).toUpperCase()} /> },
        { label: 'Priority', value: <Badge value={String(meta.priority).toUpperCase()} /> },
        { label: 'Confidence', value: `${((meta.confidence as number) * 100).toFixed(1)}%` },
        { label: 'Provider', value: String(meta.provider) },
      ];
    case 'RAG_RETRIEVED':
      return [
        { label: 'Chunks', value: String(meta.chunkCount) },
        { label: 'Top score', value: meta.topScore != null ? Number(meta.topScore).toFixed(4) : '—' },
        { label: 'Files', value: Array.isArray(meta.filenames) ? meta.filenames.join(', ') : '—' },
      ];
    case 'ORDER_LOOKED_UP':
      return [
        { label: 'Order ID', value: String(meta.orderId ?? '—') },
        { label: 'Found', value: meta.found ? 'Yes' : 'No' },
        { label: 'Amount', value: currency(meta.amount as number) },
        { label: 'Status', value: String(meta.status ?? '—') },
      ];
    case 'DECISION_MADE':
      return [
        { label: 'Action', value: <Badge value={String(meta.action)} /> },
        { label: 'Reason', value: String(meta.reason) },
        { label: 'Amount', value: currency(meta.amount as number) },
        { label: 'Requires approval', value: meta.requiresApproval ? 'Yes' : 'No' },
      ];
    case 'REFUND_CREATED':
      return [
        { label: 'Amount', value: currency(meta.amount as number) },
        { label: 'Status', value: <Badge value={String(meta.status)} /> },
      ];
    case 'ORDER_STATUS_TRANSITIONED':
      return [{ label: 'Status change', value: <span className="font-mono text-xs">{String(meta.from)} &rarr; {String(meta.to)}</span> }];
    case 'APPROVAL_REQUESTED':
      return [
        { label: 'Reason', value: String(meta.reason) },
        { label: 'Amount', value: currency(meta.amount as number) },
      ];
    case 'APPROVAL_APPROVED':
      return [{ label: 'Approved by', value: String(meta.approvedBy) }];
    case 'APPROVAL_REJECTED':
      return [
        { label: 'Rejected by', value: String(meta.rejectedBy) },
        ...(meta.reason != null ? [{ label: 'Reason', value: String(meta.reason) }] as MetaField[] : []),
      ];
    case 'RESPONSE_GENERATED':
      return [
        { label: 'Action', value: <Badge value={String(meta.action)} /> },
        { label: 'Length', value: `${meta.length} chars` },
      ];
    case 'TICKET_RESOLVED':
      return [{ label: 'Final status', value: <Badge value={String(meta.finalStatus)} /> }];
    case 'TICKET_FAILED':
      return [{ label: 'Error', value: <span className="text-red-600">{String(meta.error)}</span> }];
    case 'TICKET_RETRY_SUCCEEDED':
      return [{ label: 'From status', value: <Badge value={String(meta.fromStatus)} /> }];
    case 'TICKET_RETRY_FAILED':
      return [{ label: 'Error', value: <span className="text-red-600">{String(meta.error)}</span> }];
    default:
      return Object.entries(meta).map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, ' $1').trim(),
        value: String(v ?? '—'),
      }));
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AuditTimelineProps {
  entries: AuditLogEntry[];
  ticketStatus: TicketStatus;
  isAdmin: boolean;
  ticketId: string;
}

export default function AuditTimeline({ entries, ticketStatus, isAdmin, ticketId }: AuditTimelineProps) {
  const queryClient = useQueryClient();
  const retryMutation = useMutation({
    mutationFn: () => api.retryTicket(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const eventCount = entries.length;

  const totalMs =
    eventCount >= 2
      ? new Date(entries[eventCount - 1].createdAt).getTime() -
        new Date(entries[0].createdAt).getTime()
      : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">AI Execution Trace</h3>
      <p className="mb-5 text-sm text-gray-500">
        {eventCount} event{eventCount !== 1 ? 's' : ''}{' '}
        {eventCount >= 2 && (
          <span className="tabular-nums">&middot; {formatDuration(totalMs)} total</span>
        )}
      </p>

      <ol className="relative">
        {entries.map((entry, i) => {
          const prev = entries[i - 1];
          const elapsedMs = prev
            ? new Date(entry.createdAt).getTime() - new Date(prev.createdAt).getTime()
            : null;
          const dotColor = ACTOR_COLORS[entry.actor] ?? 'bg-gray-400';

          return (
            <li key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">
              {/* Connector column */}
              <div className="flex flex-col items-center">
                <span
                  className={clsx(
                    'flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white',
                    dotColor,
                  )}
                />
                {i < eventCount - 1 && <span className="flex-1 w-px bg-gray-200" />}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                {elapsedMs != null && (
                  <div className="mb-1 pl-px text-[11px] text-gray-400 tabular-nums">
                    {formatDuration(elapsedMs)}
                  </div>
                )}

                <div className="rounded-md border border-gray-100 bg-gray-50/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {EVENT_TITLE[entry.event] ?? entry.event}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {relativeTime(entry.createdAt)}{' '}
                        <span className="text-gray-400">{shortTime(entry.createdAt)}</span>
                      </p>
                    </div>
                    <span className="shrink-0">
                      <Badge
                        value={entry.actor}
                        className={clsx(
                          'border-none text-[10px]',
                          entry.actor === 'AI' && 'bg-purple-100 text-purple-800',
                          entry.actor === 'SYSTEM' && 'bg-gray-100 text-gray-600',
                          entry.actor === 'HUMAN' && 'bg-blue-100 text-blue-800',
                          entry.actor === 'AGENT' && 'bg-green-100 text-green-800',
                        )}
                      />
                    </span>
                  </div>

                  {(() => {
                    const fields = fieldsFor(entry.event, entry.metadata);
                    return fields.length > 0 ? (
                      <dl className="mt-2 space-y-1">
                        {fields.map((f) => (
                          <div key={f.label} className="flex items-baseline gap-2 text-sm">
                            <dt className="shrink-0 text-gray-500">{f.label}</dt>
                            <dd className="min-w-0 font-medium text-gray-800">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null;
                  })()}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {ticketStatus === 'FAILED' && isAdmin && (
        <div className="mt-5 border-t border-gray-200 pt-4">
          <button
            type="button"
            disabled={retryMutation.isPending}
            onClick={() => retryMutation.mutate()}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors',
              retryMutation.isPending
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700',
            )}
          >
            {retryMutation.isPending && <Spinner className="h-4 w-4 border-white/40 border-t-white" />}
            Retry
          </button>
          {retryMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              Retry failed: {retryMutation.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}