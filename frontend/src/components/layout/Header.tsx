import { Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import InstitutionSelector from './InstitutionSelector';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      <button onClick={onToggleSidebar} className="text-gray-500 hover:text-gray-700">
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-4">
        {user?.user_type === 'platform_admin' && (
          <>
            <InstitutionSelector />
            <div className="h-8 w-px bg-gray-300"></div>
          </>
        )}
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-gray-500">{user?.role?.display_name}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
          <User size={16} className="text-primary-600" />
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
