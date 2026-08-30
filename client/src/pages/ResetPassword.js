import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from '../components/PasswordInput';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <h1 style={{ textAlign: 'center', color: '#c9897e' }}>Invalid Link</h1>
        <p style={{ textAlign: 'center' }}>This reset link is missing or broken.</p>
        <p style={{ textAlign: 'center' }}>
          <Link to="/forgot-password">Request a new one</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-logo">
        <svg width="60" height="60" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="20" cy="9"  rx="4.5" ry="7" fill="#F2C3B9"/>
          <ellipse cx="20" cy="31" rx="4.5" ry="7" fill="#F2C3B9"/>
          <ellipse cx="9"  cy="14" rx="7" ry="4.5" transform="rotate(-60 9 14)"  fill="#F0DDD6"/>
          <ellipse cx="31" cy="26" rx="7" ry="4.5" transform="rotate(-60 31 26)" fill="#F0DDD6"/>
          <ellipse cx="9"  cy="26" rx="7" ry="4.5" transform="rotate(60 9 26)"   fill="#F0DDD6"/>
          <ellipse cx="31" cy="14" rx="7" ry="4.5" transform="rotate(60 31 14)"  fill="#F2C3B9"/>
          <circle cx="20" cy="20" r="7" fill="#D6CBBF"/>
          <circle cx="20" cy="20" r="4" fill="white"/>
          <circle cx="20" cy="20" r="2" fill="#97B3AE"/>
        </svg>
      </div>
      <h1>Growing Success Garden</h1>
      <p>Choose a new password</p>

      {error && <div className="alert alert-error">{error}</div>}

      {done ? (
        <div className="alert alert-success" style={{ textAlign: 'center', lineHeight: '1.6' }}>
          <strong>Password updated!</strong><br />
          Redirecting you to login…
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New password</label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label>Confirm new password</label>
            <PasswordInput
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Type it again"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link to="/login">← Back to login</Link>
      </p>
    </div>
  );
}

export default ResetPassword;
