import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../lib/api';
import { dateTime, truncate } from '../lib/format';
import type { TicketStatus } from '../lib/types';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';

const FILTERS: Array<{ label: string; match: TicketStatus | null }> = [
  { label: 'All', match: null },
  { label: 'Resolved', match: 'RESOLVED' },
  { label: 'Waiting approval', match: 'WAITING_APPROVAL' },
  { label: 'Failed', match: 'FAILED' },
];

export default function TicketList() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<TicketStatus | null>(null);

  const { data: tickets, isLoading, isError, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.listTickets(),
    refetchInterval: 10_000,
  });

  const filtered = activeFilter
    ? tickets?.filter((t) => t.status === activeFilter)
    : tickets;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <span className="text-sm text-gray-400">{tickets?.length ?? 0} total</span>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.match === null
              ? tickets?.length
              : tickets?.filter((t) => t.status === f.match).length;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => setActiveFilter(f.match)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeFilter === f.match
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              {f.label}
              {count != null && (
                <span className={clsx('ml-1', activeFilter === f.match ? 'text-indigo-200' : 'text-gray-400')}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Spinner /> Loading tickets…
        </div>
      )}

      {isError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {!isLoading && filtered && filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">No tickets found.</div>
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="cursor-pointer transition-colors hover:bg-indigo-50/50"
                >
                  <td className="whitespace-nowrap px-4 py-3"><Badge value={t.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {t.intent ? <Badge value={t.intent} /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {t.priority ? <Badge value={t.priority} /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-600">
                    {t.confidence != null ? `${(t.confidence * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-3 text-gray-600">
                    {truncate(t.message, 100)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {dateTime(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}