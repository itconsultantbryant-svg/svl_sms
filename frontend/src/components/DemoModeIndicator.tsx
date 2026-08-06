import { useState } from 'react';
import { AlertCircle, Calendar, X } from 'lucide-react';
import { useLicense } from '../contexts/LicenseContext';

export default function DemoModeIndicator() {
  const { mode, daysRemaining, isExpired, planTier, expiry } = useLicense();
  const [showModal, setShowModal] = useState(false);

  if (!mode) return null;

  if (mode === 'demo') {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-md hover:bg-yellow-200 transition-colors"
        >
          DEMO MODE
        </button>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <AlertCircle size={20} className="text-yellow-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Demo Mode</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    You are currently using SVL-SMS in demo mode. Some features are limited.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Plan:</span>
                    <span className="font-medium text-gray-900">Demo</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Days Remaining:</span>
                    <span className="font-medium text-gray-900">{daysRemaining || 0} days</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Max Students:</span>
                    <span className="font-medium text-gray-900">50</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Limited Features:</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• Export functionality is disabled</li>
                    <li>• Reports are not available</li>
                    <li>• Maximum 50 student records</li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (isExpired) {
    return (
      <div className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-md">
        LICENSE EXPIRED
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
      >
        <Calendar size={14} />
        {daysRemaining || 0}d
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar size={20} className="text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">License Status</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Plan:</span>
                  <span className="font-medium text-gray-900 capitalize">{planTier}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Days Remaining:</span>
                  <span className="font-medium text-gray-900">{daysRemaining || 0} days</span>
                </div>
                {expiry && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Expires:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(expiry).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
