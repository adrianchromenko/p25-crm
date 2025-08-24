import React, { useState, useEffect } from 'react';
import { Bell, BellOff, AlertCircle } from 'lucide-react';

const NotificationPermission: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPrompt(false);
    }
  };

  const handleEnableNotifications = () => {
    if (permission === 'default') {
      requestPermission();
    } else if (permission === 'denied') {
      setShowPrompt(true);
    }
  };

  if (!('Notification' in window)) {
    return null; // Browser doesn't support notifications
  }

  return (
    <div className="notification-permission-container">
      {permission === 'granted' && (
        <div className="notification-status granted">
          <Bell size={16} />
          <span>Notifications enabled</span>
        </div>
      )}

      {permission === 'default' && (
        <div className="notification-status default">
          <button 
            className="enable-notifications-btn"
            onClick={handleEnableNotifications}
          >
            <Bell size={16} />
            <span>Enable Notifications</span>
          </button>
        </div>
      )}

      {permission === 'denied' && (
        <div className="notification-status denied">
          <BellOff size={16} />
          <span>Notifications blocked</span>
          <button 
            className="enable-notifications-btn small"
            onClick={() => setShowPrompt(true)}
          >
            <AlertCircle size={14} />
            How to enable?
          </button>
        </div>
      )}

      {showPrompt && (
        <div className="notification-prompt">
          <div className="notification-prompt-content">
            <h4>Enable Browser Notifications</h4>
            <p>To receive reminders, please enable notifications in your browser:</p>
            <ol>
              <li>Click the lock/info icon in your address bar</li>
              <li>Find "Notifications" and change it to "Allow"</li>
              <li>Refresh the page</li>
            </ol>
            <button onClick={() => setShowPrompt(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPermission;