import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../lib/api';
import { getUser, isAuthed } from '../lib/auth';
import { currency } from '../lib/format';
import type { ProcessResult, User } from '../lib/types';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';

const DEMOS = [
  { label: 'Auto-refund', message: 'My order #124 arrived damaged. I want a refund.' },
  { label: 'Needs approval', message: 'My order #123 arrived damaged. I want a refund.' },
  { label: 'Outside window', message: 'My order #125 arrived damaged. I want a refund.' },
  { label: 'Not found', message: 'My order #99999 arrived damaged. I want a refund.' },
  { label: 'Order status', message: 'Where is my order #456?' },
];

export default function SubmitTicket() {
  const user = getUser<User>();
  const authed = isAuthed();
  const isAdmin = user?.role === 'ADMIN';

  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: (msg: string) => api.submitTicket(msg),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (e: unknown) => {
      setResult(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    },
  });

  const seedMutation = useMutation({
    mutationFn: (amount?: number) => api.seedTestOrder(amount),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 3) return;
    submitMutation.mutate(trimmed);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit a support ticket</h1>
        <p className="mt-1 text-sm text-gray-500">Describe your issue and our AI will process it instantly.</p>
      </div>

      {/* Demo shortcuts */}
      <div className="flex flex-wrap gap-2">
        {DEMOS.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setMessage(d.message)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            {d.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">
            Describe your issue
          </label>
          <textarea
            id="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. My order #124 arrived damaged. I want a refund."
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitMutation.isPending || message.trim().length < 3}
          className={clsx(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors',
            message.trim().length < 3 || submitMutation.isPending
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-700',
          )}
        >
          {submitMutation.isPending && <Spinner className="border-white/40 border-t-white" />}
          Submit
        </button>
      </form>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Result</h2>
            {authed && (
              <Link
                to={`/tickets/${result.ticket.id}`}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View full ticket &rarr;
              </Link>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-500">Ticket</span>
              <span className="font-mono text-gray-800">#{result.ticket.id.slice(0, 8)}</span>
              <Badge value={result.ticket.status} />
            </div>

            {result.error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{result.error}</div>
            )}

            {result.classification && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">Classification:</span>
                <Badge value={result.classification.intent.toUpperCase()} />
                <Badge value={result.classification.priority.toUpperCase()} />
                <span className="text-gray-600">{(result.classification.confidence * 100).toFixed(1)}% confidence</span>
              </div>
            )}

            {result.decision && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">Decision:</span>
                <Badge value={result.decision.action} />
                <span className="text-gray-600">{result.decision.reason}</span>
                {result.decision.amount != null && (
                  <span className="font-medium text-gray-800">{currency(result.decision.amount)}</span>
                )}
              </div>
            )}

            {result.refund && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">Refund:</span>
                <span className="font-medium text-gray-800">{currency(result.refund.amount)}</span>
                <Badge value={result.refund.status} />
              </div>
            )}

            {result.approval && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">Approval:</span>
                <Badge value={result.approval.status} />
                {result.approval.amount != null && (
                  <span className="font-medium text-gray-800">{currency(result.approval.amount)}</span>
                )}
              </div>
            )}

            {result.response && (
              <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {result.response}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin seed helper */}
      {isAdmin && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700">Seed a test order (Admin)</h3>
          <p className="mt-1 text-xs text-gray-500">
            Creates an order eligible for automatic refund (delivered 2 days ago).
          </p>
          <button
            type="button"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate(undefined)}
            className="mt-2 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {seedMutation.isPending ? 'Seeding…' : 'Seed test order'}
          </button>
          {seedMutation.isSuccess && (
            <p className="mt-2 text-sm text-green-700">
              Created order <span className="font-mono font-bold">#{seedMutation.data.orderId}</span> — copy it into
              the textarea above, e.g. "My order #{seedMutation.data.orderId} arrived damaged…"
            </p>
          )}
          {seedMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{seedMutation.error.message}</p>
          )}
        </div>
      )}
    </div>
  );
}