import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from '../components/PasswordInput';

function Settings() {
  const [settings, setSettings] = useState({
    geminiApiKey: '',
    gradeFormat: 'percentage',
    theme: 'light',
    emailUser: '',
    emailPass: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(response.data);
    } catch (err) {
      setError('Failed to load settings');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.put('http://localhost:5000/api/settings', settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('Settings saved successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </button>

      <h1>Settings</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <h2>Gemini API Configuration</h2>
        <p className="text-muted">
          Your Gemini API key is stored securely and used only for comment generation.
        </p>

        <form onSubmit={handleSaveSettings}>
          <div className="form-group">
            <label>Gemini API Key</label>
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) =>
                setSettings({ ...settings, geminiApiKey: e.target.value })
              }
              placeholder="Enter your Gemini API key"
            />
            <p className="text-muted mt-1">
              Get your free API key at{' '}
              <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer">
                Google AI Studio
              </a>
            </p>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label>Grade Format (Elementary)</label>
              <select
                value={settings.gradeFormat}
                onChange={(e) =>
                  setSettings({ ...settings, gradeFormat: e.target.value })
                }
              >
                <option value="percentage">Percentage (0-100)</option>
                <option value="letter">Letter Grade (A-F)</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="form-group">
              <label>Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
              >
                <option value="light">Light</option>
                <option value="dark">Dark (Coming Soon)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-success" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Email — Forgot Password</h2>
        <p className="text-muted">
          To enable the "Forgot Password" feature, enter your Gmail address and a Gmail <strong>App Password</strong>.
          This is used only to send you a reset link — your credentials are stored locally.
        </p>
        <form onSubmit={handleSaveSettings}>
          <div className="form-group">
            <label>Your Gmail address</label>
            <input
              type="email"
              value={settings.emailUser || ''}
              onChange={e => setSettings({ ...settings, emailUser: e.target.value })}
              placeholder="yourname@gmail.com"
            />
          </div>
          <div className="form-group">
            <label>Gmail App Password</label>
            <PasswordInput
              value={settings.emailPass || ''}
              onChange={e => setSettings({ ...settings, emailPass: e.target.value })}
              placeholder="xxxx xxxx xxxx xxxx"
            />
            <p className="text-muted mt-1">
              This is NOT your regular Gmail password. Go to{' '}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                myaccount.google.com/apppasswords
              </a>{' '}
              → select "Mail" → generate a 16-character app password and paste it here.
            </p>
          </div>
          <button type="submit" className="btn-success" disabled={loading}>
            {loading ? 'Saving...' : 'Save Email Settings'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>How to Get Your Gemini API Key</h2>
        <ol>
          <li>
            Visit{' '}
            <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer">
              Google AI Studio
            </a>
          </li>
          <li>Sign in with your Google account</li>
          <li>Click "Get API Key" in the left navigation</li>
          <li>Click "Create API Key"</li>
          <li>Copy the key and paste it above</li>
          <li>Click "Save Settings"</li>
        </ol>
        <p className="text-muted">
          The free tier offers 1,500 requests per day. Generate a few report card comments and
          it'll only cost a few cents.
        </p>
      </div>

      <div className="card">
        <h2>About This App</h2>
        <p>
          <strong>Report Card AI</strong> is an AI-powered assistant for Ontario teachers to help
          write personalized, engaging report card comments.
        </p>
        <p>
          <strong>Features:</strong>
        </p>
        <ul>
          <li>Create classes with Ontario curriculum subjects</li>
          <li>Import student lists from Excel</li>
          <li>Track grades and calculate overall scores</li>
          <li>Generate AI-powered report card comments</li>
          <li>Assess learning skills (Responsibility, Independence, etc.)</li>
          <li>Personalized comments based on student performance and classroom context</li>
        </ul>
      </div>
    </div>
  );
}

export default Settings;
