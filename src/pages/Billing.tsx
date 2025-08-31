import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  FileText,
  DollarSign,
  Calendar as CalendarIcon,
  User,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, getDay, isToday, addWeeks, subWeeks, subMonths, parseISO, isSameMonth, startOfISOWeek, endOfISOWeek } from 'date-fns';

interface BillItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface PendingBill {
  id?: string;
  billNumber: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  dueDate: string;
  expectedCollectionDate?: string;
  status: 'upcoming' | 'pending' | 'sent_invoice' | 'paid';
  invoiceSent?: boolean;
  paymentConfirmed?: boolean;
  includeHST?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Expense {
  id?: string;
  title: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  vendor?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const Billing: React.FC = () => {
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingBill, setEditingBill] = useState<PendingBill | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Calendar state
  const [calendarViewMode, setCalendarViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const navigate = useNavigate();

  const [billFormData, setBillFormData] = useState<Partial<PendingBill>>({
    billNumber: `BILL-${Date.now()}`,
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    subtotal: 0,
    tax: 0,
    total: 0,
    notes: '',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    expectedCollectionDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 45 days from now
    status: 'upcoming',
    includeHST: true
  });

  const [expenseFormData, setExpenseFormData] = useState<Partial<Expense>>({
    title: '',
    description: '',
    amount: 0,
    category: 'Office',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    notes: ''
  });

  useEffect(() => {
    fetchBills();
    fetchExpenses();
  }, []);

  const fetchBills = async () => {
    try {
      const billsSnapshot = await getDocs(
        query(collection(db, 'pending_bills'), orderBy('createdAt', 'desc'))
      );
      const billsData: PendingBill[] = [];
      billsSnapshot.forEach((doc) => {
        billsData.push({ id: doc.id, ...doc.data() } as PendingBill);
      });
      setBills(billsData);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const expensesSnapshot = await getDocs(
        query(collection(db, 'expenses'), orderBy('date', 'desc'))
      );
      const expensesData: Expense[] = [];
      expensesSnapshot.forEach((doc) => {
        expensesData.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const calculateItemAmount = (quantity: number, rate: number) => {
    return quantity * rate;
  };

  const calculateTotals = (items: BillItem[], includeHST = true) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = includeHST ? subtotal * 0.13 : 0; // 13% HST only if includeHST is true
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    const newItems = [...(billFormData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = calculateItemAmount(newItems[index].quantity, newItems[index].rate);
    }
    
    const { subtotal, tax, total } = calculateTotals(newItems, billFormData.includeHST);
    setBillFormData({
      ...billFormData,
      items: newItems,
      subtotal,
      tax,
      total
    });
  };

  const addItem = () => {
    const newItems = [...(billFormData.items || []), { description: '', quantity: 1, rate: 0, amount: 0 }];
    setBillFormData({ ...billFormData, items: newItems });
  };

  const toggleHST = () => {
    const newIncludeHST = !billFormData.includeHST;
    const { subtotal, tax, total } = calculateTotals(billFormData.items || [], newIncludeHST);
    setBillFormData({
      ...billFormData,
      includeHST: newIncludeHST,
      subtotal,
      tax,
      total
    });
  };

  const createInvoiceFromBill = (bill: PendingBill) => {
    // Prepare data for the invoice page
    const invoiceData = {
      customerName: bill.customerName,
      customerEmail: bill.customerEmail,
      customerAddress: bill.customerAddress,
      lineItems: bill.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.rate,
        total: item.amount
      })),
      subtotal: bill.subtotal,
      hstAmount: bill.tax,
      totalAmount: bill.total,
      notes: bill.notes
    };

    // Navigate to invoice page with the bill data
    navigate('/invoices', { state: { fromBill: invoiceData } });
  };

  const removeItem = (index: number) => {
    const newItems = (billFormData.items || []).filter((_, i) => i !== index);
    const { subtotal, tax, total } = calculateTotals(newItems, billFormData.includeHST);
    setBillFormData({
      ...billFormData,
      items: newItems,
      subtotal,
      tax,
      total
    });
  };

  const openBillModal = (bill?: PendingBill) => {
    if (bill) {
      setEditingBill(bill);
      setBillFormData(bill);
    } else {
      setEditingBill(null);
      setBillFormData({
        billNumber: `BILL-${Date.now()}`,
        customerName: '',
        customerEmail: '',
        customerAddress: '',
        items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        subtotal: 0,
        tax: 0,
        total: 0,
        notes: '',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        expectedCollectionDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        includeHST: true
      });
    }
    setShowBillModal(true);
  };

  const closeBillModal = () => {
    setShowBillModal(false);
    setEditingBill(null);
  };

  const saveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const billData = {
        ...billFormData,
        updatedAt: Timestamp.now()
      };

      if (editingBill) {
        await updateDoc(doc(db, 'pending_bills', editingBill.id!), billData);
      } else {
        await addDoc(collection(db, 'pending_bills'), {
          ...billData,
          createdAt: Timestamp.now()
        });
      }

      await fetchBills();
      closeBillModal();
    } catch (error) {
      console.error('Error saving bill:', error);
    }
  };

  const deleteBill = async (billId: string) => {
    if (window.confirm('Are you sure you want to delete this bill?')) {
      try {
        await deleteDoc(doc(db, 'pending_bills', billId));
        await fetchBills();
      } catch (error) {
        console.error('Error deleting bill:', error);
      }
    }
  };

  const updateBillStatus = async (billId: string, status: PendingBill['status']) => {
    try {
      await updateDoc(doc(db, 'pending_bills', billId), { 
        status,
        updatedAt: Timestamp.now()
      });
      await fetchBills();
    } catch (error) {
      console.error('Error updating bill status:', error);
    }
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'status-upcoming';
      case 'pending': return 'status-pending';
      case 'sent_invoice': return 'status-sent-invoice';
      case 'paid': return 'status-paid';
      // Legacy statuses
      case 'ready_to_invoice': return 'status-sent-invoice';
      case 'converted': return 'status-paid';
      default: return 'status-pending';
    }
  };

