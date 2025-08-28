import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Dashboard from './pages/Dashboard';
import CustomersWithWebsites from './pages/CustomersWithWebsites';
import Tasks from './pages/Tasks';
import Proposals from './pages/Proposals';
import Billing from './pages/Billing';
import HourlyTracker from './pages/HourlyTracker';
import FinancialForecast from './pages/FinancialForecast';
import Payments from './pages/Payments';
import Invoices from './pages/Invoices';
import Services from './pages/Services';
import Calendar from './pages/Calendar';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<CustomersWithWebsites />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="proposals" element={<Proposals />} />
            <Route path="billing" element={<Billing />} />
            <Route path="hourly-tracker" element={<HourlyTracker />} />
            <Route path="financial-forecast" element={<FinancialForecast />} />
            <Route path="payments" element={<Payments />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="services" element={<Services />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="notes" element={<Notes />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
