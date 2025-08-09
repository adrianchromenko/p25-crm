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
import { Payment, Customer } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { format, addMonths, parseISO } from 'date-fns';

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [formData, setFormData] = useState<Partial<Payment>>({
    customerId: '',
    websiteId: '',
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    coverageStartDate: new Date().toISOString().split('T')[0],
    coverageEndDate: '',
    paymentMethod: 'credit_card',
    status: 'paid',
    invoiceNumber: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsSnapshot, customersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'payments'), orderBy('paymentDate', 'desc'))),
        getDocs(collection(db, 'customers'))
      ]);

      const paymentsData: Payment[] = [];
      paymentsSnapshot.forEach((doc) => {
        paymentsData.push({ id: doc.id, ...doc.data() } as Payment);
      });

      const customersData: Customer[] = [];
      customersSnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() } as Customer);
      });

      setPayments(paymentsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCoverageEnd = (startDate: string, months: number) => {
    const start = parseISO(startDate);
    const end = addMonths(start, months);
    return format(end, 'yyyy-MM-dd');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const paymentData = {
        ...formData,
        coverageEndDate: formData.coverageEndDate || calculateCoverageEnd(formData.coverageStartDate!, 1),
      };

      if (editingPayment) {
        await updateDoc(doc(db, 'payments', editingPayment.id!), {
          ...paymentData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'payments'), {
          ...paymentData,
          createdAt: Timestamp.now(),
        });
      }
      fetchData();
      closeModal();
    } catch (error) {
      console.error('Error saving payment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment record?')) {
      try {
        await deleteDoc(doc(db, 'payments', id));
        fetchData();
      } catch (error) {
        console.error('Error deleting payment:', error);
      }
    }
  };

  const openModal = (payment?: Payment) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData(payment);
      setSelectedCustomer(payment.customerId);
    } else {
      setEditingPayment(null);
      setFormData({
        customerId: '',
        websiteId: '',
        amount: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        coverageStartDate: new Date().toISOString().split('T')[0],
        coverageEndDate: '',
        paymentMethod: 'credit_card',
        status: 'paid',
        invoiceNumber: '',
        notes: '',
      });
      setSelectedCustomer('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPayment(null);
    setSelectedCustomer('');
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : 'Unknown Customer';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={16} className="text-success" />;
      case 'pending':
        return <Clock size={16} className="text-warning" />;
      case 'failed':
        return <XCircle size={16} className="text-danger" />;
      default:
        return null;
    }
  };

  const getSelectedCustomerWebsites = () => {
    const customer = customers.find(c => c.id === selectedCustomer);
    return customer?.websites || [];
  };

  if (loading) {
    return <div className="loading">Loading payments...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Track customer payments and coverage periods</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={20} />
          Add Payment
        </button>
      </div>

      <div className="payments-table-container">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Website</th>
              <th>Amount</th>
              <th>Coverage Period</th>
              <th>Status</th>
              <th>Method</th>
              <th>Invoice</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const customer = customers.find(c => c.id === payment.customerId);
              const website = customer?.websites?.find(w => w.id === payment.websiteId);
              
              return (
                <tr key={payment.id}>
                  <td>{format(parseISO(payment.paymentDate), 'MMM dd, yyyy')}</td>
                  <td>{getCustomerName(payment.customerId)}</td>
                  <td>{website?.url || '-'}</td>
                  <td className="amount">${payment.amount.toFixed(2)}</td>
                  <td>
                    <span className="coverage-period">
                      {format(parseISO(payment.coverageStartDate), 'MMM dd')} - 
                      {format(parseISO(payment.coverageEndDate), 'MMM dd, yyyy')}
                    </span>
                  </td>
                  <td>
                    <span className={`payment-status ${payment.status}`}>
                      {getStatusIcon(payment.status)}
                      {payment.status}
                    </span>
                  </td>
                  <td>{payment.paymentMethod.replace('_', ' ')}</td>
                  <td>{payment.invoiceNumber || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-icon" onClick={() => openModal(payment)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn-icon delete" onClick={() => handleDelete(payment.id!)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingPayment ? 'Edit Payment' : 'Add New Payment'}</h2>
              <button className="btn-icon" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Customer</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      setFormData({ ...formData, customerId: e.target.value, websiteId: '' });
                      setSelectedCustomer(e.target.value);
                    }}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.company}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedCustomer && getSelectedCustomerWebsites().length > 0 && (
                  <div className="form-group">
                    <label>Website</label>
                    <select
                      value={formData.websiteId}
                      onChange={(e) => setFormData({ ...formData, websiteId: e.target.value })}
                    >
                      <option value="">Select Website (Optional)</option>
                      {getSelectedCustomerWebsites().map((website) => (
                        <option key={website.id} value={website.id}>
                          {website.url}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Payment Date</label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Coverage Start Date</label>
                  <input
                    type="date"
                    value={formData.coverageStartDate}
                    onChange={(e) => setFormData({ ...formData, coverageStartDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Coverage End Date</label>
                  <input
                    type="date"
                    value={formData.coverageEndDate}
                    onChange={(e) => setFormData({ ...formData, coverageEndDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as Payment['paymentMethod'] })}
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="paypal">PayPal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Payment['status'] })}
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Invoice Number</label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Optional notes about this payment"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingPayment ? 'Update' : 'Add'} Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;