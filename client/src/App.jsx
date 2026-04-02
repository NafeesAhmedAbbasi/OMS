import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import OrderList from './pages/DEO/OrderList';
import CreateOrder from './pages/DEO/CreateOrder';
import AdminDashboard from './pages/AdminDashboard';
import PrivateRoute from './components/PrivateRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/deo/orders" element={
          <PrivateRoute role="deo"><OrderList /></PrivateRoute>
        } />
        <Route path="/deo/orders/new" element={
          <PrivateRoute role="deo"><CreateOrder /></PrivateRoute>
        } />

        <Route path="/admin" element={
          <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
