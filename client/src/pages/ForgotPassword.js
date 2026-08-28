import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from '../components/PasswordInput';

const Flower = () => (
  <img src="/logo.png" alt="Growing Success Garden" style={{ width: '90px', height: '90px', objectFit: 'contain' }} />
);

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter new password
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/forgot-password', { email });
      setUserName(res.data.name || '');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/auth/forgot-password', { email, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-logo"><Flower /></div>
      <h1>Growing Success Garden</h1>
      <p>{step === 1 ? 'Reset your password' : `Hi ${userName || 'there'} — choose a new password`}</p>

      {error && <div className="alert alert-error">{error}</div>}

      {done ? (
        <div className="alert alert-success" style={{ textAlign: 'center', lineHeight: '1.6' }}>
          <strong>Password updated!</strong><br />
          Redirecting you to login…
        </div>
      ) : step === 1 ? (
        <form onSubmit={handleVerifyEmail}>
          <div className="form-group">
            <label>Email address on your account</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your account email"
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword}>
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
          <button
            type="button"
            onClick={() => { setStep(1); setError(''); setPassword(''); setConfirm(''); }}
            style={{ width: '100%', marginTop: '0.5rem', background: 'none', border: 'none', color: '#97B3AE', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ← Use a different email
          </button>
        </form>
      )}

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link to="/login">← Back to login</Link>
      </p>
    </div>
  );
}

export default ForgotPassword;
