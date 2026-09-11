import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { currency, percent } from '../lib/format';
import type { TicketDetail } from '../lib/types';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';

type DecisionCounts = Record<string, number>;

function decisionCounts(tickets: TicketDetail[]): DecisionCounts {
  const counts: DecisionCounts = {};
  for (const ticket of tickets) {
    const decision = ticket.auditLogs.find((e) => e.event === 'DECISION_MADE');
    const action = decision?.metadata?.action;
    if (typeof action === 'string') {
      counts[action] = (counts[action] ?? 0) + 1;
    }
  }
  return counts;
}

function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function KeyValueTable({ rows }: { rows: Array<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <table className="min-w-full divide-y divide-gray-100 text-sm">
      <tbody className="divide-y divide-gray-100">
        {rows.map((row, i) => (
          <tr key={i}>
            <td className="px-4 py-2.5 text-gray-500">{row.label}</td>
            <td className="px-4 py-2.5 text-right font-medium text-gray-800">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Analytics() {
  const analyticsQuery = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.analytics(),
    refetchInterval: 15_000,
  });

  const ticketsQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.listTickets(),
    refetchInterval: 15_000,
  });

  if (analyticsQuery.isLoading || ticketsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
        <Spinner /> Loading analytics…
      </div>
    );
  }

  if (analyticsQuery.isError) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {analyticsQuery.error.message}
      </div>
    );
  }

  const a = analyticsQuery.data;
  if (!a) return null;
  const counts = decisionCounts(ticketsQuery.data ?? []);

  const statusRows = [
    { label: 'Open', value: a.tickets.open },
    { label: 'Resolved', value: a.tickets.resolved },
    { label: 'Waiting approval', value: a.tickets.waitingApproval },
    { label: 'Failed', value: a.tickets.failed },
  ];

  const decisionActions = [
    'AUTO_REFUND',
    'REQUEST_HUMAN_APPROVAL',
    'REJECT_REFUND',
    'ORDER_NOT_FOUND',
    'NEEDS_HUMAN_REVIEW',
    'NO_ACTION',
  ];
  const hasDecisions = decisionActions.some((action) => (counts[action] ?? 0) > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tickets" value={a.tickets.total} />
        <StatCard
          label="Automation rate"
          value={percent(a.automation.automationRate)}
          sub={`${a.automation.automatedCount} automated · ${a.automation.escalatedCount} escalated · ${a.automation.rejectedCount} rejected`}
        />
        <StatCard label="Pending approvals" value={a.approvals.pending} />
        <StatCard
          label="Refunds issued"
          value={a.refunds.count}
          sub={`${currency(a.refunds.totalAmount, a.refunds.currency)} total`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <TableCard title="Tickets by status">
          <KeyValueTable rows={statusRows} />
        </TableCard>

        <TableCard title="Decisions by action">
          {hasDecisions ? (
            <KeyValueTable
              rows={decisionActions
                .filter((action) => (counts[action] ?? 0) > 0)
                .map((action) => ({ label: <Badge value={action} />, value: counts[action] }))}
            />
          ) : (
            <p className="px-4 py-8 text-center text-sm text-gray-400">No decisions recorded.</p>
          )}
        </TableCard>

        <TableCard title="AI provider">
          <div className="p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-gray-500">Average confidence</span>
              <span className="font-medium text-gray-800 tabular-nums">
                {percent(a.ai.averageConfidence)}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {Object.entries(a.ai.providerCounts).map(([provider, count]) => (
                <div key={provider} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-gray-600">{provider}</span>
                  <span className="font-medium text-gray-800 tabular-nums">{count}</span>
                </div>
              ))}
              {Object.keys(a.ai.providerCounts).length === 0 && (
                <p className="text-sm text-gray-400">No classifications yet.</p>
              )}
            </div>
          </div>
        </TableCard>
      </div>
    </div>
  );
}