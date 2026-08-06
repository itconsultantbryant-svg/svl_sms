import { Menu, LogOut, User, Search, Maximize2, Grid3x3, Globe, Bell, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import InstitutionSelector from './InstitutionSelector';
import DemoModeIndicator from '../DemoModeIndicator';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="text-gray-500 hover:text-gray-700">
          <Menu size={20} />
        </button>
        <button className="text-gray-400 hover:text-gray-600 hidden sm:block">
          <Maximize2 size={18} />
        </button>
        <button className="text-gray-400 hover:text-gray-600 hidden sm:block">
          <Grid3x3 size={18} />
        </button>

        {/* Search Bar */}
        <div className="relative hidden md:block">
          <input
            type="text"
            placeholder="Search"
            className="w-48 lg:w-64 pl-3 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user?.user_type === 'platform_admin' && (
          <>
            <InstitutionSelector />
            <div className="h-6 w-px bg-gray-200"></div>
          </>
        )}

        <DemoModeIndicator />
        <div className="h-6 w-px bg-gray-200"></div>

        {/* Toolbar Icons */}
        <button className="text-gray-400 hover:text-gray-600 relative">
          <Globe size={18} />
        </button>
        <button className="text-gray-400 hover:text-gray-600 relative">
          <Grid3x3 size={18} />
        </button>
        <button className="text-gray-400 hover:text-gray-600 relative">
          <MessageSquare size={18} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="text-gray-400 hover:text-gray-600 relative">
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="h-6 w-px bg-gray-200"></div>

        {/* User Avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center cursor-pointer">
            <User size={16} className="text-primary-600" />
          </div>
        </div>

        <button
          onClick={logout}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
