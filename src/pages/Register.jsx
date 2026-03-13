import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import Notice from '../components/Notice';

export default function Register() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    businessType: '',
  });
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      const data = await api.register(form);
      const businessId = data.business?.id || '';
      setSession(data.token, data.user, businessId);
      navigate('/app');
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl card">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-slate-900 dark:text-white">Create your workspace</h1>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400">Set up your business and start managing inventory today.</p>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="label">Owner name</label>
            <input
              className="input mt-1"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input mt-1"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input mt-1"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label">Business name</label>
            <input
              className="input mt-1"
              name="businessName"
              value={form.businessName}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label">Business type</label>
            <input
              className="input mt-1"
              name="businessType"
              value={form.businessType}
              onChange={handleChange}
              placeholder="Retail, Auto, Service"
              required
            />
          </div>
          {status.message ? (
            <div className="md:col-span-2">
              <Notice title={status.message} tone={status.type} />
            </div>
          ) : null}
          <div className="md:col-span-2">
            <button className="btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create account'}
            </button>
          </div>
        </form>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link className="text-emerald-600 hover:text-emerald-500 dark:text-ocean dark:hover:text-teal-300" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
