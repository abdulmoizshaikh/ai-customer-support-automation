import { Link } from 'react-router-dom';
import type { TicketDetail } from '../lib/types';
import { relativeTime, truncate } from '../lib/format';
import Badge from './Badge';

interface TicketCardProps {
  ticket: TicketDetail;
}

export default function TicketCard({ ticket }: TicketCardProps) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">#{ticket.id.slice(0, 8)}</span>
            {ticket.status && <Badge value={ticket.status} />}
          </div>
          <p className="mt-1 text-sm text-gray-700">{truncate(ticket.message, 120)}</p>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{relativeTime(ticket.createdAt)}</span>
      </div>
      {ticket.intent && (
        <div className="mt-2 flex items-center gap-2">
          <Badge value={ticket.intent} />
          {ticket.priority && <Badge value={ticket.priority} />}
        </div>
      )}
    </Link>
  );
}