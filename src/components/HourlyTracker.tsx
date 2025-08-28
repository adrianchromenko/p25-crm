import React, { useState, useEffect } from 'react';
import { Play, Pause, Clock, Plus, Trash2, Edit3 } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Customer, TimeEntry } from '../types';

const HourlyTracker: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState<number>(100);
  const [currentTimer, setCurrentTimer] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [manualHours, setManualHours] = useState<string>('');
  const [manualMinutes, setManualMinutes] = useState<string>('');

  useEffect(() => {
    fetchCustomers();
    fetchTimeEntries();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTimer) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const start = currentTimer.startTime.getTime();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentTimer]);

  const fetchCustomers = async () => {
    try {
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customersList = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchTimeEntries = async () => {
    try {
      const entriesSnapshot = await getDocs(collection(db, 'time_entries'));
      const entriesList = entriesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime ? data.endTime.toDate() : undefined,
        };
      }) as TimeEntry[];
      
      const runningEntry = entriesList.find(entry => entry.isRunning);
      if (runningEntry) {
        setCurrentTimer(runningEntry);
      }
      
      setTimeEntries(entriesList.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ));
    } catch (error) {
      console.error('Error fetching time entries:', error);
    }
  };

  const startTimer = async () => {
    if (!selectedCustomerId || !description.trim()) {
      alert('Please select a customer and enter a description');
      return;
    }

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    if (!selectedCustomer) return;

    const newEntry: Omit<TimeEntry, 'id'> = {
      customerId: selectedCustomerId,
      customerName: selectedCustomer.name,
      description: description.trim(),
      startTime: new Date(),
      hourlyRate,
      isRunning: true,
      createdAt: new Date(),
    };

    try {
      const docRef = await addDoc(collection(db, 'time_entries'), newEntry);
      const entryWithId = { ...newEntry, id: docRef.id };
      setCurrentTimer(entryWithId);
      setTimeEntries(prev => [entryWithId, ...prev]);
      setElapsedTime(0);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const stopTimer = async () => {
    if (!currentTimer) return;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - currentTimer.startTime.getTime()) / 60000); // in minutes
    const totalAmount = (duration / 60) * currentTimer.hourlyRate;

    try {
      await updateDoc(doc(db, 'time_entries', currentTimer.id!), {
        endTime,
        duration,
        totalAmount,
        isRunning: false,
        updatedAt: new Date(),
      });

      setTimeEntries(prev => 
        prev.map(entry => 
          entry.id === currentTimer.id 
            ? { ...entry, endTime, duration, totalAmount, isRunning: false }
            : entry
        )
      );
      
      setCurrentTimer(null);
      setElapsedTime(0);
      setDescription('');
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const addManualEntry = async () => {
    if (!selectedCustomerId || !description.trim() || !manualHours && !manualMinutes) {
      alert('Please fill in all required fields');
      return;
    }

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    if (!selectedCustomer) return;

    const hours = parseInt(manualHours) || 0;
    const minutes = parseInt(manualMinutes) || 0;
    const totalMinutes = hours * 60 + minutes;
    const totalAmount = (totalMinutes / 60) * hourlyRate;
    const now = new Date();

    const newEntry: Omit<TimeEntry, 'id'> = {
      customerId: selectedCustomerId,
      customerName: selectedCustomer.name,
      description: description.trim(),
      startTime: now,
      endTime: new Date(now.getTime() + totalMinutes * 60000),
      duration: totalMinutes,
      hourlyRate,
      totalAmount,
      isRunning: false,
      createdAt: new Date(),
    };

    try {
      const docRef = await addDoc(collection(db, 'time_entries'), newEntry);
      const entryWithId = { ...newEntry, id: docRef.id };
      setTimeEntries(prev => [entryWithId, ...prev]);
      setDescription('');
      setManualHours('');
      setManualMinutes('');
      setShowManualEntry(false);
    } catch (error) {
      console.error('Error adding manual entry:', error);
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to delete this time entry?')) return;

    try {
      await deleteDoc(doc(db, 'time_entries', entryId));
      setTimeEntries(prev => prev.filter(entry => entry.id !== entryId));
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { 
      style: 'currency', 
      currency: 'CAD'
    }).format(amount);
  };

  const getTotalBillableAmount = () => {
    return timeEntries.reduce((total, entry) => total + (entry.totalAmount || 0), 0);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <Clock size={24} />
            <div>
              <h1>Hourly Tracker</h1>
              <p>Track billable hours for clients</p>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Timer Section */}
        <div className="card">
          <h2>Time Tracker</h2>
          <div className="timer-controls">
            <div className="form-group">
              <label>Client</label>
              <select 
                value={selectedCustomerId} 
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                disabled={currentTimer !== null}
              >
                <option value="">Select a client...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.company}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Task Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you working on?"
                disabled={currentTimer !== null}
              />
            </div>
            
            <div className="form-group">
              <label>Hourly Rate</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                disabled={currentTimer !== null}
              />
            </div>
          </div>

          {currentTimer ? (
            <div className="timer-display">
              <div className="timer-info">
                <h3>Currently tracking: {currentTimer.customerName}</h3>
                <p>{currentTimer.description}</p>
                <div className="timer-time">{formatTime(elapsedTime)}</div>
                <p>Rate: {formatCurrency(currentTimer.hourlyRate)}/hour</p>
              </div>
              <button className="btn btn-danger" onClick={stopTimer}>
                <Pause size={16} />
                Stop Timer
              </button>
            </div>
          ) : (
            <div className="timer-actions">
              <button className="btn btn-primary" onClick={startTimer}>
                <Play size={16} />
                Start Timer
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowManualEntry(!showManualEntry)}
              >
                <Plus size={16} />
                Add Manual Entry
              </button>
            </div>
          )}

          {showManualEntry && (
            <div className="manual-entry">
              <h3>Add Manual Time Entry</h3>
              <div className="manual-time-inputs">
                <div className="form-group">
                  <label>Hours</label>
                  <input
                    type="number"
                    value={manualHours}
                    onChange={(e) => setManualHours(e.target.value)}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Minutes</label>
                  <input
                    type="number"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                    min="0"
                    max="59"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="manual-entry-actions">
                <button className="btn btn-primary" onClick={addManualEntry}>
                  Add Entry
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowManualEntry(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card">
          <h2>Summary</h2>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">Total Entries</span>
              <span className="stat-value">{timeEntries.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Billable</span>
              <span className="stat-value">{formatCurrency(getTotalBillableAmount())}</span>
            </div>
          </div>
        </div>

        {/* Time Entries List */}
        <div className="card">
          <h2>Time Entries</h2>
          {timeEntries.length > 0 ? (
            <div className="time-entries-list">
              {timeEntries.map(entry => (
                <div key={entry.id} className={`time-entry ${entry.isRunning ? 'running' : ''}`}>
                  <div className="entry-info">
                    <div className="entry-header">
                      <h4>{entry.customerName}</h4>
                      <span className="entry-date">
                        {entry.startTime.toLocaleDateString()}
                      </span>
                    </div>
                    <p className="entry-description">{entry.description}</p>
                    <div className="entry-details">
                      {entry.isRunning ? (
                        <span className="entry-status running">Running...</span>
                      ) : (
                        <>
                          <span>Duration: {formatDuration(entry.duration!)}</span>
                          <span>Rate: {formatCurrency(entry.hourlyRate)}/hour</span>
                          <span className="entry-total">
                            Total: {formatCurrency(entry.totalAmount!)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {!entry.isRunning && (
                    <div className="entry-actions">
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteEntry(entry.id!)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No time entries yet. Start tracking your first session!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HourlyTracker;