'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface AdminSetting {
  id: string;
  settingKey: string;
  settingValue: string;
  settingType: 'number' | 'string' | 'boolean' | 'json';
  description?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface SettingsByCategory {
  [category: string]: AdminSetting[];
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editedValues, setEditedValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/admin/settings'));
      if (response.ok) {
        const data = await response.json();
        
        // Group settings by category
        const grouped = data.data.reduce((acc: SettingsByCategory, setting: AdminSetting) => {
          if (!acc[setting.category]) {
            acc[setting.category] = [];
          }
          acc[setting.category].push(setting);
          return acc;
        }, {});
        
        setSettings(grouped);
      } else {
        throw new Error('Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      setSaving(key);
      const response = await fetch(getApiUrl(`/api/admin/settings/${key}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Setting "${key}" updated successfully` });
        await fetchSettings(); // Refresh settings
        
        // Clear edited value
        const newEditedValues = { ...editedValues };
        delete newEditedValues[key];
        setEditedValues(newEditedValues);
      } else {
        throw new Error('Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      setMessage({ type: 'error', text: `Failed to update setting "${key}"` });
    } finally {
      setSaving(null);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/admin/reset-defaults'), {
        method: 'POST',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings reset to defaults successfully' });
        await fetchSettings();
        setEditedValues({});
      } else {
        throw new Error('Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      setMessage({ type: 'error', text: 'Failed to reset settings to defaults' });
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const hasChanges = (setting: AdminSetting) => {
    return editedValues[setting.settingKey] !== undefined && 
           editedValues[setting.settingKey] !== setting.settingValue;
  };

  const getCurrentValue = (setting: AdminSetting) => {
    return editedValues[setting.settingKey] !== undefined 
      ? editedValues[setting.settingKey] 
      : setting.settingValue;
  };

  const renderSettingInput = (setting: AdminSetting) => {
    const currentValue = getCurrentValue(setting);
    const isChanged = hasChanges(setting);
    const isSaving = saving === setting.settingKey;

    switch (setting.settingType) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={currentValue === 'true'}
              onChange={(e) => handleValueChange(setting.settingKey, e.target.checked.toString())}
              className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              disabled={isSaving}
            />
            <span className={`text-sm font-medium ${currentValue === 'true' ? 'text-green-700' : 'text-gray-600'}`}>
              {currentValue === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(setting.settingKey, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
            disabled={isSaving}
          />
        );

      case 'json':
        return (
          <textarea
            value={currentValue}
            onChange={(e) => handleValueChange(setting.settingKey, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
            rows={3}
            disabled={isSaving}
          />
        );

      default:
        return (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleValueChange(setting.settingKey, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
            disabled={isSaving}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="h-7 w-7 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
        </div>
        <button
          onClick={resetToDefaults}
          className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md font-medium"
          disabled={loading}
        >
          <RotateCcw className="h-5 w-5" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-3 shadow-md border ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border-green-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-6 w-6" />
          ) : (
            <AlertCircle className="h-6 w-6" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(settings).map(([category, categorySettings]) => (
          <div key={category} className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 capitalize flex items-center">
              <div className="w-2 h-6 bg-blue-600 rounded-full mr-3"></div>
              {category} Settings
            </h2>
            <div className="space-y-6">
              {categorySettings.map((setting) => (
                <div key={setting.settingKey} className="border-b border-gray-100 pb-6 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <label className="text-base font-semibold text-gray-800">
                          {setting.settingKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        {hasChanges(setting) && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
                            Modified
                          </span>
                        )}
                      </div>
                      {setting.description && (
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed">{setting.description}</p>
                      )}
                      <div className="max-w-md">
                        {renderSettingInput(setting)}
                      </div>
                    </div>
                    {hasChanges(setting) && (
                      <button
                        onClick={() => updateSetting(setting.settingKey, editedValues[setting.settingKey])}
                        disabled={saving === setting.settingKey}
                        className="ml-6 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md font-medium"
                      >
                        {saving === setting.settingKey ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        <span>Save</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
