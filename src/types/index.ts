export interface Website {
  id: string;
  url: string;
  hostingPlan: string;
  status: 'active' | 'suspended' | 'cancelled';
  monthlyFee: number;
  nextRenewal: string;
  lastPayment?: string;
  notes?: string;
}

export interface Payment {
  id?: string;
  customerId: string;
  websiteId?: string;
  amount: number;
  paymentDate: string;
  coverageStartDate: string;
  coverageEndDate: string;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'paypal' | 'other';
  status: 'paid' | 'pending' | 'failed';
  invoiceNumber?: string;
  notes?: string;
  createdAt?: Date;
}

export interface Customer {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'active' | 'inactive' | 'pending';
  websites: Website[];
  totalMonthlyFee?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Service {
  id?: string;
  name: string;
  description: string;
  basePrice: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  isActive: boolean;
  isHosting?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerAddress?: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  hstEnabled?: boolean; // Whether HST is applied to this invoice
  hstRate?: number; // 0.13 for Ontario HST
  hstAmount?: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TimeEntry {
  id?: string;
  customerId: string;
  customerName: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes
  hourlyRate: number;
  totalAmount?: number;
  isRunning: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserRole = 'user' | 'coordinator' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FinancialForecast {
  id?: string;
  userId: string;
  month: string; // Format: YYYY-MM
  year: number;
  monthName: string; // e.g., "January"
  expectedSales: number;
  expectedExpenses: number;
  actualSales?: number; // For tracking actual vs forecast
  actualExpenses?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}