'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Edit, Trash2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  minConfidence?: number;
  minStrength?: number;
  requiredTimeframes?: number;
  specificTimeframes?: string[];
  requiredSignalType?: 'BUY' | 'SELL' | 'HOLD';
  advancedConditions?: any;
  enableSound: boolean;
  enableVisual: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
}

interface RuleFormData {
  name: string;
  description: string;
  isActive: boolean;
  minConfidence: string;
  minStrength: string;
  requiredTimeframes: string;
  specificTimeframes: string[];
  requiredSignalType: string;
  enableSound: boolean;
  enableVisual: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

const initialFormData: RuleFormData = {
  name: '',
  description: '',
  isActive: true,
  minConfidence: '',
  minStrength: '',
  requiredTimeframes: '',
  specificTimeframes: [],
  requiredSignalType: '',
  enableSound: true,
  enableVisual: true,
  priority: 'MEDIUM'
};

const AVAILABLE_TIMEFRAMES = [
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' }
];

export default function NotificationRules() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/admin/notification-rules'));
      if (response.ok) {
        const data = await response.json();
        setRules(data.data);
      } else {
        throw new Error('Failed to fetch rules');
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
      setMessage({ type: 'error', text: 'Failed to load notification rules' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Rule name is required' });
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        isActive: formData.isActive,
        minConfidence: formData.minConfidence ? parseFloat(formData.minConfidence) : undefined,
        minStrength: formData.minStrength ? parseFloat(formData.minStrength) : undefined,
        requiredTimeframes: formData.requiredTimeframes ? parseInt(formData.requiredTimeframes) : undefined,
        specificTimeframes: formData.specificTimeframes.length > 0 ? formData.specificTimeframes : undefined,
        requiredSignalType: formData.requiredSignalType || undefined,
        enableSound: formData.enableSound,
        enableVisual: formData.enableVisual,
        priority: formData.priority
      };

      const url = editingRule 
        ? getApiUrl(`/api/admin/notification-rules/${editingRule.id}`)
        : getApiUrl('/api/admin/notification-rules');
      
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Rule ${editingRule ? 'updated' : 'created'} successfully` 
        });
        await fetchRules();
        handleCancel();
      } else {
        throw new Error(`Failed to ${editingRule ? 'update' : 'create'} rule`);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to ${editingRule ? 'update' : 'create'} rule` 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      isActive: rule.isActive,
      minConfidence: rule.minConfidence?.toString() || '',
      minStrength: rule.minStrength?.toString() || '',
      requiredTimeframes: rule.requiredTimeframes?.toString() || '',
      specificTimeframes: rule.specificTimeframes || [],
      requiredSignalType: rule.requiredSignalType || '',
      enableSound: rule.enableSound,
      enableVisual: rule.enableVisual,
      priority: rule.priority
    });
    setShowForm(true);
  };

  // Helper functions for timeframe management
  const addTimeframeSlot = () => {
    setFormData(prev => ({
      ...prev,
      specificTimeframes: [...prev.specificTimeframes, '']
    }));
  };

  const removeTimeframeSlot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specificTimeframes: prev.specificTimeframes.filter((_, i) => i !== index)
    }));
  };

  const updateTimeframeSlot = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      specificTimeframes: prev.specificTimeframes.map((tf, i) => i === index ? value : tf)
    }));
  };

  const getAvailableTimeframes = (currentIndex: number) => {
    const selectedTimeframes = formData.specificTimeframes.filter((tf, i) => i !== currentIndex && tf !== '');
    return AVAILABLE_TIMEFRAMES.filter(tf => !selectedTimeframes.includes(tf.value));
  };

  const handleDelete = async (rule: NotificationRule) => {
    if (!confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/admin/notification-rules/${rule.id}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Rule deleted successfully' });
        await fetchRules();
      } else {
        throw new Error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      setMessage({ type: 'error', text: 'Failed to delete rule' });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRule(null);
    setFormData(initialFormData);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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
          <Bell className="h-7 w-7 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Notification Rules</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium"
        >
          <Plus className="h-5 w-5" />
          <span>Add Rule</span>
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

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <div className="w-2 h-6 bg-blue-600 rounded-full mr-3"></div>
            {editingRule ? 'Edit Rule' : 'Create New Rule'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Min Confidence (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.minConfidence}
                  onChange={(e) => setFormData(prev => ({ ...prev, minConfidence: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Min Strength (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.minStrength}
                  onChange={(e) => setFormData(prev => ({ ...prev, minStrength: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Specific Timeframes
                </label>
                <div className="space-y-3">
                  {formData.specificTimeframes.map((timeframe, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <select
                        value={timeframe}
                        onChange={(e) => updateTimeframeSlot(index, e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                      >
                        <option value="">Select Timeframe</option>
                        {getAvailableTimeframes(index).map((tf) => (
                          <option key={tf.value} value={tf.value}>
                            {tf.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeTimeframeSlot(index)}
                        className="px-3 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTimeframeSlot}
                    disabled={formData.specificTimeframes.length >= AVAILABLE_TIMEFRAMES.length}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Timeframe</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Required Signal Type
              </label>
              <select
                value={formData.requiredSignalType}
                onChange={(e) => setFormData(prev => ({ ...prev, requiredSignalType: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
              >
                <option value="">Any Signal Type</option>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="HOLD">HOLD</option>
              </select>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Rule Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.enableSound}
                    onChange={(e) => setFormData(prev => ({ ...prev, enableSound: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Sound Notifications</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.enableVisual}
                    onChange={(e) => setFormData(prev => ({ ...prev, enableVisual: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Visual Notifications</span>
                </label>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md font-medium"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-5 w-5" />
                )}
                <span>{editingRule ? 'Update' : 'Create'} Rule</span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-md font-medium"
              >
                <X className="h-5 w-5" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-8 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Rule
                </th>
                <th className="px-8 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Conditions
                </th>
                <th className="px-8 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-8 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-8 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div>
                      <div className="text-base font-semibold text-gray-900">{rule.name}</div>
                      {rule.description && (
                        <div className="text-sm text-gray-600 mt-1">{rule.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap text-sm text-gray-700">
                    <div className="space-y-2">
                      {rule.minConfidence && (
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span>Confidence ≥ {rule.minConfidence}%</span>
                        </div>
                      )}
                      {rule.minStrength && (
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span>Strength ≥ {rule.minStrength}%</span>
                        </div>
                      )}
                      {rule.requiredTimeframes && (
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                          <span>Timeframes ≥ {rule.requiredTimeframes}</span>
                        </div>
                      )}
                      {rule.requiredSignalType && (
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          <span>Signal: {rule.requiredSignalType}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getPriorityColor(rule.priority)}`}>
                      {rule.priority}
                    </span>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                        rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex space-x-2">
                        {rule.enableSound && (
                          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">🔊</span>
                        )}
                        {rule.enableVisual && (
                          <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">👁️</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit rule"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