  const openExpenseModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseFormData(expense);
    } else {
      setEditingExpense(null);
      setExpenseFormData({
        title: '',
        description: '',
        amount: 0,
        category: 'Office',
        date: new Date().toISOString().split('T')[0],
        vendor: '',
        notes: ''
      });
    }
    setShowExpenseModal(true);
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
    setEditingExpense(null);
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const expenseData = {
        ...expenseFormData,
        updatedAt: Timestamp.now()
      };

      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id!), expenseData);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          createdAt: Timestamp.now()
        });
      }

      await fetchExpenses();
      closeExpenseModal();
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteDoc(doc(db, 'expenses', expenseId));
        await fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  // Calculate collection amounts by date
  const getCollectionsForDate = (date: Date) => {
    return bills.filter(bill => 
      bill.expectedCollectionDate && 
      isSameDay(new Date(bill.expectedCollectionDate), date) &&
      bill.status !== 'paid' // Don't show paid bills
    );
  };

  const getTotalCollectionForDate = (date: Date) => {
    const collections = getCollectionsForDate(date);
    return collections.reduce((sum, bill) => sum + (bill.total || 0), 0);
  };

  const getExpensesForDate = (date: Date) => {
    return expenses.filter(expense => 
      expense.date && isSameDay(new Date(expense.date), date)
    );
  };

  const getTotalExpenseForDate = (date: Date) => {
    const expensesForDate = getExpensesForDate(date);
    return expensesForDate.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  };

  // Generate calendar data for 3 months
  const generateCalendarMonths = () => {
    const today = new Date();
    const months = [];
    
    for (let i = 0; i < 3; i++) {
      const monthStart = startOfMonth(addMonths(today, i));
      const monthEnd = endOfMonth(monthStart);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      // Add empty cells for days before month starts
      const startDay = getDay(monthStart);
      const emptyCells = Array(startDay).fill(null);
      
      months.push({
        date: monthStart,
        days: [...emptyCells, ...days]
      });
    }
    
    return months;
  };

  if (loading) {
    return <div className="loading">Loading bills...</div>;
  }

  const calendarMonths = generateCalendarMonths();
  
  // Calculate total expected collections for next 3 months
  const calculateMonthlyTotals = () => {
    const today = new Date();
    const totals = [];
    
    for (let i = 0; i < 3; i++) {
      const monthStart = startOfMonth(addMonths(today, i));
      const monthEnd = endOfMonth(monthStart);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      const monthTotal = monthDays.reduce((sum, day) => {
        return sum + getTotalCollectionForDate(day);
      }, 0);
      
      totals.push({
        month: format(monthStart, 'MMM yyyy'),
        total: monthTotal
      });
    }
    
    return totals;
  };
  
  // Remove unused variables from old calendar implementation
  // const monthlyTotals = calculateMonthlyTotals();
  // const grandTotal = monthlyTotals.reduce((sum, month) => sum + month.total, 0);

  // Calendar helper functions
  const getBillsForDay = (day: Date) => {
    return bills.filter(bill => {
      if (!bill.dueDate) return false;
      try {
        // Handle both ISO date strings and date strings
        const billDate = bill.dueDate.includes('T') ? parseISO(bill.dueDate) : parseISO(bill.dueDate + 'T00:00:00');
        return isSameDay(billDate, day);
      } catch (error) {
        console.warn('Invalid bill due date:', bill.dueDate);
        return false;
      }
    });
  };

  const getBillStatusColor = (bill: PendingBill) => {
    switch (bill.status) {
      case 'upcoming':
        return 'bg-purple-100 text-purple-800 border-purple-200'; // Upcoming - purple
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200'; // Pending - orange
      case 'sent_invoice':
        return 'bg-blue-100 text-blue-800 border-blue-200'; // Sent Invoice - blue
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200'; // Paid - green
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'; // Default - gray
    }
  };

  // Calculate weekly totals by status
  const getWeeklyTotals = () => {
    const weekStart = startOfISOWeek(currentWeek);
    const weekEnd = endOfISOWeek(currentWeek);
    
    const weeklyBills = bills.filter(bill => {
      if (!bill.dueDate) return false;
      try {
        const billDate = bill.dueDate.includes('T') ? parseISO(bill.dueDate) : parseISO(bill.dueDate + 'T00:00:00');
        return billDate >= weekStart && billDate <= weekEnd;
      } catch (error) {
        return false;
      }
    });

    const totals = {
      upcoming: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      sentInvoice: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    };

    weeklyBills.forEach(bill => {
      switch (bill.status) {
        case 'upcoming':
          totals.upcoming.count++;
          totals.upcoming.amount += bill.total || 0;
          break;
        case 'pending':
          totals.pending.count++;
          totals.pending.amount += bill.total || 0;
          break;
        case 'sent_invoice':
          totals.sentInvoice.count++;
          totals.sentInvoice.amount += bill.total || 0;
          break;
        case 'paid':
          totals.paid.count++;
          totals.paid.amount += bill.total || 0;
          break;
        default:
          // Handle legacy bills or unknown statuses
          if (bill.paymentConfirmed || bill.status === 'converted') {
            totals.paid.count++;
            totals.paid.amount += bill.total || 0;
          } else if (bill.invoiceSent) {
            totals.sentInvoice.count++;
            totals.sentInvoice.amount += bill.total || 0;
          } else {
            totals.pending.count++;
            totals.pending.amount += bill.total || 0;
          }
          break;
      }
    });

    return totals;
  };

  const weeklyTotals = getWeeklyTotals();

  return (
    <div className="billing-page">
      <div className="page-header">
        <div>
          <h1>Billing</h1>
          <p>Track pending bills before converting them to invoices</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => openExpenseModal()}>
            <Plus size={20} />
            Add Expense
          </button>
          <button className="btn-primary" onClick={() => openBillModal()}>
            <Plus size={20} />
            Add Bill
          </button>
        </div>
      </div>

      {/* Bills Calendar - Weekly View */}
      <div className="bills-calendar-section">
        <div className="bills-calendar-header">
          <h2>Bills Calendar</h2>
          <div className="calendar-controls">
            <div className="view-toggle">
              <button 
                className={`btn-toggle ${calendarViewMode === 'weekly' ? 'active' : ''}`}
                onClick={() => setCalendarViewMode('weekly')}
              >
                Week
              </button>
              <button 
                className={`btn-toggle ${calendarViewMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setCalendarViewMode('monthly')}
              >
                Month
              </button>
            </div>
            <div className="calendar-nav">
              <button 
                className="btn-icon" 
                onClick={() => {
                  if (calendarViewMode === 'monthly') {
                    setCurrentDate(subMonths(currentDate, 1));
                  } else {
                    setCurrentWeek(subWeeks(currentWeek, 1));
                  }
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <h3 className="calendar-title">
                {calendarViewMode === 'monthly' 
                  ? format(currentDate, 'MMMM yyyy')
                  : `${format(startOfISOWeek(currentWeek), 'MMM d')} - ${format(endOfISOWeek(currentWeek), 'MMM d, yyyy')}`
                }
              </h3>
              <button 
                className="btn-icon" 
                onClick={() => {
                  if (calendarViewMode === 'monthly') {
                    setCurrentDate(addMonths(currentDate, 1));
                  } else {
                    setCurrentWeek(addWeeks(currentWeek, 1));
                  }
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Weekly Totals Summary - only show in weekly view */}
        {calendarViewMode === 'weekly' && (
          <div className="weekly-totals-summary">
            <h4>This Week's Bills</h4>
            <div className="totals-grid">
              <div className="total-item upcoming">
                <span className="total-label">Upcoming</span>
                <span className="total-count">{weeklyTotals.upcoming.count}</span>
                <span className="total-amount">${weeklyTotals.upcoming.amount.toFixed(2)}</span>
              </div>
              <div className="total-item pending">
                <span className="total-label">Pending</span>
                <span className="total-count">{weeklyTotals.pending.count}</span>
                <span className="total-amount">${weeklyTotals.pending.amount.toFixed(2)}</span>
              </div>
              <div className="total-item invoice-sent">
                <span className="total-label">Sent Invoice</span>
                <span className="total-count">{weeklyTotals.sentInvoice.count}</span>
                <span className="total-amount">${weeklyTotals.sentInvoice.amount.toFixed(2)}</span>
              </div>
              <div className="total-item payment-confirmed">
                <span className="total-label">Paid</span>
                <span className="total-count">{weeklyTotals.paid.count}</span>
                <span className="total-amount">${weeklyTotals.paid.amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Calendar Grid */}
        <div className="bills-calendar-container">
          {calendarViewMode === 'monthly' ? (
            <div className="bills-monthly-grid">
              {/* Day Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="bills-day-header">
                  {day}
                </div>
              ))}
              
              {/* Calendar Days */}
              {eachDayOfInterval({ 
                start: startOfISOWeek(startOfMonth(currentDate)), 
                end: endOfISOWeek(endOfMonth(currentDate)) 
              }).map((day) => {
                const dayBills = getBillsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                
                return (
                  <div
                    key={day.toString()}
                    className={`bills-calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${
                      isToday(day) ? 'today' : ''
                    }`}
                  >
                    <div className="bills-day-number">{format(day, 'd')}</div>
                    <div className="bills-day-events">
                      {dayBills.slice(0, 3).map((bill, index) => (
                        <div
                          key={bill.id}
                          className={`bills-event-item ${getBillStatusColor(bill)}`}
                          onClick={() => openBillModal(bill)}
                        >
                          <span className="bills-event-customer">
                            {bill.customerName}
                          </span>
                          <span className="bills-event-amount">
                            ${bill.total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {dayBills.length > 3 && (
                        <div className="more-bills">+{dayBills.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bills-weekly-grid">
              {/* Day Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="bills-weekly-day-header">
                  {day}
                </div>
              ))}
              
              {/* Weekly Days */}
              {eachDayOfInterval({ 
                start: startOfISOWeek(currentWeek), 
                end: endOfISOWeek(currentWeek) 
              }).map((day) => {
                const dayBills = getBillsForDay(day);
                
                return (
                  <div
                    key={day.toString()}
                    className={`bills-weekly-day ${isToday(day) ? 'today' : ''}`}
                  >
                    <div className="bills-weekly-day-number">{format(day, 'd')}</div>
                    <div className="bills-weekly-day-events">
                      {dayBills.length === 0 ? (
                        // Show empty state or nothing
                        null
                      ) : (
                        dayBills.map((bill, index) => (
                          <div
                            key={bill.id}
                            className={`bills-weekly-event-item ${getBillStatusColor(bill)}`}
                            onClick={() => openBillModal(bill)}
                            title={`${bill.customerName} - ${bill.status} - Due: ${bill.dueDate}`}
                          >
                            <span className="bills-weekly-event-customer">
                              {bill.customerName.length > 12 ? bill.customerName.substring(0, 12) + '...' : bill.customerName}
                            </span>
                            <span className="bills-weekly-event-amount">
                              ${bill.total?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      <div className="bills-list">
        {bills.map((bill) => (
          <div key={bill.id} className="bill-item">
            <div className="bill-main">
              <div className="bill-left">
                <div className="bill-header-info">
                  <FileText size={16} />
                  <span className="bill-number">{bill.billNumber}</span>
                  <span className={`bill-status-badge ${getStatusColor(bill.status)}`}>
                    {bill.status.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="bill-content">
                  <div className="bill-customer-info">
                    <User size={14} />
                    <span className="customer-name">{bill.customerName}</span>
                    {bill.customerEmail && (
                      <span className="customer-email">({bill.customerEmail})</span>
                    )}
                  </div>
                  
                  <div className="bill-dates">
                    <div className="bill-due">
                      <CalendarIcon size={14} />
                      Due: {bill.dueDate ? format(new Date(bill.dueDate), 'MMM dd') : 'Not set'}
                    </div>
                    {bill.expectedCollectionDate && (
                      <div className="bill-expected">
                        <CalendarIcon size={14} className="collection-icon" />
                        Expected: {format(new Date(bill.expectedCollectionDate), 'MMM dd')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bill-right">
                <div className="bill-amount">
                  <DollarSign size={16} />
                  <strong>${bill.total?.toFixed(2) || '0.00'}</strong>
                </div>
                
                <div className="bill-actions">
                  {bill.status === 'pending' && (
                    <button 
                      className="btn-sm btn-secondary"
                      onClick={() => updateBillStatus(bill.id!, 'sent_invoice')}
                      title="Send Invoice"
                    >
                      Send Invoice
                    </button>
                  )}
                  {bill.status === 'sent_invoice' && (
                    <button 
                      className="btn-sm btn-primary"
                      onClick={() => updateBillStatus(bill.id!, 'paid')}
                      title="Mark as Paid"
                    >
                      Mark Paid
                    </button>
                  )}
                  <button 
                    className="btn-icon"
                    onClick={() => openBillModal(bill)}
                    title="Edit Bill"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    className="btn-icon btn-danger"
                    onClick={() => deleteBill(bill.id!)}
                    title="Delete Bill"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {bills.length === 0 && (
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>No bills yet</h3>
            <p>Create your first pending bill to get started</p>
          </div>
        )}
      </div>

      {showBillModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingBill ? 'Edit Bill' : 'Create New Bill'}</h2>
              <button onClick={closeBillModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={saveBill} className="bill-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Bill Number</label>
                  <input
                    type="text"
                    value={billFormData.billNumber || ''}
                    onChange={(e) => setBillFormData({ ...billFormData, billNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={billFormData.dueDate || ''}
                    onChange={(e) => setBillFormData({ ...billFormData, dueDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Expected Collection Date</label>
                  <input
                    type="date"
                    value={billFormData.expectedCollectionDate || ''}
                    onChange={(e) => setBillFormData({ ...billFormData, expectedCollectionDate: e.target.value })}
                    placeholder="When do you expect to collect payment?"
                  />
                </div>

                <div className="form-group">
                  <label>Customer Name</label>
                  <input
                    type="text"
                    value={billFormData.customerName || ''}
                    onChange={(e) => setBillFormData({ ...billFormData, customerName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Customer Email</label>
                  <input
                    type="email"
                    value={billFormData.customerEmail || ''}
                    onChange={(e) => setBillFormData({ ...billFormData, customerEmail: e.target.value })}
                  />
                </div>

                <div className="form-group span-2">
                  <label>Customer Address</label>
                  <textarea
                    value={billFormData.customerAddress || ''}
                    onChange={(e) => setBillFormData({ ...billFormData, customerAddress: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={billFormData.status || 'pending'}
                    onChange={(e) => setBillFormData({ ...billFormData, status: e.target.value as PendingBill['status'] })}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="pending">Pending</option>
                    <option value="sent_invoice">Sent Invoice</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

              </div>

              <div className="items-section">
                <div className="items-header">
                  <h3>Items</h3>
                  <button type="button" onClick={addItem} className="btn-secondary">
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>

                <div className="items-list">
                  {(billFormData.items || []).map((item, index) => (
                    <div key={index} className="item-row">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                      <input
                        type="number"
                        placeholder="Rate"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                      />
                      <div className="item-amount">${item.amount.toFixed(2)}</div>
                      {(billFormData.items || []).length > 1 && (
                        <button type="button" onClick={() => removeItem(index)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bill-totals">
                <div className="hst-toggle">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={billFormData.includeHST || false}
                      onChange={toggleHST}
                    />
                    <span className="checkmark"></span>
                    Include HST (13%)
                  </label>
                </div>
                
                <div className="totals-row">
                  <span>Subtotal:</span>
                  <span>${(billFormData.subtotal || 0).toFixed(2)}</span>
                </div>
                {billFormData.includeHST && (
                  <div className="totals-row">
                    <span>HST (13%):</span>
                    <span>${(billFormData.tax || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="totals-row total">
                  <span>Total:</span>
                  <span>${(billFormData.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={billFormData.notes || ''}
                  onChange={(e) => setBillFormData({ ...billFormData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeBillModal} className="btn-secondary">
                  Cancel
                </button>
                {editingBill && (
                  <button 
                    type="button" 
                    onClick={() => createInvoiceFromBill(editingBill)} 
                    className="btn-secondary"
                    style={{ backgroundColor: '#3b82f6', color: 'white' }}
                  >
                    Create Invoice From This Bill
                  </button>
                )}
                <button type="submit" className="btn-primary">
                  {editingBill ? 'Update Bill' : 'Create Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h2>
              <button onClick={closeExpenseModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={saveExpense} className="expense-form">
              <div className="form-grid">
                <div className="form-group span-2">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={expenseFormData.title || ''}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                    required
                    placeholder="Office supplies, Software license, etc."
                  />
                </div>

                <div className="form-group">
                  <label>Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseFormData.amount || 0}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={expenseFormData.date || ''}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={expenseFormData.category || 'Office'}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                  >
                    <option value="Office">Office</option>
                    <option value="Software">Software</option>
                    <option value="Travel">Travel</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Vendor</label>
                  <input
                    type="text"
                    value={expenseFormData.vendor || ''}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, vendor: e.target.value })}
                    placeholder="Company or vendor name"
                  />
                </div>

                <div className="form-group span-2">
                  <label>Description</label>
                  <textarea
                    value={expenseFormData.description || ''}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                    rows={2}
                    placeholder="Brief description of the expense"
                  />
                </div>

                <div className="form-group span-2">
                  <label>Notes</label>
                  <textarea
                    value={expenseFormData.notes || ''}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, notes: e.target.value })}
                    rows={2}
                    placeholder="Additional notes or comments"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeExpenseModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;