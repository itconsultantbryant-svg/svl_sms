import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  UserPlus
} from 'lucide-react';

interface AdmissionStats {
  pending_enquiries: number;
  converted_enquiries: number;
  pending_applications: number;
  review_applications: number;
  approved_applications: number;
  rejected_applications: number;
  admitted_applications: number;
}

export default function AdmissionDashboard() {
  const [stats, setStats] = useState<AdmissionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admission/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch admission stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Pending Enquiries',
      value: stats?.pending_enquiries || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      link: '/admission/enquiries?status=pending'
    },
    {
      title: 'Converted Enquiries',
      value: stats?.converted_enquiries || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      link: '/admission/enquiries?status=converted'
    },
    {
      title: 'Pending Applications',
      value: stats?.pending_applications || 0,
      icon: FileText,
      color: 'bg-blue-500',
      link: '/admission/applications?status=pending'
    },
    {
      title: 'Under Review',
      value: stats?.review_applications || 0,
      icon: TrendingUp,
      color: 'bg-purple-500',
      link: '/admission/applications?status=under_review'
    },
    {
      title: 'Approved',
      value: stats?.approved_applications || 0,
      icon: CheckCircle,
      color: 'bg-green-600',
      link: '/admission/applications?status=approved'
    },
    {
      title: 'Admitted',
      value: stats?.admitted_applications || 0,
      icon: UserPlus,
      color: 'bg-indigo-600',
      link: '/admission/applications?status=admitted'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admission Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage admission enquiries and applications
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Link
            key={index}
            to={stat.link}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-8 w-8 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/admission/enquiries/new"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-2 border-dashed border-gray-300 hover:border-primary-500"
        >
          <div className="flex items-center">
            <div className="bg-primary-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">New Enquiry</h3>
              <p className="text-sm text-gray-500">Record a new admission enquiry</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admission/applications/new"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-2 border-dashed border-gray-300 hover:border-primary-500"
        >
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">New Application</h3>
              <p className="text-sm text-gray-500">Create a new admission application</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <Link
              to="/admission/enquiries"
              className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-400 mr-3" />
                  <span className="text-sm font-medium text-gray-900">View All Enquiries</span>
                </div>
                <span className="text-sm text-gray-500">→</span>
              </div>
            </Link>

            <Link
              to="/admission/applications"
              className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-3" />
                  <span className="text-sm font-medium text-gray-900">View All Applications</span>
                </div>
                <span className="text-sm text-gray-500">→</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
