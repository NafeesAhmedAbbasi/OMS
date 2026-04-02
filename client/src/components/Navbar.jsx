import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <header className="topbar">
      <div className="topbar-brand">OMS</div>
      <div className="topbar-right">
        <div className="topbar-user-info">
          <span className="topbar-user-name">{user?.username}</span>
          <span className="topbar-user-role">{user?.role}</span>
        </div>
        <button className="btn-logout" onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
