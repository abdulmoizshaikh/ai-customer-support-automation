import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../lib/api';
import type { ApprovalStatus } from '../lib/types';
import ApprovalCard from '../components/ApprovalCard';
import Spinner from '../components/Spinner';

const TABS: Array<{ label: string; value: ApprovalStatus }> = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function ApprovalQueue() {
  const [status, setStatus] = useState<ApprovalStatus>('PENDING');
  const [banner, setBanner] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['approvals', status],
    queryFn: () => api.listApprovals(status),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      action === 'approve' ? api.approve(id) : api.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const decide = (id: string, action: 'approve' | 'reject') => {
    actionMutation.mutate(
      { id, action },
      {
        onSuccess: () =>
          setBanner(
            action === 'approve' ? 'Approval approved — refund processed.' : 'Approval rejected — ticket resolved.',
          ),
        onError: (e: unknown) => setBanner(`Action failed: ${(e as Error).message}`),
      },
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Approval queue</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              status === tab.value
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {banner && (
        <div className="flex items-center justify-between rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
          <span>{banner}</span>
          <button type="button" onClick={() => setBanner(null)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Spinner /> Loading approvals…
        </div>
      )}

      {isError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error.message}</div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">
          {status === 'PENDING' ? 'No pending approvals.' : `No ${status.toLowerCase()} approvals.`}
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={() => decide(approval.id, 'approve')}
              onReject={() => decide(approval.id, 'reject')}
              isProcessing={actionMutation.isPending && actionMutation.variables?.id === approval.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}