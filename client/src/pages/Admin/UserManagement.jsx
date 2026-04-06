import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

const ROLES = ['deo', 'editor', 'handler', 'admin'];
const EMPTY_FORM = { username: '', password: '', role: 'deo' };

function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function UserManagement() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [resetState, setResetState] = useState({}); // { [userId]: { password, saving } }

  useEffect(() => {
    api.get('/users')
      .then(res => setUsers(res.data))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleCreate() {
    if (!form.username || !form.password || !form.role) {
      setError('Username, password, and role are required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/users', form);
      setUsers(prev => [...prev, res.data]);
      setForm(EMPTY_FORM);
      setSuccess(`User "${res.data.username}" created.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(user) {
    const action = user.is_active ? 'Deactivate' : 'Activate';
    if (!window.confirm(`${action} user "${user.username}"?`)) return;
    try {
      const res = await api.patch(`/users/${user.id}/active`);
      setUsers(prev => prev.map(u => u.id === res.data.id ? res.data : u));
      setSuccess(`User "${user.username}" ${res.data.is_active ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  }

  function openReset(userId) {
    setResetState(prev => ({ ...prev, [userId]: { password: '', saving: false } }));
  }

  function closeReset(userId) {
    setResetState(prev => { const s = { ...prev }; delete s[userId]; return s; });
  }

  async function handleResetPassword(user) {
    const pwd = resetState[user.id]?.password;
    if (!pwd || pwd.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    setError('');
    setResetState(prev => ({ ...prev, [user.id]: { ...prev[user.id], saving: true } }));
    try {
      await api.patch(`/users/${user.id}/password`, { password: pwd });
      setSuccess(`Password updated for "${user.username}".`);
      closeReset(user.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
      setResetState(prev => ({ ...prev, [user.id]: { ...prev[user.id], saving: false } }));
    }
  }

  const roleBadgeColor = {
    admin:   { background: '#fef3c7', color: '#92400e' },
    editor:  { background: '#dbeafe', color: '#1e40af' },
    deo:     { background: '#d1fae5', color: '#065f46' },
    handler: { background: '#ede9fe', color: '#5b21b6' },
  };

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">User Management</h2>
            <p className="page-subtitle">Create and manage system users</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        {/* ── Create User Form ── */}
        <div className="order-form-card" style={{ marginBottom: 24 }}>
          <div className="detail-section-title" style={{ marginBottom: 16 }}>New User</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Username <span className="required">*</span></label>
              <input
                type="text" name="username" value={form.username}
                onChange={handleChange} placeholder="e.g. john_doe"
              />
            </div>
            <div className="form-group">
              <label>Role <span className="required">*</span></label>
              <select name="role" value={form.role} onChange={handleChange}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Password <span className="required">*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" name="password" value={form.password}
                  onChange={handleChange} placeholder="Set password"
                  style={{ flex: 1 }}
                />
                <button
                  type="button" className="btn-ghost btn-sm"
                  onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}
                  title="Generate password"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>

        {/* ── Users Table ── */}
        <div className="table-card">
          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Reset Password</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan="5" className="no-data">No users found.</td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                      <td><strong>{u.username}</strong></td>
                      <td>
                        <span className="badge" style={roleBadgeColor[u.role] || {}}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                          background: u.is_active ? '#d1fae5' : '#fee2e2',
                          color: u.is_active ? '#065f46' : '#991b1b',
                        }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {resetState[u.id] ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={resetState[u.id].password}
                              onChange={e => setResetState(prev => ({ ...prev, [u.id]: { ...prev[u.id], password: e.target.value } }))}
                              placeholder="New password"
                              style={{ width: 130, padding: '3px 8px', fontSize: 13 }}
                            />
                            <button
                              className="btn-ghost btn-sm"
                              style={{ fontSize: 11 }}
                              onClick={() => setResetState(prev => ({ ...prev, [u.id]: { ...prev[u.id], password: generatePassword() } }))}
                            >Gen</button>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => handleResetPassword(u)}
                              disabled={resetState[u.id].saving}
                            >{resetState[u.id].saving ? '…' : 'Save'}</button>
                            <button className="btn-ghost btn-sm" onClick={() => closeReset(u.id)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn-ghost btn-sm" onClick={() => openReset(u.id)}>
                            Reset Password
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-ghost btn-sm"
                          style={{
                            borderColor: u.is_active ? '#fecaca' : '#bbf7d0',
                            color: u.is_active ? 'var(--danger)' : '#065f46',
                          }}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
