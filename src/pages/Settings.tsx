import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updatePassword, updateEmail } from 'firebase/auth';
import { User, Mail, Lock, Bell, Shield, Save } from 'lucide-react';
import EmailSettings from '../components/EmailSettings';

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [profileData, setProfileData] = useState({
    email: currentUser?.email || '',
    displayName: currentUser?.displayName || '',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    newCustomerAlerts: true,
    paymentReminders: true,
    monthlyReports: true,
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (currentUser && profileData.email !== currentUser.email) {
        await updateEmail(currentUser, profileData.email);
      }
      setMessage('Profile updated successfully!');
    } catch (err: any) {
      setError('Failed to update profile. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (currentUser) {
        await updatePassword(currentUser, passwordData.newPassword);
        setMessage('Password updated successfully!');
        setPasswordData({ newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      setError('Failed to update password. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Notification settings updated successfully!');
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: <User size={20} /> },
    { id: 'security', name: 'Security', icon: <Shield size={20} /> },
    { id: 'notifications', name: 'Notifications', icon: <Bell size={20} /> },
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account and application preferences</p>
      </div>

      <div className="settings-container">
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          {activeTab === 'profile' && (
            <div className="tab-content">
              <h2>Profile Information</h2>
              <form onSubmit={handleProfileUpdate}>
                <div className="form-group">
                  <label>
                    <Mail size={18} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    <User size={18} />
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    placeholder="Your display name"
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="tab-content">
              <h2>Security Settings</h2>
              <form onSubmit={handlePasswordUpdate}>
                <div className="form-group">
                  <label>
                    <Lock size={18} />
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <Lock size={18} />
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="tab-content">
              <h2>Notification Preferences</h2>
              
              <EmailSettings />
              
              <form onSubmit={handleNotificationUpdate}>
                <div className="notification-settings">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: e.target.checked
                      })}
                    />
                    <div>
                      <strong>Email Notifications</strong>
                      <p>Receive important updates via email</p>
                    </div>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.newCustomerAlerts}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        newCustomerAlerts: e.target.checked
                      })}
                    />
                    <div>
                      <strong>New Customer Alerts</strong>
                      <p>Get notified when new customers are added</p>
                    </div>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.paymentReminders}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        paymentReminders: e.target.checked
                      })}
                    />
                    <div>
                      <strong>Payment Reminders</strong>
                      <p>Receive reminders for upcoming payments</p>
                    </div>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.monthlyReports}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        monthlyReports: e.target.checked
                      })}
                    />
                    <div>
                      <strong>Monthly Reports</strong>
                      <p>Get monthly summary reports</p>
                    </div>
                  </label>
                </div>
                <button type="submit" className="btn-primary">
                  <Save size={18} />
                  Save Preferences
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;