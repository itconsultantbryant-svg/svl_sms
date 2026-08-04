import { useState, useEffect } from 'react';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { Building2, ChevronDown } from 'lucide-react';

interface InstitutionOption {
  id: string;
  institution_code: string;
  institution_name: string;
}

export default function InstitutionSelector() {
  const { user } = useAuth();
  const { selectedInstitution, setSelectedInstitution } = useInstitution();
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Only show for platform admins
  if (user?.user_type !== 'platform_admin') {
    return null;
  }

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/platform-admin/institutions/list');
      setInstitutions(response.data);
    } catch (error) {
      console.error('Failed to fetch institutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (institution: InstitutionOption | null) => {
    if (institution) {
      setSelectedInstitution({
        id: institution.id,
        name: institution.institution_name,
        code: institution.institution_code,
      });
    } else {
      setSelectedInstitution(null);
    }
    setIsOpen(false);

    // Reload the page to refresh data for the new institution
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <Building2 size={18} className="text-primary-600" />
        <span className="text-sm font-medium text-gray-700">
          {selectedInstitution ? selectedInstitution.name : 'Select Institution'}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Loading...</div>
            ) : (
              <>
                <div
                  onClick={() => handleSelect(null)}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                >
                  <div className="text-sm font-medium text-gray-700">
                    Platform Level (No Institution)
                  </div>
                  <div className="text-xs text-gray-500">View platform-wide data</div>
                </div>
                {institutions.map((inst) => (
                  <div
                    key={inst.id}
                    onClick={() => handleSelect(inst)}
                    className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                      selectedInstitution?.id === inst.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {inst.institution_name}
                    </div>
                    <div className="text-xs text-gray-500">{inst.institution_code}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
