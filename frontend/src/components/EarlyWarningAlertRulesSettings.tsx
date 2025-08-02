import React, { useState, useEffect } from 'react';
import { Trash2, Edit, Plus, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface EarlyWarningAlertRule {
  id: string;
  name: string;
  description?: string;
  minConfidence: number;
  alertTypes: string[];
  requiredPhases?: string[];
  minPhaseScore?: number;
  minTimeEstimate?: number;
  maxTimeEstimate?: number;
  requiredTriggers?: string[];
  priority: string;
  enableToast: boolean;
  enableSound: boolean;
  isActive: boolean;
  lastTriggered?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

const alertTypeOptions = [
  { value: 'PUMP_LIKELY', label: '🚀 Pump Likely' },
  { value: 'DUMP_LIKELY', label: '📉 Dump Likely' }
];



const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' }
];

const EarlyWarningAlertRulesSettings: React.FC = () => {
  const [rules, setRules] = useState<EarlyWarningAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<EarlyWarningAlertRule | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    minConfidence: 70,
    alertTypes: [] as string[],
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH'
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch(getApiUrl('/api/early-warning-alert-rules'));
      const data = await response.json();
      
      if (data.success) {
        setRules(data.data);
      } else {
        setMessage({ type: 'error', text: 'Failed to fetch early warning alert rules' });
      }
    } catch (error) {
      console.error('Error fetching early warning alert rules:', error);
      setMessage({ type: 'error', text: 'Failed to fetch early warning alert rules' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || formData.alertTypes.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in required fields' });
      return;
    }

    try {
      const payload = {
        ...formData
      };

      const url = editingRule
        ? getApiUrl(`/api/early-warning-alert-rules/${editingRule.id}`)
        : getApiUrl('/api/early-warning-alert-rules');

      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: `Early warning alert rule ${editingRule ? 'updated' : 'created'} successfully` });
        await fetchRules();
        resetForm();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save early warning alert rule' });
      }
    } catch (error) {
      console.error('Error saving early warning alert rule:', error);
      setMessage({ type: 'error', text: 'Failed to save early warning alert rule' });
    }
  };

  const handleEdit = (rule: EarlyWarningAlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      minConfidence: rule.minConfidence,
      alertTypes: rule.alertTypes,
      priority: rule.priority as 'LOW' | 'MEDIUM' | 'HIGH'
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this early warning alert rule?')) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/early-warning-alert-rules/${id}`), {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Early warning alert rule deleted successfully' });
        await fetchRules();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete early warning alert rule' });
      }
    } catch (error) {
      console.error('Error deleting early warning alert rule:', error);
      setMessage({ type: 'error', text: 'Failed to delete early warning alert rule' });
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/early-warning-alert-rules/${id}/toggle`), {
        method: 'PATCH',
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: `Early warning alert rule ${data.data.isActive ? 'activated' : 'deactivated'}` });
        await fetchRules();
      } else {
        setMessage({ type: 'error', text: 'Failed to toggle early warning alert rule' });
      }
    } catch (error) {
      console.error('Error toggling early warning alert rule:', error);
      setMessage({ type: 'error', text: 'Failed to toggle early warning alert rule' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      minConfidence: 70,
      alertTypes: [],
      priority: 'MEDIUM'
    });
    setEditingRule(null);
    setShowForm(false);
    setMessage(null);
  };

  const handleArrayFieldChange = (field: 'alertTypes', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item: string) => item !== value)
        : [...prev[field], value]
    }));
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
          <Zap className="h-7 w-7 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Early Warning Alert Rules</h1>
        </div>
        <button
          onClick={() => {
            setMessage(null);
            setShowForm(true);
          }}
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
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Zap className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Rules Configured</h3>
                      <p className="text-gray-500 mb-4">Create your first early warning alert rule to get started</p>
                      <button
                        onClick={() => {
                          setMessage(null);
                          setShowForm(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Create First Rule
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div>
                        <div className="text-base font-semibold text-gray-900">{rule.name}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-sm text-gray-700">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span>Confidence ≥ {rule.minConfidence}%</span>
                        </div>
                        {rule.alertTypes.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span>Types: {rule.alertTypes.join(', ').replace(/_/g, ' ')}</span>
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
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                        rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
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
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete rule"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    placeholder="Enter rule name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Minimum Confidence (%) *
                  </label>
                  <input
                    type="text"
                    value={formData.minConfidence}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numbers and ensure it's between 0-100
                      if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
                        setFormData(prev => ({ ...prev, minConfidence: value === '' ? 0 : parseInt(value) }));
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="Enter confidence percentage (0-100)"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Alert Types *
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {alertTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleArrayFieldChange('alertTypes', option.value)}
                      className={`px-3 py-1 text-sm font-medium rounded-full border transition-colors ${
                        formData.alertTypes.includes(option.value)
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-md font-medium"
                >
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium"
                >
                  <span>{editingRule ? 'Update Rule' : 'Create Rule'}</span>
                </button>
              </div>
            </form>
        </div>
      )}
    </div>
  );
};

export default EarlyWarningAlertRulesSettings;
