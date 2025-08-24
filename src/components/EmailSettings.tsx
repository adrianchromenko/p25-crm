import React, { useState, useEffect } from 'react';
import { Settings, Save, Mail } from 'lucide-react';
import { emailService } from '../services/emailService';

const EmailSettings: React.FC = () => {
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // Load saved API key from localStorage
    const savedKey = localStorage.getItem('brevo_api_key');
    if (savedKey) {
      setBrevoApiKey(savedKey);
    }
  }, []);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('brevo_api_key', brevoApiKey);
    
    // Reinitialize the email service with the new API key
    emailService.reinitialize();
    
    setIsEditing(false);
    setSaved(true);
    
    // Show success message briefly
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestEmail = async () => {
    console.log('🧪 Debug: Test email button clicked');
    setTestingEmail(true);
    setTestResult(null);
    
    try {
      console.log('🧪 Debug: Calling emailService.testEmailSend()');
      const success = await emailService.testEmailSend();
      console.log('🧪 Debug: Test result:', success);
      
      setTestResult({
        success,
        message: success 
          ? '✅ Test email sent successfully! Check your inbox (including spam folder) at adrian@primarydm.com. Delivery may take 1-5 minutes.' 
          : 'Failed to send test email. Check console for detailed error information.'
      });
    } catch (error) {
      console.error('🧪 Debug: Test email error:', error);
      setTestResult({
        success: false,
        message: 'Error sending test email: ' + (error as Error).message + '. Check console for details.'
      });
    } finally {
      setTestingEmail(false);
      // Clear test result after 8 seconds to give more time to read
      setTimeout(() => setTestResult(null), 8000);
    }
  };

  const isConfigured = brevoApiKey && brevoApiKey !== 'your_brevo_api_key_here';

  return (
    <div className="email-settings-card">
      <div className="email-settings-header">
        <div className="settings-icon">
          <Mail size={24} />
        </div>
        <div>
          <h3>Email Settings</h3>
          <p>Configure Brevo for email reminders</p>
        </div>
        <div className={`status-indicator ${isConfigured ? 'configured' : 'not-configured'}`}>
          {isConfigured ? 'Configured' : 'Not Configured'}
        </div>
      </div>

      {!isConfigured && (
        <div className="settings-notice">
          <p>⚠️ Brevo API key not configured. Calendar reminders will use browser notifications only.</p>
        </div>
      )}

      <div className="settings-content">
        {isEditing ? (
          <div className="api-key-form">
            <label htmlFor="brevo-key">Brevo API Key:</label>
            <input
              id="brevo-key"
              type="password"
              value={brevoApiKey}
              onChange={(e) => setBrevoApiKey(e.target.value)}
              placeholder="Enter your Brevo API key"
              className="api-key-input"
            />
            
            <div className="form-actions">
              <button 
                className="btn-secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleSave}
              >
                <Save size={16} />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="api-key-display">
            <div className="key-field">
              <label>API Key:</label>
              <span className="masked-key">
                {isConfigured ? '••••••••••••••••••••••••••••••••' : 'Not set'}
              </span>
            </div>
            <div className="api-key-actions">
              <button 
                className="btn-secondary"
                onClick={() => setIsEditing(true)}
              >
                <Settings size={16} />
                {isConfigured ? 'Change' : 'Configure'}
              </button>
              {isConfigured && (
                <button 
                  className="btn-primary"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                >
                  <Mail size={16} />
                  {testingEmail ? 'Sending...' : 'Test Email'}
                </button>
              )}
            </div>
          </div>
        )}

        {saved && (
          <div className="save-success">
            ✅ Brevo API key saved and email service reinitialized successfully!
          </div>
        )}

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </div>
        )}
      </div>

      <div className="settings-help">
        <h4>How to get your Brevo API key:</h4>
        <ol>
          <li>Go to <a href="https://app.brevo.com" target="_blank" rel="noopener noreferrer">app.brevo.com</a> and sign in</li>
          <li>Navigate to "SMTP & API" in the left menu</li>
          <li>Click on the "API Keys" tab</li>
          <li>Create a new API key with "Send transactional emails" permission</li>
          <li>Copy the API key and paste it above</li>
          <li><strong>Important:</strong> Make sure you have verified your sender domain or email address in Brevo</li>
        </ol>
        <p><strong>Note:</strong> Brevo offers 300 free emails per day. Perfect for calendar reminders!</p>
        <p><strong>Sender Email:</strong> Using "adrian@primarydm.com" as the verified sender email.</p>
        <p><strong>Delivery:</strong> Test emails may take 1-5 minutes to arrive. Check your spam/junk folder if you don't see it in your inbox.</p>
      </div>
    </div>
  );
};

export default EmailSettings;