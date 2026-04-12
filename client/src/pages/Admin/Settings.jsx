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
  const [testing, setTesting]   = useState(null);
  const [testResults, setTestResults] = useState({});

  // Order sources
  const [sources, setSources]             = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [newSource, setNewSource]         = useState('');
  const [addingSource, setAddingSource]   = useState(false);

  useEffect(() => {
    api.get('/settings/storenvy-accounts')
      .then(res => setAccounts(res.data))
      .catch(() => setError('Failed to load accounts'))
      .finally(() => setLoading(false));

    api.get('/settings/sources')
      .then(res => setSources(res.data))
      .catch(() => {})
      .finally(() => setSourcesLoading(false));
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

  async function addSource() {
    if (!newSource.trim()) return setError('Source name is required');
    setAddingSource(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/settings/sources', { name: newSource.trim() });
      setSources(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSource('');
      setSuccess(`"${res.data.name}" added.`);
    } catch (err) { setError(err.response?.data?.error || 'Failed to add'); }
    finally { setAddingSource(false); }
  }

  async function deleteSource(id, name) {
    if (!window.confirm(`Remove "${name}"? Orders using this source will keep their value.`)) return;
    try {
      await api.delete(`/settings/sources/${id}`);
      setSources(prev => prev.filter(s => s.id !== id));
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete'); }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Settings</h2>
            <p className="page-subtitle">Store Envy integrations &amp; order sources</p>
          </div>
        </div>

        {error   && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        {/* Order Sources */}
        <div className="table-card" style={{ padding: 24, maxWidth: 640, marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Order Sources</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            These appear in the Source dropdown when creating or editing an order.
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label>Source Name</label>
              <input
                type="text"
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSource()}
                placeholder="e.g. eBay, Instagram"
              />
            </div>
            <button className="btn-primary" onClick={addSource} disabled={addingSource}>
              {addingSource ? 'Adding…' : 'Add Source'}
            </button>
          </div>

          {sourcesLoading ? <div className="loading-state">Loading…</div> : sources.length === 0 ? (
            <div className="no-data">No sources yet.</div>
          ) : (
            <table className="orders-table">
              <thead>
                <tr><th>Name</th><th></th></tr>
              </thead>
              <tbody>
                {sources.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>
                      <button
                        className="btn-ghost btn-sm"
                        style={{ color: '#dc2626', borderColor: '#fecaca' }}
                        onClick={() => deleteSource(s.id, s.name)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Store Envy Accounts */}
        <div className="table-card" style={{ padding: 24, maxWidth: 640 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Store Envy Accounts</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Add one account per Store Envy store. DEO can import orders from any of these.
          </div>

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
