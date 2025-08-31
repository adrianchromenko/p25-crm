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
  where,
  Timestamp,
  writeBatch
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
  Calendar as CalendarIcon,
  Repeat
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
  isSameDay,
  addWeeks,
  subWeeks
} from 'date-fns';
import NotificationPermission from '../components/NotificationPermission';
import { usePermissions } from '../hooks/usePermissions';
import { UserProfile } from '../types';
import { migrateCalendarEvents } from '../utils/migrateTasks';

interface CalendarEvent {
  id?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reminders: Reminder[];
  type: 'meeting' | 'call' | 'deadline' | 'personal' | 'other' | 'bill';
  userId: string; // Owner of the event
  userName?: string; // For display purposes
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  repeatEventId?: string; // Links to repeat event that created this event
  // Bill-specific properties
  billId?: string;
  billNumber?: string;
  customerName?: string;
  amount?: number;
  invoiceSent?: boolean;
  paymentConfirmed?: boolean;
  priority?: 'low' | 'medium' | 'high';
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

interface RepeatEvent {
  id?: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  type: 'meeting' | 'call' | 'deadline' | 'personal' | 'other' | 'bill';
  reminders: Reminder[];
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // Every X days/weeks/months/years
    daysOfWeek?: number[]; // For weekly: [0=Sunday, 1=Monday, ...]
    dayOfMonth?: number; // For monthly: 1-31
    endDate?: string; // Optional end date for recurrence
    occurrences?: number; // Optional: number of occurrences
  };
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const Calendar: React.FC = () => {
  const { userProfile, isCoordinator, isAdmin, canViewAllUsers, canEditUserCalendar } = usePermissions();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reminderTemplates, setReminderTemplates] = useState<ReminderTemplate[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRepeatEventModal, setShowRepeatEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingRepeatEvent, setEditingRepeatEvent] = useState<RepeatEvent | null>(null);
  const [repeatEvents, setRepeatEvents] = useState<RepeatEvent[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(''); // For admin filtering
  const [loading, setLoading] = useState(true);

  const [eventFormData, setEventFormData] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    type: 'meeting',
    reminders: [],
    userId: ''
  });

  const [repeatEventFormData, setRepeatEventFormData] = useState<Partial<RepeatEvent>>({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    type: 'meeting',
    reminders: [],
    recurrence: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1], // Default to Monday
    },
    active: true
  });

  const [newTemplate, setNewTemplate] = useState<Partial<ReminderTemplate>>({
    name: '',
    reminders: []
  });
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [templateViewMode, setTemplateViewMode] = useState<'list' | 'form'>('list');

  useEffect(() => {
    if (userProfile) {
      fetchData();
    }
    
    // Start the email reminder service
    emailService.startReminderService();
    
    // Cleanup function to stop the service when component unmounts
    return () => {
      emailService.stopReminderService();
    };
  }, [userProfile, canViewAllUsers, selectedUserId]);

  const fetchData = async () => {
    if (!userProfile) return;
    
    try {
      // Run migration for legacy calendar events
      try {
        await migrateCalendarEvents(userProfile.id);
      } catch (migrationError) {
        console.error('Calendar migration warning:', migrationError);
        // Continue even if migration fails
      }

      // Build the events query based on role and selected user
      let eventsQuery;
      if (isCoordinator && !selectedUserId) {
        // Coordinators see all events by default
        eventsQuery = query(collection(db, 'calendar_events'), orderBy('startDate', 'asc'));
      } else if (isAdmin && selectedUserId) {
        // Admins can filter by specific user
        eventsQuery = query(
          collection(db, 'calendar_events'), 
          where('userId', '==', selectedUserId),
          orderBy('startDate', 'asc')
        );
      } else if (isAdmin && !selectedUserId) {
        // Admins see all events when no user is selected
        eventsQuery = query(collection(db, 'calendar_events'), orderBy('startDate', 'asc'));
      } else {
        // Regular users only see their own events
        eventsQuery = query(
          collection(db, 'calendar_events'), 
          where('userId', '==', userProfile.id),
          orderBy('startDate', 'asc')
        );
      }

      const promises = [
        getDocs(eventsQuery),
        getDocs(collection(db, 'reminder_templates')),
        getDocs(query(collection(db, 'repeat_events'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'pending_bills'))
      ];

      // Add users query if user has permission
      if (canViewAllUsers) {
        promises.push(getDocs(collection(db, 'users')));
      }

      const results = await Promise.all(promises);
      const eventsSnapshot = results[0];
      const templatesSnapshot = results[1];
      const repeatEventsSnapshot = results[2];
      const billsSnapshot = results[3];
      const usersSnapshot = canViewAllUsers ? results[4] : undefined;

      const eventsData: CalendarEvent[] = [];
      eventsSnapshot.forEach((doc) => {
        const eventData = { id: doc.id, ...doc.data() } as CalendarEvent;
        eventsData.push(eventData);
      });

      // Convert bills to calendar events
      if (billsSnapshot) {
        billsSnapshot.forEach((doc) => {
          const billData = doc.data();
          const billEvent: CalendarEvent = {
            id: `bill-${doc.id}`,
            title: `Bill #${billData.billNumber || 'N/A'}`,
            description: `Customer: ${billData.customerName}\nAmount: $${billData.total?.toFixed(2) || '0.00'}`,
            startDate: billData.dueDate || new Date().toISOString().split('T')[0],
            endDate: billData.dueDate || new Date().toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '09:30',
            type: 'bill' as CalendarEvent['type'],
            reminders: [],
            userId: userProfile?.id || '',
            billId: doc.id,
            billNumber: billData.billNumber,
            customerName: billData.customerName,
            amount: billData.total,
            invoiceSent: billData.invoiceSent || false,
            paymentConfirmed: billData.paymentConfirmed || false,
            billStatus: billData.status // Add the bill status
          } as CalendarEvent & { billStatus: string };
          eventsData.push(billEvent);
        });
      }

      const templatesData: ReminderTemplate[] = [];
      templatesSnapshot.forEach((doc) => {
        templatesData.push({ id: doc.id, ...doc.data() } as ReminderTemplate);
      });

      const repeatEventsData: RepeatEvent[] = [];
      repeatEventsSnapshot.forEach((doc) => {
        repeatEventsData.push({ id: doc.id, ...doc.data() } as RepeatEvent);
      });

      // Handle users data if available
      const usersData: UserProfile[] = [];
      if (usersSnapshot) {
        usersSnapshot.forEach((doc) => {
          usersData.push({ id: doc.id, ...doc.data() } as UserProfile);
        });
        setUsers(usersData);
        
        // Add userName to events
        eventsData.forEach(event => {
          if (event.userId) {
            const user = usersData.find(u => u.id === event.userId);
            event.userName = user ? user.name : 'Unknown User';
          }
        });
      }

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
      setRepeatEvents(repeatEventsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) return;
    
    try {
      const eventData = {
        ...eventFormData,
        userId: eventFormData.userId || userProfile.id, // Ensure userId is set
        reminders: eventFormData.reminders || []
      };

      if (editingEvent) {
        // Check if user can edit this event
        if (!canEditUserCalendar(editingEvent.userId)) {
          alert('You do not have permission to edit this event');
          return;
        }
        
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

  // Generate calendar events from repeat event rules
  const generateEventsFromRepeatEvent = async (repeatEvent: RepeatEvent) => {
    if (!repeatEvent.active) return 0;

    const now = new Date();
    const { recurrence } = repeatEvent;
    const events: Omit<CalendarEvent, 'id'>[] = [];
    
    // Generate events for the next 6 months or until max occurrences/end date
    const maxDate = recurrence.endDate ? new Date(recurrence.endDate) : new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    const maxOccurrences = recurrence.occurrences || 100; // Default max for safety
    
    let currentDate = new Date(now);
    let occurrenceCount = 0;

    while (currentDate <= maxDate && occurrenceCount < maxOccurrences) {
      let shouldAddEvent = false;
      let nextDate = new Date(currentDate);
      
      switch (recurrence.frequency) {
        case 'daily':
          shouldAddEvent = true;
          nextDate.setDate(currentDate.getDate() + recurrence.interval);
          break;
          
        case 'weekly':
          const dayOfWeek = currentDate.getDay();
          const dayOfWeekAdjusted = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday (0) to 7
          
          if (recurrence.daysOfWeek && recurrence.daysOfWeek.includes(dayOfWeekAdjusted)) {
            shouldAddEvent = true;
          }
          
          // Move to next day
          nextDate.setDate(currentDate.getDate() + 1);
          
          // If we've completed a week cycle for this interval
          if (dayOfWeek === 0 && recurrence.interval > 1) {
            nextDate.setDate(currentDate.getDate() + (recurrence.interval - 1) * 7);
          }
          break;
          
        case 'monthly':
          shouldAddEvent = true;
          nextDate.setMonth(currentDate.getMonth() + recurrence.interval);
          break;
          
        case 'yearly':
          shouldAddEvent = true;
          nextDate.setFullYear(currentDate.getFullYear() + recurrence.interval);
          break;
      }

      if (shouldAddEvent && currentDate >= now) {
        const eventDate = currentDate.toISOString().split('T')[0];
        
        // Check if event already exists for this date
        const existingEvent = events.find((event: CalendarEvent) => 
          event.startDate === eventDate && 
          event.title === repeatEvent.title &&
          event.repeatEventId === repeatEvent.id
        );
        
        if (!existingEvent) {
          events.push({
            title: repeatEvent.title,
            description: repeatEvent.description,
            startDate: eventDate,
            endDate: eventDate,
            startTime: repeatEvent.startTime,
            endTime: repeatEvent.endTime,
            type: repeatEvent.type,
            reminders: repeatEvent.reminders,
            repeatEventId: repeatEvent.id,
            userId: userProfile?.id || '', // Use current user for repeat events
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          occurrenceCount++;
        }
      }

      currentDate = nextDate;
    }

    // Save generated events to Firestore
    const batch = writeBatch(db);
    events.forEach(event => {
      const docRef = doc(collection(db, 'calendar_events'));
      batch.set(docRef, event);
    });
    
    if (events.length > 0) {
      await batch.commit();
    }
    
    return events.length;
  };

  const handleRepeatEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const repeatEventData = {
        ...repeatEventFormData,
        reminders: repeatEventFormData.reminders || [],
        active: repeatEventFormData.active !== false // Default to true if not specified
      };

      let repeatEventId: string;
      
      if (editingRepeatEvent) {
        await updateDoc(doc(db, 'repeat_events', editingRepeatEvent.id!), {
          ...repeatEventData,
          updatedAt: Timestamp.now(),
        });
        repeatEventId = editingRepeatEvent.id!;
      } else {
        const docRef = await addDoc(collection(db, 'repeat_events'), {
          ...repeatEventData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        repeatEventId = docRef.id;
      }

      // Generate calendar events if active
      if (repeatEventData.active) {
        const eventCount = await generateEventsFromRepeatEvent({
          ...repeatEventData,
          id: repeatEventId
        } as RepeatEvent);
        console.log(`Generated ${eventCount} calendar events from repeat event`);
      }
      
      fetchData();
      closeRepeatEventModal();
    } catch (error) {
      console.error('Error saving repeat event:', error);
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

  const handleDeleteRepeatEvent = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this repeat event? This will stop creating future occurrences.')) {
      try {
        await deleteDoc(doc(db, 'repeat_events', id));
        fetchData();
      } catch (error) {
        console.error('Error deleting repeat event:', error);
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
        reminders: [],
        userId: userProfile?.id || ''
      });
    }
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const openRepeatEventModal = (repeatEvent?: RepeatEvent) => {
    if (repeatEvent) {
      setEditingRepeatEvent(repeatEvent);
      setRepeatEventFormData(repeatEvent);
    } else {
      setEditingRepeatEvent(null);
      setRepeatEventFormData({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
        type: 'meeting',
        reminders: [],
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [1], // Default to Monday
        },
        active: true
      });
    }
    setShowRepeatEventModal(true);
  };

  const closeRepeatEventModal = () => {
    setShowRepeatEventModal(false);
    setEditingRepeatEvent(null);
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

  const getEventTypeColor = (event: CalendarEvent) => {
    if (event.type === 'bill') {
      if (event.paymentConfirmed) {
        return 'bg-green-100 text-green-800 border-green-200'; // Payment confirmed - green
      } else if (event.invoiceSent) {
        return 'bg-blue-100 text-blue-800 border-blue-200'; // Invoice sent - blue
      } else {
        // Check bill status from the bill data
        const billData = event as CalendarEvent & { billStatus?: string };
        if (billData.billStatus === 'upcoming') {
          return 'bg-purple-100 text-purple-800 border-purple-200'; // Upcoming - purple
        } else {
          return 'bg-orange-100 text-orange-800 border-orange-200'; // Pending - orange
        }
      }
    }
    
    switch (event.type) {
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
            {isCoordinator && <p>Coordinator View - Seeing all events</p>}
            {isAdmin && !selectedUserId && <p>Admin View - All users</p>}
            {isAdmin && selectedUserId && <p>Admin View - Filtered by user</p>}
          </div>
          <div className="header-actions">
            {isAdmin && (
              <select
                value={selectedUserId}
                onChange={async (e) => {
                  setSelectedUserId(e.target.value);
                  // Refetch events when admin changes user filter
                  try {
                    await fetchData();
                  } catch (error) {
                    console.error('Error refetching events:', error);
                  }
                }}
                className="user-filter-select"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        
        <div className="calendar-header-actions">
          <div className="view-toggle">
            <button 
              className={`btn-toggle ${viewMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setViewMode('monthly')}
            >
              Month
            </button>
            <button 
              className={`btn-toggle ${viewMode === 'weekly' ? 'active' : ''}`}
              onClick={() => setViewMode('weekly')}
            >
              Week
            </button>
          </div>
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
          <button 
            className="btn-secondary" 
            onClick={() => openRepeatEventModal()}
          >
            <Repeat size={20} />
            Repeat Event
          </button>
          <button className="btn-primary" onClick={() => openEventModal()}>
            <Plus size={20} />
            Add Event
          </button>
        </div>

      {/* Calendar Navigation */}
      <div className="calendar-nav">
        <button 
          className="btn-icon" 
          onClick={() => {
            if (viewMode === 'monthly') {
              setCurrentDate(subMonths(currentDate, 1));
            } else {
              setCurrentWeek(subWeeks(currentWeek, 1));
            }
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="calendar-title">
          {viewMode === 'monthly' 
            ? format(currentDate, 'MMMM yyyy')
            : `${format(startOfWeek(currentWeek), 'MMM d')} - ${format(endOfWeek(currentWeek), 'MMM d, yyyy')}`
          }
        </h2>
        <button 
          className="btn-icon" 
          onClick={() => {
            if (viewMode === 'monthly') {
              setCurrentDate(addMonths(currentDate, 1));
            } else {
              setCurrentWeek(addWeeks(currentWeek, 1));
            }
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-container">
        {viewMode === 'monthly' ? (
        <div className="main-calendar-grid">
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
                      className={`event-item ${getEventTypeColor(event)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.type !== 'bill') {
                          openEventModal(event);
                        }
                      }}
                    >
                      <span className="event-time">{event.startTime}</span>
                      <span className="event-title">
                        {event.repeatEventId && <Repeat size={12} className="repeat-icon" />}
                        {event.title}
                        {(isCoordinator || isAdmin) && event.userName && (
                          <span className="event-user"> - {event.userName}</span>
                        )}
                      </span>
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
        ) : (
        <div className="weekly-calendar-grid">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekly-day-header">
              {day}
            </div>
          ))}
          
          {/* Weekly Days */}
          {eachDayOfInterval({ 
            start: startOfWeek(currentWeek), 
            end: endOfWeek(currentWeek) 
          }).map((day) => {
            const dayEvents = getEventsForDay(day);
            
            return (
              <div
                key={day.toString()}
                className={`weekly-day ${isToday(day) ? 'today' : ''}`}
                onClick={() => {
                  setSelectedDate(day);
                  if (dayEvents.length === 0) {
                    openEventModal(undefined, day);
                  }
                }}
              >
                <div className="weekly-day-number">{format(day, 'd')}</div>
                <div className="weekly-day-events">
                  {dayEvents.map((event, index) => (
                    <div
                      key={event.id}
                      className={`weekly-event-item ${getEventTypeColor(event)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.type !== 'bill') {
                          openEventModal(event);
                        }
                      }}
                    >
                      <span className="weekly-event-time">{event.startTime}</span>
                      <span className="weekly-event-title">
                        {event.repeatEventId && <Repeat size={10} className="repeat-icon" />}
                        {event.title}
                        {(isCoordinator || isAdmin) && event.userName && (
                          <span className="event-user"> - {event.userName}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        )}
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
                    <option value="bill">Bill</option>
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

      {/* Repeat Event Modal */}
      {showRepeatEventModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingRepeatEvent ? 'Edit' : 'Create'} Repeat Event</h2>
              <button onClick={closeRepeatEventModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleRepeatEventSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Event Title *</label>
                  <input
                    type="text"
                    value={repeatEventFormData.title || ''}
                    onChange={(e) => setRepeatEventFormData({ 
                      ...repeatEventFormData, 
                      title: e.target.value 
                    })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={repeatEventFormData.type || 'meeting'}
                    onChange={(e) => setRepeatEventFormData({ 
                      ...repeatEventFormData, 
                      type: e.target.value as CalendarEvent['type']
                    })}
                  >
                    <option value="meeting">Meeting</option>
                    <option value="call">Call</option>
                    <option value="deadline">Deadline</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={repeatEventFormData.description || ''}
                  onChange={(e) => setRepeatEventFormData({ 
                    ...repeatEventFormData, 
                    description: e.target.value 
                  })}
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={repeatEventFormData.startTime || '09:00'}
                    onChange={(e) => setRepeatEventFormData({ 
                      ...repeatEventFormData, 
                      startTime: e.target.value 
                    })}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={repeatEventFormData.endTime || '10:00'}
                    onChange={(e) => setRepeatEventFormData({ 
                      ...repeatEventFormData, 
                      endTime: e.target.value 
                    })}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Recurrence Settings</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Repeat Every</label>
                    <select
                      value={repeatEventFormData.recurrence?.frequency || 'weekly'}
                      onChange={(e) => setRepeatEventFormData({
                        ...repeatEventFormData,
                        recurrence: {
                          ...repeatEventFormData.recurrence!,
                          frequency: e.target.value as RepeatEvent['recurrence']['frequency']
                        }
                      })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Every</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={repeatEventFormData.recurrence?.interval || 1}
                      onChange={(e) => setRepeatEventFormData({
                        ...repeatEventFormData,
                        recurrence: {
                          ...repeatEventFormData.recurrence!,
                          interval: parseInt(e.target.value)
                        }
                      })}
                    />
                    <small>
                      {repeatEventFormData.recurrence?.frequency === 'daily' && 'day(s)'}
                      {repeatEventFormData.recurrence?.frequency === 'weekly' && 'week(s)'}
                      {repeatEventFormData.recurrence?.frequency === 'monthly' && 'month(s)'}
                      {repeatEventFormData.recurrence?.frequency === 'yearly' && 'year(s)'}
                    </small>
                  </div>
                </div>

                {repeatEventFormData.recurrence?.frequency === 'weekly' && (
                  <div className="form-group">
                    <label>Days of the Week</label>
                    <div className="days-of-week">
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                        <label key={index} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={repeatEventFormData.recurrence?.daysOfWeek?.includes(index) || false}
                            onChange={(e) => {
                              const daysOfWeek = repeatEventFormData.recurrence?.daysOfWeek || [];
                              const newDaysOfWeek = e.target.checked
                                ? [...daysOfWeek, index]
                                : daysOfWeek.filter(d => d !== index);
                              
                              setRepeatEventFormData({
                                ...repeatEventFormData,
                                recurrence: {
                                  ...repeatEventFormData.recurrence!,
                                  daysOfWeek: newDaysOfWeek
                                }
                              });
                            }}
                          />
                          <span>{day.substring(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>End Date (Optional)</label>
                    <input
                      type="date"
                      value={repeatEventFormData.recurrence?.endDate || ''}
                      onChange={(e) => setRepeatEventFormData({
                        ...repeatEventFormData,
                        recurrence: {
                          ...repeatEventFormData.recurrence!,
                          endDate: e.target.value || undefined
                        }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Occurrences (Optional)</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={repeatEventFormData.recurrence?.occurrences || ''}
                      onChange={(e) => setRepeatEventFormData({
                        ...repeatEventFormData,
                        recurrence: {
                          ...repeatEventFormData.recurrence!,
                          occurrences: e.target.value ? parseInt(e.target.value) : undefined
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={repeatEventFormData.active || true}
                    onChange={(e) => setRepeatEventFormData({
                      ...repeatEventFormData,
                      active: e.target.checked
                    })}
                  />
                  <span>Active (will create calendar events)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeRepeatEventModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingRepeatEvent ? 'Update' : 'Create'} Repeat Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Calendar;