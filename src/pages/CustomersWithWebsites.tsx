import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Customer, Website, Payment } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Globe,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Grid3X3,
  List
} from 'lucide-react';
import { format, parseISO, isBefore, addDays } from 'date-fns';

const CustomersWithWebsites: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'pending',
    websites: [],
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersSnapshot, paymentsSnapshot] = await Promise.all([
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'payments'))
      ]);
      
      const customersData: Customer[] = [];
      customersSnapshot.forEach((doc) => {
        const data = doc.data();
        customersData.push({ 
          id: doc.id, 
          ...data,
          websites: data.websites || []
        } as Customer);
      });

      const paymentsData: Payment[] = [];
      paymentsSnapshot.forEach((doc) => {
        paymentsData.push({ id: doc.id, ...doc.data() } as Payment);
      });

      setCustomers(customersData);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWebsiteId = () => {
    return `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addWebsite = () => {
    const newWebsite: Website = {
      id: generateWebsiteId(),
      url: '',
      hostingPlan: '',
      status: 'active',
      monthlyFee: 0,
      nextRenewal: new Date().toISOString().split('T')[0],
      notes: ''
    };
    setWebsites([...websites, newWebsite]);
  };

  const updateWebsite = (index: number, field: keyof Website, value: any) => {
    const updatedWebsites = [...websites];
    updatedWebsites[index] = { ...updatedWebsites[index], [field]: value };
    setWebsites(updatedWebsites);
  };

  const removeWebsite = (index: number) => {
    setWebsites(websites.filter((_, i) => i !== index));
  };

  const calculateTotalMonthlyFee = () => {
    return websites.reduce((total, website) => total + (website.monthlyFee || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerData = {
        ...formData,
        websites,
        totalMonthlyFee: calculateTotalMonthlyFee()
      };

      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id!), {
          ...customerData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...customerData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      fetchData();
      closeModal();
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer? This will also delete all payment records.')) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        fetchData();
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
      setWebsites(customer.websites || []);
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        status: 'pending',
        websites: [],
        notes: '',
      });
      setWebsites([]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setWebsites([]);
  };

  const getCustomerPayments = (customerId: string) => {
    return payments
      .filter(p => p.customerId === customerId)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  };

  const getWebsiteStatus = (website: Website, customerId: string) => {
    const websitePayments = payments.filter(
      p => p.customerId === customerId && p.websiteId === website.id && p.status === 'paid'
    );
    
    if (websitePayments.length === 0) return 'no-payment';
    
    const lastPayment = websitePayments.sort((a, b) => 
      b.coverageEndDate.localeCompare(a.coverageEndDate)
    )[0];
    
    const coverageEnd = parseISO(lastPayment.coverageEndDate);
    const today = new Date();
    const warningDate = addDays(today, 7);
    
    if (isBefore(coverageEnd, today)) return 'expired';
    if (isBefore(coverageEnd, warningDate)) return 'expiring-soon';
    return 'covered';
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.websites?.some(w => w.url.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="loading">Loading customers...</div>;
  }

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <h1>Hosting Customers</h1>
          <p>Manage hosting clients and their websites</p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={`btn-icon ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={20} />
            </button>
            <button
              className={`btn-icon ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card View"
            >
              <Grid3X3 size={20} />
            </button>
          </div>
          <button className="btn-primary" onClick={() => openModal()}>
            <Plus size={20} />
            Add Customer
          </button>
        </div>
      </div>

      <div className="search-bar">
        <Search size={20} />
        <input
          type="text"
          placeholder="Search customers or websites..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {viewMode === 'table' ? (
        <div className="table-container">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Websites</th>
                <th>Monthly Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="customer-name">{customer.name}</div>
                  </td>
                  <td>{customer.company}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>
                    <span className={`status-badge ${customer.status}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td>
                    <div className="websites-cell">
                      {customer.websites && customer.websites.length > 0 ? (
                        <div className="websites-summary">
                          <span className="website-count">
                            <Globe size={14} /> {customer.websites.length}
                          </span>
                          <div className="website-statuses">
                            {customer.websites.map((website) => {
                              const status = getWebsiteStatus(website, customer.id!);
                              return (
                                <span key={website.id} className={`status-dot ${status}`} title={website.url}>
                                  {status === 'expired' && <AlertCircle size={12} />}
                                  {status === 'expiring-soon' && <AlertCircle size={12} />}
                                  {status === 'covered' && <CheckCircle size={12} />}
                                  {status === 'no-payment' && <AlertCircle size={12} />}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="no-websites">No websites</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {customer.totalMonthlyFee ? (
                      <span className="amount">${customer.totalMonthlyFee.toFixed(2)}</span>
                    ) : (
                      <span className="no-amount">$0.00</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon small" 
                        onClick={() => {
                          setSelectedCustomerId(customer.id!);
                          setShowPaymentHistory(true);
                        }}
                        title="View Payment History"
                      >
                        <DollarSign size={14} />
                      </button>
                      <button className="btn-icon small" onClick={() => openModal(customer)} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-icon small delete" onClick={() => handleDelete(customer.id!)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="customer-card enhanced">
              <div className="customer-header">
                <h3>{customer.name}</h3>
                <span className={`status-badge ${customer.status}`}>
                  {customer.status}
                </span>
              </div>
              
              <div className="customer-info">
                <p><strong>Company:</strong> {customer.company}</p>
                <p><strong>Email:</strong> {customer.email}</p>
                <p><strong>Phone:</strong> {customer.phone}</p>
                {customer.totalMonthlyFee && (
                  <p className="monthly-total">
                    <strong>Total Monthly:</strong> 
                    <span className="amount">${customer.totalMonthlyFee.toFixed(2)}</span>
                  </p>
                )}
              </div>

              {customer.websites && customer.websites.length > 0 && (
                <div className="websites-section">
                  <h4><Globe size={16} /> Websites ({customer.websites.length})</h4>
                  <div className="websites-list">
                    {customer.websites.map((website) => {
                      const status = getWebsiteStatus(website, customer.id!);
                      return (
                        <div key={website.id} className={`website-item ${status}`}>
                          <div className="website-url">
                            {status === 'expired' && <AlertCircle size={14} className="status-icon" />}
                            {status === 'expiring-soon' && <AlertCircle size={14} className="status-icon warning" />}
                            {status === 'covered' && <CheckCircle size={14} className="status-icon success" />}
                            <span>{website.url}</span>
                          </div>
                          <div className="website-details">
                            <span className="hosting-plan">{website.hostingPlan}</span>
                            <span className="monthly-fee">${website.monthlyFee}/mo</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="customer-actions">
                <button 
                  className="btn-icon" 
                  onClick={() => {
                    setSelectedCustomerId(customer.id!);
                    setShowPaymentHistory(true);
                  }}
                  title="View Payment History"
                >
                  <DollarSign size={18} />
                </button>
                <button className="btn-icon" onClick={() => openModal(customer)}>
                  <Edit2 size={18} />
                </button>
                <button className="btn-icon delete" onClick={() => handleDelete(customer.id!)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className="btn-icon" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'pending' })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="websites-form-section">
                <div className="section-header">
                  <h3>Websites</h3>
                  <button type="button" className="btn-secondary small" onClick={addWebsite}>
                    <Plus size={16} />
                    Add Website
                  </button>
                </div>
                
                {websites.map((website, index) => (
                  <div key={website.id} className="website-form-item">
                    <div className="website-form-grid">
                      <div className="form-group">
                        <label>Website URL</label>
                        <input
                          type="text"
                          value={website.url}
                          onChange={(e) => updateWebsite(index, 'url', e.target.value)}
                          placeholder="example.com"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Hosting Plan</label>
                        <input
                          type="text"
                          value={website.hostingPlan}
                          onChange={(e) => updateWebsite(index, 'hostingPlan', e.target.value)}
                          placeholder="Basic, Pro, etc."
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Monthly Fee</label>
                        <input
                          type="number"
                          step="0.01"
                          value={website.monthlyFee}
                          onChange={(e) => updateWebsite(index, 'monthlyFee', parseFloat(e.target.value))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select
                          value={website.status}
                          onChange={(e) => updateWebsite(index, 'status', e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn-icon delete"
                        onClick={() => removeWebsite(index)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {websites.length > 0 && (
                  <div className="total-monthly">
                    <strong>Total Monthly Fee:</strong> ${calculateTotalMonthlyFee().toFixed(2)}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? 'Update' : 'Add'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentHistory && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Payment History</h2>
              <button className="btn-icon" onClick={() => setShowPaymentHistory(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="payment-history">
              {getCustomerPayments(selectedCustomerId).length > 0 ? (
                <div className="payments-list">
                  {getCustomerPayments(selectedCustomerId).map((payment) => {
                    const customer = customers.find(c => c.id === payment.customerId);
                    const website = customer?.websites?.find(w => w.id === payment.websiteId);
                    
                    return (
                      <div key={payment.id} className="payment-item">
                        <div className="payment-date">
                          {format(parseISO(payment.paymentDate), 'MMM dd, yyyy')}
                        </div>
                        <div className="payment-details">
                          {website && <span className="website-url">{website.url}</span>}
                          <span className="amount">${payment.amount.toFixed(2)}</span>
                          <span className={`payment-status ${payment.status}`}>
                            {payment.status}
                          </span>
                        </div>
                        <div className="coverage-info">
                          Coverage: {format(parseISO(payment.coverageStartDate), 'MMM dd')} - 
                          {format(parseISO(payment.coverageEndDate), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">No payment history for this customer</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersWithWebsites;