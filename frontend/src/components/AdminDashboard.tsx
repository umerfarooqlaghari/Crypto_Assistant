'use client';

import { useState } from 'react';
import { Bell, Settings, Zap } from 'lucide-react';
import NotificationRules from './NotificationRules';
import EarlyWarningAlertRulesSettings from './EarlyWarningAlertRulesSettings';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'early-warning'>('notifications');

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Settings className="h-7 w-7 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="text-sm text-gray-600">
              System Configuration
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <Bell className="h-4 w-4" />
              <span>Notification Rules</span>
            </button>
            <button
              onClick={() => setActiveTab('early-warning')}
              className={`${
                activeTab === 'early-warning'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <Zap className="h-4 w-4" />
              <span>Early Warning Alerts</span>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'notifications' && <NotificationRules />}
        {activeTab === 'early-warning' && <EarlyWarningAlertRulesSettings />}
      </div>
    </div>
  );
}
