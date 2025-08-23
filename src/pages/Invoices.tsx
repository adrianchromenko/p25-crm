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
  FileText,
  UserPlus
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import jsPDF from 'jspdf';

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
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'active',
  });
  const [formData, setFormData] = useState<Partial<Invoice>>({
    invoiceNumber: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
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
    const day = new Date().getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10).toString();
    return `${year}${month}${day}${random}`;
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
    if (customerId === 'new-customer') {
      setShowNewCustomerForm(true);
      setFormData({
        ...formData,
        customerId: '',
        customerName: '',
        customerEmail: '',
        customerAddress: ''
      });
    } else {
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
      setShowNewCustomerForm(false);
    }
  };

  const handleCreateCustomer = async () => {
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        ...newCustomerData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      const newCustomer = {
        id: docRef.id,
        ...newCustomerData
      } as Customer;
      
      setCustomers([...customers, newCustomer]);
      
      // Auto-select the new customer
      setFormData({
        ...formData,
        customerId: docRef.id,
        customerName: newCustomerData.name || '',
        customerEmail: newCustomerData.email || '',
        customerAddress: `${newCustomerData.company}\n${newCustomerData.phone}\n${newCustomerData.email}`
      });
      
      setShowNewCustomerForm(false);
      setNewCustomerData({
        name: '',
        email: '',
        phone: '',
        company: '',
        status: 'active',
      });
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If new customer form is showing but customer hasn't been created yet
    if (showNewCustomerForm && !formData.customerId) {
      alert('Please create the customer first before saving the invoice');
      return;
    }
    
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
        dueDate: new Date().toISOString().split('T')[0],
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
    setShowNewCustomerForm(false);
    setNewCustomerData({
      name: '',
      email: '',
      phone: '',
      company: '',
      status: 'active',
    });
  };

  const openPreview = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setShowPreview(true);
  };

  const generatePDF = async (invoice: Invoice) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Set default font
      pdf.setFont('helvetica');
      
      // Add logo if it exists
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
          logoImg.src = '/images/logo.png';
        });
        
        // Add logo to PDF
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = logoImg.width;
        canvas.height = logoImg.height;
        ctx?.drawImage(logoImg, 0, 0);
        const logoBase64 = canvas.toDataURL('image/png');
        
        // Calculate logo dimensions (max 25mm wide, maintain aspect ratio)
        const maxLogoWidth = 25;
        const logoAspectRatio = logoImg.height / logoImg.width;
        const logoWidth = Math.min(maxLogoWidth, 25);
        const logoHeight = logoWidth * logoAspectRatio;
        
        pdf.addImage(logoBase64, 'PNG', margin, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 8;
      } catch (error) {
        console.log('Logo not found, continuing without logo');
        // Continue without logo if it fails to load
      }
      
      // Company info section
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // #64748b
      pdf.text('Adrian Chromenko', margin, yPos);
      yPos += 5;
      pdf.text('66 Chartwell Dr.', margin, yPos);
      yPos += 5;
      pdf.text('Sault Ste. Marie, Ontario', margin, yPos);
      yPos += 5;
      pdf.text('(647) 203-3189', margin, yPos);
      yPos += 5;
      pdf.text('adrian@primarydm.com', margin, yPos);
      yPos += 8;
      
      // HST Number
      pdf.setTextColor(148, 163, 184); // #94a3b8
      pdf.setFontSize(9);
      pdf.text('HST#: 83023 3235 RT0001', margin, yPos);
      
      // Invoice title and details (right side)
      pdf.setFontSize(16);
      pdf.setTextColor(148, 163, 184);
      pdf.text('INVOICE', pageWidth - margin, margin, { align: 'right' });
      
      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105); // #475569
      let rightY = margin + 10;
      pdf.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - margin, rightY, { align: 'right' });
      rightY += 5;
      pdf.text(`Issue Date: ${format(parseISO(invoice.issueDate), 'MMMM dd, yyyy')}`, pageWidth - margin, rightY, { align: 'right' });
      rightY += 5;
      pdf.text(`Due Date: ${format(parseISO(invoice.dueDate), 'MMMM dd, yyyy')}`, pageWidth - margin, rightY, { align: 'right' });
      
      // Draw a line
      yPos += 10;
      pdf.setDrawColor(226, 232, 240); // #e2e8f0
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;
      
      // Bill To section
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('BILL TO', margin, yPos);
      yPos += 5;
      
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59); // #1e293b
      pdf.setFont('helvetica', 'bold');
      pdf.text(invoice.customerName, margin, yPos);
      pdf.setFont('helvetica', 'normal');
      yPos += 5;
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      const addressLines = (invoice.customerAddress || '').split('\n');
      addressLines.forEach(line => {
        if (line.trim()) {
          pdf.text(line, margin, yPos);
          yPos += 5;
        }
      });
      
      yPos += 10;
      
      // Table header
      pdf.setFillColor(250, 250, 250); // #fafafa
      pdf.rect(margin, yPos - 5, pageWidth - (margin * 2), 10, 'F');
      
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text('DESCRIPTION', margin + 2, yPos);
      pdf.text('QTY', pageWidth - 80, yPos);
      pdf.text('UNIT PRICE', pageWidth - 55, yPos);
      pdf.text('TOTAL', pageWidth - margin - 2, yPos, { align: 'right' });
      
      yPos += 12; // More space after header
      
      // Table rows
      pdf.setFontSize(10);
      invoice.lineItems.forEach((item, itemIndex) => {
        pdf.setTextColor(71, 85, 105);
        
        // Wrap long descriptions
        const descLines = pdf.splitTextToSize(item.description, pageWidth - 110);
        descLines.forEach((line: string, index: number) => {
          pdf.text(line, margin + 2, yPos);
          if (index === 0) {
            // Position qty, unit price, and total with more spacing
            pdf.text(item.quantity.toString(), pageWidth - 80, yPos);
            pdf.text(`$${item.unitPrice.toFixed(2)}`, pageWidth - 55, yPos);
            pdf.setTextColor(51, 65, 85); // #334155
            pdf.setFont('helvetica', 'bold');
            pdf.text(`$${item.total.toFixed(2)}`, pageWidth - margin - 2, yPos, { align: 'right' });
            pdf.setFont('helvetica', 'normal');
          }
          yPos += 5;
        });
        
        // Draw line between items (but not after the last item)
        if (itemIndex < invoice.lineItems.length - 1) {
          yPos += 2;
          pdf.setDrawColor(241, 245, 249); // #f1f5f9
          pdf.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 5;
        } else {
          yPos += 3;
        }
      });
      
      // Summary section
      yPos += 10;
      const summaryX = pageWidth - 85;
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Subtotal:', summaryX, yPos);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin - 2, yPos, { align: 'right' });
      yPos += 7;
      
      pdf.setTextColor(100, 116, 139);
      pdf.text(`HST (${(invoice.hstRate * 100).toFixed(1)}%):`, summaryX, yPos);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`$${invoice.hstAmount.toFixed(2)}`, pageWidth - margin - 2, yPos, { align: 'right' });
      yPos += 7;
      
      // Total line
      pdf.setDrawColor(226, 232, 240);
      pdf.line(summaryX - 5, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 5;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('Total:', summaryX, yPos);
      pdf.text(`$${invoice.totalAmount.toFixed(2)}`, pageWidth - margin - 2, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      
      // Notes section if present
      if (invoice.notes) {
        yPos += 15;
        pdf.setFontSize(9);
        pdf.setTextColor(148, 163, 184);
        pdf.text('NOTES', margin, yPos);
        yPos += 5;
        
        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        const noteLines = pdf.splitTextToSize(invoice.notes, pageWidth - (margin * 2));
        noteLines.forEach((line: string) => {
          pdf.text(line, margin, yPos);
          yPos += 5;
        });
      }
      
      // Footer
      yPos = pageHeight - 25;
      pdf.setDrawColor(241, 245, 249);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;
      
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      pdf.text('Payment due within 30 days of invoice date.', pageWidth / 2, yPos, { align: 'center' });
      
      // Save the PDF
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
                    value={showNewCustomerForm ? 'new-customer' : formData.customerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    required={!showNewCustomerForm}
                  >
                    <option value="">Select Customer</option>
                    <option value="new-customer">+ Add New Customer</option>
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

              {showNewCustomerForm && (
                <div className="new-customer-form">
                  <h3><UserPlus size={18} /> New Customer Details</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Name *</label>
                      <input
                        type="text"
                        value={newCustomerData.name}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        value={newCustomerData.email}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Company</label>
                      <input
                        type="text"
                        value={newCustomerData.company}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, company: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        value={newCustomerData.phone}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={handleCreateCustomer}
                    disabled={!newCustomerData.name || !newCustomerData.email}
                  >
                    Create Customer
                  </button>
                </div>
              )}

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
                  <img 
                    src="/images/logo.png" 
                    alt="Primary Digital Marketing" 
                    className="invoice-logo"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="company-details">
                    <p>Adrian Chromenko</p>
                    <p>66 Chartwell Dr.</p>
                    <p>Sault Ste. Marie, Ontario</p>
                    <p>(647) 203-3189</p>
                    <p>adrian@primarydm.com</p>
                    <p className="hst-number">HST#: 83023 3235 RT0001</p>
                  </div>
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