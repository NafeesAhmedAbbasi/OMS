import { useEffect, useState } from 'react';
import api from '../../api';
import AppLayout from '../../components/AppLayout';

export default function AdminSettings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [newName, setNewName]   = useState('');
  const [newKey, setNewKey]     = useState('');
  const [adding, setAdding]     = useState(false);
  const [testing, setTesting]   = useState(null); // account id being tested
  const [testResults, setTestResults] = useState({}); // id -> 'ok'|'fail'

  useEffect(() => {
    api.get('/settings/storenvy-accounts')
      .then(res => setAccounts(res.data))
      .catch(() => setError('Failed to load accounts'))
      .finally(() => setLoading(false));
  }, []);

  async function addAccount() {
    if (!newName.trim() || !newKey.trim()) return setError('Name and API key are required');
    setAdding(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/settings/storenvy-accounts', { name: newName.trim(), api_key: newKey.trim() });
      setAccounts(prev => [...prev, res.data]);
      setNewName(''); setNewKey('');
      setSuccess(`"${res.data.name}" added.`);
    } catch (err) { setError(err.response?.data?.error || 'Failed to add'); }
    finally { setAdding(false); }
  }

  async function deleteAccount(id, name) {
    if (!window.confirm(`Remove "${name}"?`)) return;
    try {
      await api.delete(`/settings/storenvy-accounts/${id}`);
      setAccounts(prev => prev.filter(a => a.id !== id));
      setTestResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete'); }
  }

  async function testAccount(id) {
    setTesting(id); setTestResults(prev => ({ ...prev, [id]: null }));
    try {
      const res = await api.get(`/settings/storenvy-accounts/${id}/orders`);
      const count = res.data?.orders?.length ?? 0;
      setTestResults(prev => ({ ...prev, [id]: { ok: true, msg: `${count} orders fetched` } }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: err.response?.data?.error || 'Connection failed' } }));
    } finally { setTesting(null); }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Settings</h2>
            <p className="page-subtitle">Store Envy integrations</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        <div className="table-card" style={{ padding: 24, maxWidth: 640 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Store Envy Accounts</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Add one account per Store Envy store. DEO can import orders from any of these.
          </div>

          {/* Add form */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: '1 1 160px' }}>
              <label>Account Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Main Store, EU Store" />
            </div>
            <div className="form-group" style={{ margin: 0, flex: '2 1 220px' }}>
              <label>API Key</label>
              <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)}
                placeholder="Store Envy API key" style={{ fontFamily: 'monospace' }} />
            </div>
            <button className="btn-primary" onClick={addAccount} disabled={adding}>
              {adding ? 'Adding…' : 'Add Account'}
            </button>
          </div>

          {/* Accounts list */}
          {loading ? <div className="loading-state">Loading…</div> : accounts.length === 0 ? (
            <div className="no-data">No accounts yet. Add one above.</div>
          ) : (
            <table className="orders-table">
              <thead>
                <tr><th>Name</th><th>Added</th><th>Test</th><th></th></tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.created_at?.slice(0, 10)}</td>
                    <td>
                      <button className="btn-ghost btn-sm" onClick={() => testAccount(a.id)} disabled={testing === a.id}>
                        {testing === a.id ? 'Testing…' : 'Test'}
                      </button>
                      {testResults[a.id] && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: testResults[a.id].ok ? '#059669' : '#dc2626', fontWeight: 600 }}>
                          {testResults[a.id].ok ? `✓ ${testResults[a.id].msg}` : `✗ ${testResults[a.id].msg}`}
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="btn-ghost btn-sm" style={{ color: '#dc2626', borderColor: '#fecaca' }}
                        onClick={() => deleteAccount(a.id, a.name)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
