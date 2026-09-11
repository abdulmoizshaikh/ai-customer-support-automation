import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { clearAuth, getUser, isAuthed } from '../lib/auth';
import type { User } from '../lib/types';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700',
  );

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser<User>();
  const authed = isAuthed();

  const logout = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white">
                <span className="text-sm font-bold">AI</span>
              </span>
              <span className="text-base font-semibold text-gray-900">AI Support Automation</span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/" end className={navLinkClass}>
                Submit
              </NavLink>
              {authed && (
                <>
                  <NavLink to="/dashboard" className={navLinkClass}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/approvals" className={navLinkClass}>
                    Approvals
                  </NavLink>
                  <NavLink to="/analytics" className={navLinkClass}>
                    Analytics
                  </NavLink>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {authed && user ? (
              <>
                <span className="hidden text-sm text-gray-600 sm:inline">
                  {user.name}
                  <span className="ml-1 text-xs text-gray-400">({user.email})</span>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex items-center gap-1 border-t border-gray-100 px-4 py-2 sm:hidden">
          <NavLink to="/" end className={navLinkClass}>
            Submit
          </NavLink>
          {authed && (
            <>
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/approvals" className={navLinkClass}>
                Approvals
              </NavLink>
              <NavLink to="/analytics" className={navLinkClass}>
                Analytics
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}