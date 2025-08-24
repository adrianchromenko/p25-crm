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
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  FileText,
  DollarSign,
  Calendar as CalendarIcon,
  User,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, getDay } from 'date-fns';

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
  status: 'pending' | 'ready_to_invoice' | 'converted';
  priority: 'low' | 'medium' | 'high';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const Billing: React.FC = () => {
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [showBillModal, setShowBillModal] = useState(false);
  const [editingBill, setEditingBill] = useState<PendingBill | null>(null);
  const [loading, setLoading] = useState(true);

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
    status: 'pending',
    priority: 'medium'
  });

  useEffect(() => {
    fetchBills();
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

  const calculateItemAmount = (quantity: number, rate: number) => {
    return quantity * rate;
  };

  const calculateTotals = (items: BillItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * 0.13; // 13% HST
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    const newItems = [...(billFormData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = calculateItemAmount(newItems[index].quantity, newItems[index].rate);
    }
    
    const { subtotal, tax, total } = calculateTotals(newItems);
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

  const removeItem = (index: number) => {
    const newItems = (billFormData.items || []).filter((_, i) => i !== index);
    const { subtotal, tax, total } = calculateTotals(newItems);
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
        priority: 'medium'
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'ready_to_invoice': return 'status-ready';
      case 'converted': return 'status-converted';
      default: return 'status-pending';
    }
  };

  // Calculate collection amounts by date
  const getCollectionsForDate = (date: Date) => {
    return bills.filter(bill => 
      bill.expectedCollectionDate && 
      isSameDay(new Date(bill.expectedCollectionDate), date) &&
      bill.status !== 'converted' // Don't show converted bills
    );
  };

  const getTotalCollectionForDate = (date: Date) => {
    const collections = getCollectionsForDate(date);
    return collections.reduce((sum, bill) => sum + (bill.total || 0), 0);
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
  
  const monthlyTotals = calculateMonthlyTotals();
  const grandTotal = monthlyTotals.reduce((sum, month) => sum + month.total, 0);

  return (
    <div className="billing-page">
      <div className="page-header">
        <div>
          <h1>Billing</h1>
          <p>Track pending bills before converting them to invoices</p>
        </div>
        <button className="btn-primary" onClick={() => openBillModal()}>
          <Plus size={20} />
          Add Bill
        </button>
      </div>

      {/* Collection Calendar */}
      <div className="collection-calendar-section">
        <div className="calendar-section-header">
          <h2>Expected Collections - Next 3 Months</h2>
          <div className="collection-summary">
            <div className="summary-totals">
              {monthlyTotals.map((month, index) => (
                <div key={index} className="month-total">
                  <span className="month-name">{month.month}</span>
                  <span className="month-amount">${month.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="grand-total">
              <span>Total Expected: </span>
              <strong>${grandTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>
        <div className="calendar-grid">
          {calendarMonths.map((month, monthIndex) => (
            <div key={monthIndex} className="calendar-month">
              <div className="calendar-header">
                <h3>{format(month.date, 'MMMM yyyy')}</h3>
              </div>
              
              <div className="calendar-days-header">
                <div className="calendar-day-label">Sun</div>
                <div className="calendar-day-label">Mon</div>
                <div className="calendar-day-label">Tue</div>
                <div className="calendar-day-label">Wed</div>
                <div className="calendar-day-label">Thu</div>
                <div className="calendar-day-label">Fri</div>
                <div className="calendar-day-label">Sat</div>
              </div>
              
              <div className="calendar-days">
                {month.days.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={dayIndex} className="calendar-day empty"></div>;
                  }
                  
                  const collections = getCollectionsForDate(day);
                  const totalAmount = getTotalCollectionForDate(day);
                  const hasCollections = collections.length > 0;
                  
                  return (
                    <div 
                      key={dayIndex} 
                      className={`calendar-day ${hasCollections ? 'has-collections' : ''}`}
                      title={hasCollections ? 
                        `$${totalAmount.toFixed(2)} expected\n${collections.map(b => `${b.customerName}: $${b.total?.toFixed(2)}`).join('\n')}` 
                        : ''
                      }
                    >
                      <div className="calendar-day-number">
                        {format(day, 'd')}
                      </div>
                      {hasCollections && (
                        <div className="calendar-day-amount">
                          ${totalAmount > 1000 ? `${(totalAmount/1000).toFixed(1)}k` : totalAmount.toFixed(0)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
                  <span className={`bill-priority-badge ${getPriorityColor(bill.priority)}`}>
                    {bill.priority}
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
                      onClick={() => updateBillStatus(bill.id!, 'ready_to_invoice')}
                      title="Mark Ready"
                    >
                      Ready
                    </button>
                  )}
                  {bill.status === 'ready_to_invoice' && (
                    <button 
                      className="btn-sm btn-primary"
                      onClick={() => updateBillStatus(bill.id!, 'converted')}
                      title="Mark Converted"
                    >
                      Convert
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
                    <option value="pending">Pending</option>
                    <option value="ready_to_invoice">Ready to Invoice</option>
                    <option value="converted">Converted</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={billFormData.priority || 'medium'}
                    onChange={(e) => setBillFormData({ ...billFormData, priority: e.target.value as PendingBill['priority'] })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
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
                <div className="totals-row">
                  <span>Subtotal:</span>
                  <span>${(billFormData.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="totals-row">
                  <span>HST (13%):</span>
                  <span>${(billFormData.tax || 0).toFixed(2)}</span>
                </div>
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
                <button type="submit" className="btn-primary">
                  {editingBill ? 'Update Bill' : 'Create Bill'}
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