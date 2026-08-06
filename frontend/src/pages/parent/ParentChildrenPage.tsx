import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import api from '../../utils/api';

export default function ParentChildrenPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => api.get('/parent-portal/children').then(r => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Failed to load children. Make sure you are logged in as a parent.</p>
      </div>
    );
  }

  const children: any[] = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">My Children</h1>
      </div>

      {children.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No children linked to your account.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child: any) => (
            <div key={child.id} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {child.photo ? (
                  <img src={child.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">
                      {child.first_name?.[0]}{child.last_name?.[0]}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-gray-900">{child.first_name} {child.last_name}</h2>
                  <p className="text-xs text-gray-400">{child.admission_number}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {child.class_name && <p>Class: <span className="font-medium">{child.class_name}</span></p>}
                {child.section_name && <p>Section: <span className="font-medium">{child.section_name}</span></p>}
                {child.relationship && (
                  <p className="text-xs text-gray-400 capitalize">Relationship: {child.relationship}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
