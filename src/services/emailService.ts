/**
 * Email Notification Service for Calendar Reminders
 * 
 * This service provides automated reminder notifications for calendar events.
 * 
 * Features:
 * - Automatically checks for upcoming reminders every minute
 * - Sends email notifications via Brevo REST API
 * - Browser notification fallback
 * - Marks reminders as sent to prevent duplicates
 * - Supports multiple reminder types (minutes, hours, days before event)
 * 
 * Current Implementation:
 * - Uses Brevo REST API for email sending
 * - Browser notifications as fallback
 * - Easy to configure with Brevo API key
 * 
 * Brevo Setup:
 * 1. Create account at brevo.com
 * 2. Verify your sender domain/email
 * 3. Get API key from SMTP & API section
 * 4. Configure API key in settings
 */

import { collection, query, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reminders: Array<{
    time: string;
    method: string;
    sent?: boolean;
  }>;
  type: string;
}

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
}

class EmailService {
  private checkInterval: NodeJS.Timeout | null = null;
  private brevoApiKey: string | null = null;

  constructor() {
    this.initializeBrevo();
  }

  private initializeBrevo() {
    console.log('🔧 Debug: Initializing Brevo service...');
    
    // Check localStorage first, then environment variable
    const storedApiKey = localStorage.getItem('brevo_api_key');
    const envApiKey = process.env.REACT_APP_BREVO_API_KEY;
    const apiKey = storedApiKey || envApiKey;
    
    console.log('🔧 Debug: Stored API key exists:', !!storedApiKey);
    console.log('🔧 Debug: Env API key exists:', !!envApiKey);
    console.log('🔧 Debug: Using API key source:', storedApiKey ? 'localStorage' : 'environment');
    
    if (apiKey && apiKey !== 'your_brevo_api_key_here' && apiKey.trim() !== '') {
      this.brevoApiKey = apiKey;
      console.log('✅ Debug: Brevo API configured successfully, key length:', apiKey.length);
    } else {
      this.brevoApiKey = null;
      console.log('⚠️ Debug: Brevo API key not configured, using browser notifications only');
      console.log('🔧 Debug: API key value:', apiKey ? `"${apiKey}"` : 'null/undefined');
    }
  }

  // Method to reinitialize with new API key
  reinitialize() {
    this.initializeBrevo();
  }

