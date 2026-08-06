import { useState } from 'react';
import { Check, AlertCircle, Loader } from 'lucide-react';
import api from '../../utils/api';
import { useLicense } from '../../contexts/LicenseContext';

type Step = 'mode-selection' | 'license-entry' | 'demo-setup' | 'success';

export default function SetupWizard() {
  const { setMode, refetchLicense } = useLicense();
  const [currentStep, setCurrentStep] = useState<Step>('mode-selection');
  const [licenseKey, setLicenseKey] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ expiryDate: string; planTier: string } | null>(null);

  const handleModeSelection = (selectedMode: 'demo' | 'production') => {
    if (selectedMode === 'demo') {
      setMode('demo');
      setCurrentStep('demo-setup');
    } else {
      setCurrentStep('license-entry');
      setError(null);
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const res = await api.post('/licensing/activate', { key: licenseKey });
      const { expiry, plan_tier } = res.data;

      setMode('production');
      setSuccessData({
        expiryDate: new Date(expiry).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        planTier: plan_tier,
      });
      setCurrentStep('success');
      await refetchLicense();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to activate license. Please check your key and try again.';
      setError(errorMsg);
    } finally {
      setIsChecking(false);
    }
  };

  const handleContinue = () => {
    // Store that setup wizard has been completed
    localStorage.setItem('svl_setup_wizard_completed', 'true');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        {/* Mode Selection */}
        {currentStep === 'mode-selection' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to SVL-SMS</h1>
              <p className="text-gray-600">Choose how you'd like to get started</p>
            </div>

            <div className="space-y-4">
              {/* Demo Mode */}
              <button
                onClick={() => handleModeSelection('demo')}
                className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600">DEMO MODE</h3>
                <p className="text-sm text-gray-600 group-hover:text-gray-700">
                  Test the software for 30 days. Full features. Not for live data.
                </p>
              </button>

              {/* Production Mode */}
              <button
                onClick={() => handleModeSelection('production')}
                className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left group"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-green-600">PRODUCTION MODE</h3>
                <p className="text-sm text-gray-600 group-hover:text-gray-700">
                  Enter your license key for real-time usage. Unlimited. Professional support.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* License Entry */}
        {currentStep === 'license-entry' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter License Key</h1>
              <p className="text-gray-600">Activate your production license</p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="License Key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={isChecking}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
              />

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleActivateLicense}
                disabled={isChecking || !licenseKey.trim()}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isChecking && <Loader size={18} className="animate-spin" />}
                {isChecking ? 'Checking...' : 'Activate'}
              </button>

              <button
                onClick={() => setCurrentStep('mode-selection')}
                disabled={isChecking}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Demo Setup */}
        {currentStep === 'demo-setup' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-yellow-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Demo Mode Active</h1>
              <p className="text-gray-600">30 days remaining</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                You can test all features of SVL-SMS for 30 days. Your data will not be persisted after the demo period ends.
              </p>
            </div>

            <button
              onClick={handleContinue}
              className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              Start Testing
            </button>
          </div>
        )}

        {/* Success */}
        {currentStep === 'success' && successData && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">License Activated</h1>
              <p className="text-gray-600">Your production license is active</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Plan:</span> {successData.planTier}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Active Until:</span> {successData.expiryDate}
                </p>
              </div>
            </div>

            <button
              onClick={handleContinue}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Start Using
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
