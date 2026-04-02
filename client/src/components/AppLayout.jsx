import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
