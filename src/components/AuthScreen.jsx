import React, { useState } from 'react';
import { Icon } from './Icons.jsx';

export function AuthScreen({ repository, onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (step === 'email') {
        await repository.requestOtp(email);
        setStep('token');
      } else {
        await repository.verifyOtp(email, token);
        onAuthenticated();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-logo"><Icon name="users" size={28} /></div>
      <h1>Leet Room</h1>
      <p>Solve together. Grow together.</p>
      <form className="auth-card" onSubmit={submit}>
        <h2>{step === 'email' ? 'Sign in to your team' : 'Check your inbox'}</h2>
        <p>{step === 'email' ? 'Use your email to create or access your profile.' : `Enter the one-time code sent to ${email}.`}</p>
        {step === 'email' ? (
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoFocus /></label>
        ) : (
          <label>One-time code<input value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="123456" inputMode="numeric" required autoFocus /></label>
        )}
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button full" disabled={busy}>{busy ? 'Please wait…' : step === 'email' ? 'Send sign-in code' : 'Verify and continue'}</button>
        {step === 'token' && <button type="button" className="text-button" onClick={() => setStep('email')}>Use another email</button>}
      </form>
    </main>
  );
}
