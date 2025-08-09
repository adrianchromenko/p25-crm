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
import { Invoice, InvoiceLineItem, Customer } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Download,
  Eye,
  Search,
  FileText
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [formData, setFormData] = useState<Partial<Invoice>>({
    invoiceNumber: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
    subtotal: 0,
    hstRate: 0.13,
    hstAmount: 0,
    totalAmount: 0,
    status: 'draft',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesSnapshot, customersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'invoices'), orderBy('issueDate', 'desc'))),
        getDocs(collection(db, 'customers'))
      ]);

      const invoicesData: Invoice[] = [];
      invoicesSnapshot.forEach((doc) => {
        const data = doc.data();
        invoicesData.push({ 
          id: doc.id, 
          ...data,
          lineItems: data.lineItems || []
        } as Invoice);
      });

      const customersData: Customer[] = [];
      customersSnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() } as Customer);
      });

      setInvoices(invoicesData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
  };

  const addLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: uuidv4(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate total for this line item
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    
    setLineItems(updatedItems);
    calculateTotals(updatedItems);
  };

  const removeLineItem = (index: number) => {
    const updatedItems = lineItems.filter((_, i) => i !== index);
    setLineItems(updatedItems);
    calculateTotals(updatedItems);
  };

  const calculateTotals = (items: InvoiceLineItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const hstAmount = subtotal * (formData.hstRate || 0);
    const totalAmount = subtotal + hstAmount;

    setFormData({
      ...formData,
      subtotal,
      hstAmount,
      totalAmount
    });
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerAddress: `${customer.company}\n${customer.phone}\n${customer.email}`
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invoiceData = {
        ...formData,
        lineItems,
        invoiceNumber: formData.invoiceNumber || generateInvoiceNumber()
      };

      if (editingInvoice) {
        await updateDoc(doc(db, 'invoices', editingInvoice.id!), {
          ...invoiceData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'invoices'), {
          ...invoiceData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      
      fetchData();
      closeModal();
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
        fetchData();
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
    }
  };

  const openModal = (invoice?: Invoice) => {
    if (invoice) {
      setEditingInvoice(invoice);
      setFormData(invoice);
      setLineItems(invoice.lineItems || []);
    } else {
      setEditingInvoice(null);
      setFormData({
        invoiceNumber: generateInvoiceNumber(),
        customerId: '',
        customerName: '',
        customerEmail: '',
        customerAddress: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: addDays(new Date(), 30).toISOString().split('T')[0],
        subtotal: 0,
        hstRate: 0.13,
        hstAmount: 0,
        totalAmount: 0,
        status: 'draft',
        notes: '',
      });
      setLineItems([]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingInvoice(null);
    setLineItems([]);
  };

  const openPreview = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setShowPreview(true);
  };

  const generatePDF = async (invoice: Invoice) => {
    const element = document.getElementById('invoice-preview');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'sent': return 'primary';
      case 'draft': return 'secondary';
      case 'overdue': return 'danger';
      case 'cancelled': return 'muted';
      default: return 'secondary';
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading invoices...</div>;
  }

  return (
    <div className="invoices-page">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Generate and manage client invoices with HST</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={20} />
          Create Invoice
        </button>
      </div>

      <div className="search-bar">
        <Search size={20} />
        <input
          type="text"
          placeholder="Search invoices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="invoices-table-container">
        <table className="invoices-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="invoice-number">{invoice.invoiceNumber}</td>
                <td>
                  <div>
                    <strong>{invoice.customerName}</strong>
                    <br />
                    <small>{invoice.customerEmail}</small>
                  </div>
                </td>
                <td>{format(parseISO(invoice.issueDate), 'MMM dd, yyyy')}</td>
                <td>{format(parseISO(invoice.dueDate), 'MMM dd, yyyy')}</td>
                <td className="amount">${invoice.totalAmount.toFixed(2)}</td>
                <td>
                  <span className={`status-badge ${getStatusColor(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button 
                      className="btn-icon" 
                      onClick={() => openPreview(invoice)}
                      title="Preview"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      className="btn-icon" 
                      onClick={() => generatePDF(invoice)}
                      title="Download PDF"
                    >
                      <Download size={16} />
                    </button>
                    <button className="btn-icon" onClick={() => openModal(invoice)}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn-icon delete" onClick={() => handleDelete(invoice.id!)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Invoice Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>
                <FileText size={20} />
                {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
              </h2>
              <button className="btn-icon" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Invoice Number</label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Customer</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
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
                <div className="form-group">
                  <label>Issue Date</label>
                  <input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Invoice['status'] })}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>HST Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={(formData.hstRate || 0) * 100}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) / 100;
                      setFormData({ ...formData, hstRate: rate });
                      calculateTotals(lineItems);
                    }}
                  />
                </div>
              </div>

              <div className="line-items-section">
                <div className="section-header">
                  <h3>Line Items</h3>
                  <button type="button" className="btn-secondary small" onClick={addLineItem}>
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>
                
                {lineItems.map((item, index) => (
                  <div key={item.id} className="line-item">
                    <div className="line-item-grid">
                      <div className="form-group">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="number"
                          step="0.01"
                          value={item.total.toFixed(2)}
                          readOnly
                          className="readonly"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-icon delete"
                        onClick={() => removeLineItem(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="invoice-totals">
                <div className="totals-grid">
                  <div className="total-row">
                    <span>Subtotal:</span>
                    <span>${(formData.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="total-row">
                    <span>HST ({((formData.hstRate || 0) * 100).toFixed(1)}%):</span>
                    <span>${(formData.hstAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="total-row total">
                    <span><strong>Total:</strong></span>
                    <span><strong>${(formData.totalAmount || 0).toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes or terms"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingInvoice ? 'Update' : 'Create'} Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showPreview && previewInvoice && (
        <div className="modal-overlay">
          <div className="modal extra-large">
            <div className="modal-header">
              <h2>Invoice Preview</h2>
              <div className="preview-actions">
                <button 
                  className="btn-primary"
                  onClick={() => generatePDF(previewInvoice)}
                >
                  <Download size={18} />
                  Download PDF
                </button>
                <button className="btn-icon" onClick={() => setShowPreview(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div id="invoice-preview" className="invoice-preview">
              <div className="invoice-header">
                <div className="company-info">
                  <h1>P25 Development</h1>
                  <p>Web Development & Hosting Services</p>
                  <p>contact@p25dev.com</p>
                </div>
                <div className="invoice-meta">
                  <h2>INVOICE</h2>
                  <p><strong>Invoice #:</strong> {previewInvoice.invoiceNumber}</p>
                  <p><strong>Issue Date:</strong> {format(parseISO(previewInvoice.issueDate), 'MMMM dd, yyyy')}</p>
                  <p><strong>Due Date:</strong> {format(parseISO(previewInvoice.dueDate), 'MMMM dd, yyyy')}</p>
                </div>
              </div>

              <div className="invoice-addresses">
                <div className="bill-to">
                  <h3>Bill To:</h3>
                  <div className="customer-address">
                    <strong>{previewInvoice.customerName}</strong>
                    <br />
                    {previewInvoice.customerAddress?.split('\n').map((line, index) => (
                      <span key={index}>{line}<br /></span>
                    ))}
                  </div>
                </div>
              </div>

              <table className="invoice-items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewInvoice.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>${item.unitPrice.toFixed(2)}</td>
                      <td>${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="invoice-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>${previewInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>HST ({(previewInvoice.hstRate * 100).toFixed(1)}%):</span>
                  <span>${previewInvoice.hstAmount.toFixed(2)}</span>
                </div>
                <div className="summary-row total">
                  <span><strong>Total:</strong></span>
                  <span><strong>${previewInvoice.totalAmount.toFixed(2)}</strong></span>
                </div>
              </div>

              {previewInvoice.notes && (
                <div className="invoice-notes">
                  <h4>Notes:</h4>
                  <p>{previewInvoice.notes}</p>
                </div>
              )}

              <div className="invoice-footer">
                <p>Thank you for your business!</p>
                <p>Payment due within 30 days of invoice date.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;