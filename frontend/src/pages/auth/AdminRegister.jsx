import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Phone, Shield, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAuthErrorMessage } from '../../services/api';
import { isLocalDemoMode } from '../../config/authMode';

export default function AdminRegister() {
  const navigate = useNavigate();
  const { registerAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    invite_code: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { confirmPassword, ...registrationData } = formData;
      await registerAdmin(registrationData);
      navigate('/admin', { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Unable to create the admin account. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocalDemoMode) {
    return (
      <div className="min-h-screen bg-[#27334f] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#fffdfa] rounded-premium p-8 md:p-12 text-center shadow-card">
          <Shield className="w-10 h-10 text-brand-ink mx-auto mb-4" aria-hidden="true" />
          <h1 className="font-display font-bold text-2xl text-[#27334f] mb-3">Admin registration unavailable</h1>
          <p className="text-neutral-text mb-6">Admin registration requires API mode and a server-configured invitation code.</p>
          <Link to="/admin/login" className="px-6 py-3 bg-[#27334f] text-white rounded-full font-semibold">
            Admin sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#27334f] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-[#fffdfa] rounded-premium p-8 md:p-12 border border-[#e4e6eb] shadow-card">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#fce6da] flex items-center justify-center text-[#ad4f1b] font-bold">A</div>
            <span className="font-display font-bold text-2xl text-[#27334f]">Gramamitra Admin</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-[#27334f] mb-2">Create Admin Account</h1>
          <p className="text-neutral-muted text-sm">An authorized invitation is required to register.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="admin-register-name" className="block text-sm font-medium text-neutral-text">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" aria-hidden="true" />
              <input
                type="text"
                id="admin-register-name"
                required
                autoComplete="name"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-register-email" className="block text-sm font-medium text-neutral-text">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" aria-hidden="true" />
              <input
                type="email"
                id="admin-register-email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-register-phone" className="block text-sm font-medium text-neutral-text">Phone Number <span className="text-neutral-muted">(optional)</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" aria-hidden="true" />
              <input
                type="tel"
                id="admin-register-phone"
                autoComplete="tel"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-register-password" className="block text-sm font-medium text-neutral-text">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" aria-hidden="true" />
              <input
                type="password"
                id="admin-register-password"
                required
                minLength={8}
                autoComplete="new-password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-register-confirm-password" className="block text-sm font-medium text-neutral-text">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" aria-hidden="true" />
              <input
                type="password"
                id="admin-register-confirm-password"
                required
                minLength={8}
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-register-invite-code" className="block text-sm font-medium text-neutral-text">Admin Invitation Code</label>
            <div className="relative">
              <Shield className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" aria-hidden="true" />
              <input
                type="password"
                id="admin-register-invite-code"
                required
                autoComplete="off"
                value={formData.invite_code}
                onChange={(event) => setFormData({ ...formData, invite_code: event.target.value })}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-8 py-4 bg-[#27334f] text-white rounded-full font-bold text-lg tracking-widest uppercase shadow-card hover:scale-105 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Create Admin Account'} <ArrowRight className="w-4 h-4 inline ml-2" aria-hidden="true" />
          </button>
        </form>

        <p className="mt-6 text-center text-neutral-muted text-sm">
          Already have an admin account?{' '}
          <Link to="/admin/login" className="text-[#27334f] font-medium hover:underline">Admin sign in</Link>
        </p>
      </div>
    </div>
  );
}
