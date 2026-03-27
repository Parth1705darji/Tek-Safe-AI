import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/react';
import {
  Shield, LayoutDashboard, Database, Users,
  BarChart3, Activity, Menu, X, LogOut,
  ChevronRight, Bell, MessageSquare,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Knowledge Base', icon: Database, href: '/admin/kb' },
  { label: 'Users', icon: Users, href: '/admin/users' },
  { label: 'Conversations', icon: MessageSquare, href: '/admin/conversations' },
  { label: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
  { label: 'System', icon: Activity, href: '/admin/system' },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D4AA]/20">
            <Shield className="h-5 w-5 text-[#00D4AA]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Tek-Safe AI</p>
            <p className="text-xs text-[#00D4AA] font-medium">Admin Portal</p>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => (
            <button
              key={href}
              onClick={() => { navigate(href); setSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive(href)
                  ? 'bg-[#00D4AA]/15 text-[#00D4AA]'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {isActive(href) && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 rounded-xl p-2">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="h-8 w-8 rounded-full ring-2 ring-[#00D4AA]/30" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00D4AA]/20 text-xs font-semibold text-[#00D4AA]">
                {user?.fullName?.[0] ?? 'A'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.fullName ?? 'Admin'}</p>
              <p className="truncate text-xs text-[#00D4AA]">Administrator</p>
            </div>
            <button
              onClick={() => navigate('/chat')}
              title="Exit Admin"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-gray-800 bg-gray-900 px-6">
          <button className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="text-[#00D4AA] font-medium">Admin</span>
            <span>/</span>
            <span className="text-white">
              {NAV_ITEMS.find(n => isActive(n.href))?.label ?? 'Dashboard'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
            >
              → Go to Chat
            </button>
            <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
