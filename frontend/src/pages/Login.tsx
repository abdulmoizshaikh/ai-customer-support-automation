import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../lib/api';
import { setAuth } from '../lib/auth';
import Spinner from '../components/Spinner';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: (data) => {
      setAuth(data.tokens.accessToken, data.user);
      navigate('/dashboard');
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : 'Login failed');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">Agent &amp; admin access to the dashboard.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="agent@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Agent123!"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className={clsx(
            'w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors',
            loginMutation.isPending
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-700',
          )}
        >
          {loginMutation.isPending && <Spinner className="border-white/40 border-t-white" />}
          Sign in
        </button>
      </form>

      <div className="space-y-2 text-center text-sm text-gray-500">
        <p>
          <Link to="/" className="font-medium text-indigo-600 hover:text-indigo-700">Back to Submit</Link>
        </p>
        <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">
          <p className="font-medium text-gray-700">Seeded accounts</p>
          <p className="mt-1 font-mono">agent@example.com / Agent123!</p>
          <p className="font-mono">admin@example.com / Admin123!</p>
        </div>
      </div>
    </div>
  );
}