  startReminderService() {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAndSendReminders();
    }, 60000); // Check every minute
  }

  stopReminderService() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkAndSendReminders() {
    try {
      const now = new Date();
      const eventsRef = collection(db, 'calendar_events');
      const q = query(eventsRef);
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach(async (docSnapshot) => {
        const eventData = docSnapshot.data();
        const event: CalendarEvent = { 
          id: docSnapshot.id, 
          ...eventData 
        } as CalendarEvent;
        
        if (!event.reminders || event.reminders.length === 0) return;

        const eventDateTime = new Date(`${event.startDate}T${event.startTime}`);
        
        event.reminders.forEach(async (reminder, index: number) => {
          try {
            if (reminder.sent) return;

            const parsedReminderTime = this.parseReminderTime(reminder.time);
            if (parsedReminderTime === 0) {
              console.warn('Skipping reminder with invalid time:', reminder.time);
              return;
            }

            const reminderTime = new Date(eventDateTime.getTime() - parsedReminderTime);
            
            if (now >= reminderTime && now <= new Date(reminderTime.getTime() + 60000)) {
              await this.sendEmailNotification({
                to: 'adrian@primarydm.com', // Default email - could be made configurable
                subject: `Reminder: ${event.title}`,
                body: this.generateEmailBody(event, reminder),
                eventTitle: event.title,
                eventDate: event.startDate,
                eventTime: event.startTime
              });

              // Mark reminder as sent
              const updatedReminders = [...event.reminders];
              updatedReminders[index] = { ...reminder, sent: true };
              
              await updateDoc(doc(db, 'calendar_events', event.id), {
                reminders: updatedReminders
              });
            }
          } catch (error) {
            console.error('Error processing reminder for event', event.id, ':', error);
            console.error('Reminder data:', reminder);
          }
        });
      });
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }

  private parseReminderTime(timeStr: any): number {
    // Ensure timeStr is a string
    if (timeStr === null || timeStr === undefined) {
      console.warn('parseReminderTime: timeStr is null or undefined');
      return 0;
    }
    
    // Convert to string if it's not already
    const timeString = String(timeStr);
    
    // If it's a number, assume it's already in milliseconds
    if (!isNaN(Number(timeString)) && Number(timeString) > 0) {
      return Number(timeString);
    }
    
    const match = timeString.match(/(\d+)\s*(minute|hour|day)s?/i);
    if (!match) {
      console.warn('parseReminderTime: Could not parse time string:', timeString);
      return 0;
    }

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'minute':
        return value * 60 * 1000;
      case 'hour':
        return value * 60 * 60 * 1000;
      case 'day':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  private generateEmailBody(event: CalendarEvent, reminder: { time: string; method: string; sent?: boolean }): string {
    return `
This is a reminder for your upcoming event:

Event: ${event.title}
Description: ${event.description || 'No description'}
Date: ${new Date(event.startDate).toLocaleDateString()}
Time: ${event.startTime} - ${event.endTime}
Type: ${event.type}

Reminder set for: ${reminder.time} before the event

Best regards,
P25 CRM System
    `.trim();
  }

  private async sendEmailNotification(notification: EmailNotification): Promise<boolean> {
    try {
      // Try to send email via Brevo first
      if (this.brevoApiKey) {
        return await this.sendViaBrevo(notification);
      }
      
      // Fallback to browser notifications
      console.log('Email notification would be sent:', notification);
      
      if (typeof window !== 'undefined') {
        if (window.Notification && Notification.permission === 'granted') {
          new Notification(notification.subject, {
            body: `Reminder: ${notification.eventTitle} at ${notification.eventTime}`,
            icon: '/favicon.ico'
          });
        } else if (window.Notification && Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification(notification.subject, {
                body: `Reminder: ${notification.eventTitle} at ${notification.eventTime}`,
                icon: '/favicon.ico'
              });
            }
          });
        } else {
          alert(`Reminder: ${notification.eventTitle} starts at ${notification.eventTime}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }

  private async sendViaBrevo(notification: EmailNotification): Promise<boolean> {
    try {
      console.log('🔍 Debug: Starting Brevo email send...');
      
      if (!this.brevoApiKey) {
        console.error('🔴 Debug: Brevo API key not configured');
        throw new Error('Brevo API key not configured');
      }

      console.log('🔑 Debug: API key configured, length:', this.brevoApiKey.length);

      const emailData = {
        sender: {
          name: "Adrian Chromenko - Primary Digital Marketing",
          email: "adrian@primarydm.com" // Verified sender in Brevo
        },
        to: [
          {
            email: notification.to,
            name: "User"
          }
        ],
        subject: notification.subject,
        htmlContent: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
                .content { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2 class="header">📅 Calendar Reminder</h2>
                <div class="content">
                  ${notification.body.replace(/\n/g, '<br>')}
                </div>
                <div class="footer">
                  <p>This reminder was sent automatically by P25 CRM.</p>
                  <p><strong>Primary Digital Marketing</strong><br>
                  Adrian Chromenko<br>
                  📞 (647) 203-3189<br>
                  ✉️ adrian@primarydm.com</p>
                </div>
              </div>
            </body>
          </html>
        `
      };

      console.log('📧 Debug: Email payload prepared');
      console.log('📧 Debug: Sending to:', notification.to);
      console.log('📧 Debug: Subject:', notification.subject);
      console.log('📧 Debug: From:', emailData.sender.email);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.brevoApiKey
        },
        body: JSON.stringify(emailData)
      });

      console.log('🌐 Debug: API response status:', response.status);
      console.log('🌐 Debug: API response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Debug: API error response:', errorText);
        
        // Try to parse error as JSON for better debugging
        try {
          const errorJson = JSON.parse(errorText);
          console.error('🔴 Debug: Parsed error:', errorJson);
          throw new Error(`Brevo API error (${response.status}): ${errorJson.message || errorJson.code || errorText}`);
        } catch (parseError) {
          throw new Error(`Brevo API error (${response.status}): ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('✅ Debug: Email sent successfully via Brevo:', result);
      console.log('✅ Debug: Message ID:', result.messageId);
      return true;

    } catch (error) {
      console.error('🔴 Debug: Failed to send email via Brevo:', error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error('🔴 Debug: Error name:', error.name);
        console.error('🔴 Debug: Error message:', error.message);
        console.error('🔴 Debug: Error stack:', error.stack);
      }
      
      // Fallback to browser notification on email failure
      if (typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted') {
        new Notification(notification.subject, {
          body: `Reminder: ${notification.eventTitle} at ${notification.eventTime}`,
          icon: '/favicon.ico'
        });
      }
      
      return false;
    }
  }

  // Public method to test email sending
  async testEmailSend(to: string = 'adrian@primarydm.com'): Promise<boolean> {
    const testNotification: EmailNotification = {
      to,
      subject: 'Test Email from P25 CRM',
      body: `This is a test email to verify that Brevo email integration is working correctly.

Sent at: ${new Date().toLocaleString()}

If you received this email, the integration is working properly!`,
      eventTitle: 'Test Event',
      eventDate: new Date().toISOString().split('T')[0],
      eventTime: new Date().toTimeString().split(' ')[0]
    };

    return await this.sendEmailNotification(testNotification);
  }
}

export const emailService = new EmailService();