import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { emailService } from '../services/emailService';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  ChevronLeft,
  ChevronRight,
  Bell,
  Settings as SettingsIcon,
  Calendar as CalendarIcon
} from 'lucide-react';
import { format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addMonths,
  subMonths,
  parseISO,
  isSameDay
} from 'date-fns';
import NotificationPermission from '../components/NotificationPermission';

interface CalendarEvent {
  id?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reminders: Reminder[];
  type: 'meeting' | 'call' | 'deadline' | 'personal' | 'other';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Reminder {
  id: string;
  type: 'email' | 'notification';
  time: number; // minutes before event
  unit: 'minutes' | 'hours' | 'days';
}

interface ReminderTemplate {
  id: string;
  name: string;
  reminders: Omit<Reminder, 'id'>[];
}

const Calendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminderTemplates, setReminderTemplates] = useState<ReminderTemplate[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [eventFormData, setEventFormData] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    type: 'meeting',
    reminders: []
  });

  const [newTemplate, setNewTemplate] = useState<Partial<ReminderTemplate>>({
    name: '',
    reminders: []
  });
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [templateViewMode, setTemplateViewMode] = useState<'list' | 'form'>('list');

  useEffect(() => {
    fetchData();
    // Start the email reminder service
    emailService.startReminderService();
    
    // Cleanup function to stop the service when component unmounts
    return () => {
      emailService.stopReminderService();
    };
  }, []);

  const fetchData = async () => {
    try {
      const [eventsSnapshot, templatesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'calendar_events'), orderBy('startDate', 'asc'))),
        getDocs(collection(db, 'reminder_templates'))
      ]);

      const eventsData: CalendarEvent[] = [];
      eventsSnapshot.forEach((doc) => {
        eventsData.push({ id: doc.id, ...doc.data() } as CalendarEvent);
      });

      const templatesData: ReminderTemplate[] = [];
      templatesSnapshot.forEach((doc) => {
        templatesData.push({ id: doc.id, ...doc.data() } as ReminderTemplate);
      });

      // Add default templates if none exist
      if (templatesData.length === 0) {
        const defaultTemplates = [
          {
            name: 'Standard Meeting',
            reminders: [
              { type: 'email', time: 5, unit: 'minutes' },
              { type: 'email', time: 1, unit: 'hours' }
            ]
          },
          {
            name: 'Important Deadline',
            reminders: [
              { type: 'email', time: 1, unit: 'days' },
              { type: 'email', time: 4, unit: 'hours' },
              { type: 'notification', time: 30, unit: 'minutes' }
            ]
          }
        ];

        for (const template of defaultTemplates) {
          await addDoc(collection(db, 'reminder_templates'), template);
        }
        fetchData(); // Refresh to get the new templates
        return;
      }

      setEvents(eventsData);
      setReminderTemplates(templatesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const eventData = {
        ...eventFormData,
        reminders: eventFormData.reminders || []
      };

      if (editingEvent) {
        await updateDoc(doc(db, 'calendar_events', editingEvent.id!), {
          ...eventData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'calendar_events'), {
          ...eventData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      
      fetchData();
      closeEventModal();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteDoc(doc(db, 'calendar_events', id));
        fetchData();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const openEventModal = (event?: CalendarEvent, date?: Date) => {
    if (event) {
      setEditingEvent(event);
      setEventFormData(event);
    } else {
      setEditingEvent(null);
      const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      setEventFormData({
        title: '',
        description: '',
        startDate: dateStr,
        endDate: dateStr,
        startTime: '09:00',
        endTime: '10:00',
        type: 'meeting',
        reminders: []
      });
    }
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const applyReminderTemplate = (templateId: string) => {
    const template = reminderTemplates.find(t => t.id === templateId);
    if (template) {
      const reminders = template.reminders.map(r => ({
        ...r,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));
      setEventFormData({ ...eventFormData, reminders });
    }
  };

  const addReminder = () => {
    const newReminder: Reminder = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'email',
      time: 15,
      unit: 'minutes'
    };
    setEventFormData({
      ...eventFormData,
      reminders: [...(eventFormData.reminders || []), newReminder]
    });
  };

  const updateReminder = (index: number, field: keyof Reminder, value: any) => {
    const updatedReminders = [...(eventFormData.reminders || [])];
    updatedReminders[index] = { ...updatedReminders[index], [field]: value };
    setEventFormData({ ...eventFormData, reminders: updatedReminders });
  };

  const removeReminder = (index: number) => {
    const updatedReminders = (eventFormData.reminders || []).filter((_, i) => i !== index);
    setEventFormData({ ...eventFormData, reminders: updatedReminders });
  };

  // Template management functions
  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const templateData = {
        ...newTemplate,
        reminders: newTemplate.reminders || []
      };

      if (editingTemplate) {
        await updateDoc(doc(db, 'reminder_templates', editingTemplate.id), {
          ...templateData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'reminder_templates'), {
          ...templateData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      
      fetchData();
      setTemplateViewMode('list');
      setEditingTemplate(null);
      setNewTemplate({
        name: '',
        reminders: []
      });
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteDoc(doc(db, 'reminder_templates', id));
        fetchData();
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };

  const openTemplateModal = (template?: ReminderTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setNewTemplate(template);
      setTemplateViewMode('form');
    } else {
      setEditingTemplate(null);
      setNewTemplate({
        name: '',
        reminders: []
      });
      setTemplateViewMode('list');
    }
    setShowTemplateModal(true);
  };

  const openTemplateForm = (template?: ReminderTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setNewTemplate(template);
    } else {
      setEditingTemplate(null);
      setNewTemplate({
        name: '',
        reminders: []
      });
    }
    setTemplateViewMode('form');
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
    setNewTemplate({
      name: '',
      reminders: []
    });
    setTemplateViewMode('list');
  };

  const addTemplateReminder = () => {
    const newReminder = {
      type: 'email' as const,
      time: 15,
      unit: 'minutes' as const
    };
    setNewTemplate({
      ...newTemplate,
      reminders: [...(newTemplate.reminders || []), newReminder]
    });
  };

  const updateTemplateReminder = (index: number, field: keyof Omit<Reminder, 'id'>, value: any) => {
    const updatedReminders = [...(newTemplate.reminders || [])];
    updatedReminders[index] = { ...updatedReminders[index], [field]: value };
    setNewTemplate({ ...newTemplate, reminders: updatedReminders });
  };

  const removeTemplateReminder = (index: number) => {
    const updatedReminders = (newTemplate.reminders || []).filter((_, i) => i !== index);
    setNewTemplate({ ...newTemplate, reminders: updatedReminders });
  };

  // Calendar grid generation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(parseISO(event.startDate), day));
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'call': return 'bg-green-100 text-green-800 border-green-200';
      case 'deadline': return 'bg-red-100 text-red-800 border-red-200';
      case 'personal': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return <div className="loading">Loading calendar...</div>;
  }

  return (
    <>
      <NotificationPermission />
      <div className="calendar-page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p>Manage your events and appointments</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-secondary" 
            onClick={() => {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Test Reminder', {
                  body: 'This is a test notification to verify the system is working!',
                  icon: '/favicon.ico'
                });
              } else {
                alert('Please enable notifications first!');
              }
            }}
          >
            <Bell size={20} />
            Test Notification
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => openTemplateModal()}
          >
            <SettingsIcon size={20} />
            Reminder Templates
          </button>
          <button className="btn-primary" onClick={() => openEventModal()}>
            <Plus size={20} />
            Add Event
          </button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="calendar-nav">
        <button 
          className="btn-icon" 
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="calendar-title">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <button 
          className="btn-icon" 
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-container">
        <div className="calendar-grid">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">
              {day}
            </div>
          ))}
          
          {/* Calendar Days */}
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            return (
              <div
                key={day.toString()}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${
                  isToday(day) ? 'today' : ''
                } ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedDate(day);
                  if (dayEvents.length === 0) {
                    openEventModal(undefined, day);
                  }
                }}
              >
                <div className="day-number">{format(day, 'd')}</div>
                <div className="day-events">
                  {dayEvents.slice(0, 3).map((event, index) => (
                    <div
                      key={event.id}
                      className={`event-item ${getEventTypeColor(event.type)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEventModal(event);
                      }}
                    >
                      <span className="event-time">{event.startTime}</span>
                      <span className="event-title">{event.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="more-events">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>
                <CalendarIcon size={20} />
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <button className="btn-icon" onClick={closeEventModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group span-2">
                  <label>Event Title</label>
                  <input
                    type="text"
                    value={eventFormData.title}
                    onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                    required
                  />
                </div>
                
                <div className="form-group span-2">
                  <label>Description</label>
                  <textarea
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Event Type</label>
                  <select
                    value={eventFormData.type}
                    onChange={(e) => setEventFormData({ ...eventFormData, type: e.target.value as CalendarEvent['type'] })}
                  >
                    <option value="meeting">Meeting</option>
                    <option value="call">Call</option>
                    <option value="deadline">Deadline</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={eventFormData.startDate}
                    onChange={(e) => setEventFormData({ ...eventFormData, startDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={eventFormData.endDate}
                    onChange={(e) => setEventFormData({ ...eventFormData, endDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={eventFormData.startTime}
                    onChange={(e) => setEventFormData({ ...eventFormData, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={eventFormData.endTime}
                    onChange={(e) => setEventFormData({ ...eventFormData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Reminder Templates */}
              <div className="reminder-templates-section">
                <h3>Quick Reminder Templates</h3>
                <div className="template-buttons">
                  {reminderTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="btn-secondary small"
                      onClick={() => applyReminderTemplate(template.id)}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Reminders */}
              <div className="reminders-section">
                <div className="section-header">
                  <h3>Reminders</h3>
                  <button type="button" className="btn-secondary small" onClick={addReminder}>
                    <Plus size={16} />
                    Add Reminder
                  </button>
                </div>

                {eventFormData.reminders?.map((reminder, index) => (
                  <div key={reminder.id} className="reminder-item">
                    <div className="reminder-grid">
                      <div className="form-group">
                        <select
                          value={reminder.type}
                          onChange={(e) => updateReminder(index, 'type', e.target.value)}
                        >
                          <option value="email">Email</option>
                          <option value="notification">Notification</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <input
                          type="number"
                          value={reminder.time}
                          onChange={(e) => updateReminder(index, 'time', parseInt(e.target.value))}
                          min="1"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <select
                          value={reminder.unit}
                          onChange={(e) => updateReminder(index, 'unit', e.target.value)}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn-icon delete"
                        onClick={() => removeReminder(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="reminder-preview">
                      {reminder.type === 'email' ? '📧' : '🔔'} 
                      {reminder.time} {reminder.unit} before event
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeEventModal}>
                  Cancel
                </button>
                {editingEvent && (
                  <button 
                    type="button" 
                    className="btn-danger" 
                    onClick={() => {
                      handleDeleteEvent(editingEvent.id!);
                      closeEventModal();
                    }}
                  >
                    Delete Event
                  </button>
                )}
                <button type="submit" className="btn-primary">
                  {editingEvent ? 'Update' : 'Create'} Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Management Modal */}
      {showTemplateModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>
                <SettingsIcon size={20} />
                {editingTemplate ? 'Edit Template' : 'Reminder Templates'}
              </h2>
              <button className="btn-icon" onClick={closeTemplateModal}>
                <X size={20} />
              </button>
            </div>

            {templateViewMode === 'list' ? (
              // Template List View
              <div className="template-list">
                <div className="template-list-header">
                  <h3>Your Reminder Templates</h3>
                  <button 
                    className="btn-primary"
                    onClick={() => openTemplateForm()}
                  >
                    <Plus size={16} />
                    Create Template
                  </button>
                </div>

                <div className="templates-grid">
                  {reminderTemplates.map((template) => (
                    <div key={template.id} className="template-card">
                      <div className="template-card-header">
                        <h4>{template.name}</h4>
                        <div className="template-actions">
                          <button 
                            className="btn-icon" 
                            onClick={() => openTemplateForm(template)}
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            className="btn-icon delete" 
                            onClick={() => handleDeleteTemplate(template.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="template-reminders">
                        {template.reminders.map((reminder, index) => (
                          <div key={index} className="template-reminder-item">
                            <span className="reminder-icon">
                              {reminder.type === 'email' ? '📧' : '🔔'}
                            </span>
                            <span>
                              {reminder.time} {reminder.unit} before
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        className="apply-template-btn"
                        onClick={() => {
                          applyReminderTemplate(template.id);
                          closeTemplateModal();
                        }}
                      >
                        Apply to Current Event
                      </button>
                    </div>
                  ))}
                </div>

                {reminderTemplates.length === 0 && (
                  <div className="empty-state">
                    <p>No templates created yet.</p>
                    <p>Create your first template to save time setting up reminders!</p>
                  </div>
                )}
              </div>
            ) : (
              // Template Edit/Create Form
              <form onSubmit={handleTemplateSubmit}>
                <div className="form-group">
                  <label>Template Name</label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="e.g., Standard Meeting, Important Deadline"
                    required
                  />
                </div>

                <div className="template-reminders-section">
                  <div className="section-header">
                    <h3>Reminders</h3>
                    <button 
                      type="button" 
                      className="btn-secondary small" 
                      onClick={addTemplateReminder}
                    >
                      <Plus size={16} />
                      Add Reminder
                    </button>
                  </div>

                  {newTemplate.reminders?.map((reminder, index) => (
                    <div key={index} className="reminder-item">
                      <div className="reminder-grid">
                        <div className="form-group">
                          <label>Type</label>
                          <select
                            value={reminder.type}
                            onChange={(e) => updateTemplateReminder(index, 'type', e.target.value)}
                          >
                            <option value="email">Email</option>
                            <option value="notification">Notification</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Time</label>
                          <input
                            type="number"
                            value={reminder.time}
                            onChange={(e) => updateTemplateReminder(index, 'time', parseInt(e.target.value))}
                            min="1"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Unit</label>
                          <select
                            value={reminder.unit}
                            onChange={(e) => updateTemplateReminder(index, 'unit', e.target.value)}
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className="btn-icon delete"
                          onClick={() => removeTemplateReminder(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="reminder-preview">
                        {reminder.type === 'email' ? '📧' : '🔔'} 
                        {reminder.time} {reminder.unit} before event
                      </div>
                    </div>
                  ))}

                  {(!newTemplate.reminders || newTemplate.reminders.length === 0) && (
                    <div className="empty-reminders">
                      <p>No reminders added yet. Click "Add Reminder" to get started.</p>
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setTemplateViewMode('list')}
                  >
                    Back to List
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Calendar;