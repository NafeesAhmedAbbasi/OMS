import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import OrderList from './pages/DEO/OrderList';
import CreateOrder from './pages/DEO/CreateOrder';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/Admin/UserManagement';
import AdminTransfers from './pages/Admin/Transfers';
import AdminOrders from './pages/Admin/Orders';
import AdminOrderList from './pages/Admin/OrderList';
import AdminItemTypes from './pages/Admin/ItemTypes';
import AdminHandlers from './pages/Admin/Handlers';
import EditorDashboard from './pages/Editor/Dashboard';
import EditorOrders from './pages/Editor/Orders';
import EditorBilling from './pages/Editor/BillingAccounts';
import EditorTransfers from './pages/Editor/Transfers';
import HandlerDashboard from './pages/Handler/Dashboard';
import StoreEnvyImport from './pages/DEO/StoreEnvyImport';
import AdminSettings from './pages/Admin/Settings';
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
        <Route path="/deo/import" element={
          <PrivateRoute role="deo"><StoreEnvyImport /></PrivateRoute>
        } />

        <Route path="/admin" element={
          <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
        } />
        <Route path="/admin/users" element={
          <PrivateRoute role="admin"><AdminUsers /></PrivateRoute>
        } />
        <Route path="/admin/transfers" element={
          <PrivateRoute role="admin"><AdminTransfers /></PrivateRoute>
        } />
        <Route path="/admin/orders" element={
          <PrivateRoute role="admin"><AdminOrders /></PrivateRoute>
        } />
        <Route path="/admin/orders/list" element={
          <PrivateRoute role="admin"><AdminOrderList /></PrivateRoute>
        } />
        <Route path="/admin/item-types" element={
          <PrivateRoute role="admin"><AdminItemTypes /></PrivateRoute>
        } />
        <Route path="/admin/handlers" element={
          <PrivateRoute role="admin"><AdminHandlers /></PrivateRoute>
        } />
        <Route path="/admin/settings" element={
          <PrivateRoute role="admin"><AdminSettings /></PrivateRoute>
        } />

        <Route path="/editor/dashboard" element={
          <PrivateRoute role="editor"><EditorDashboard /></PrivateRoute>
        } />
        <Route path="/editor/orders" element={
          <PrivateRoute role="editor"><EditorOrders /></PrivateRoute>
        } />
        <Route path="/editor/billing" element={
          <PrivateRoute role="editor"><EditorBilling /></PrivateRoute>
        } />
        <Route path="/editor/transfers" element={
          <PrivateRoute role="editor"><EditorTransfers /></PrivateRoute>
        } />

        <Route path="/handler/dashboard" element={
          <PrivateRoute role="handler"><HandlerDashboard /></PrivateRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
