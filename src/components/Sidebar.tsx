import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Settings, 
  LogOut,
  Building2,
  CreditCard,
  FileText,
  Calendar,
  Receipt,
  CheckSquare,
  FileEdit,
  StickyNote,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

interface MenuItem {
  path: string;
  name: string;
  icon: React.ReactNode;
  badge?: string | null;
}

const Sidebar: React.FC = () => {
  const { signOut, currentUser } = useAuth();
  const navigate = useNavigate();
  const [billingTotal, setBillingTotal] = useState<number>(0);

  useEffect(() => {
    fetchBillingTotal();
  }, []);

  const fetchBillingTotal = async () => {
    try {
      const billsSnapshot = await getDocs(collection(db, 'pending_bills'));
      let total = 0;
      let activeBillsCount = 0;
      let convertedBillsCount = 0;
      
      console.log('=== BILLING TOTAL CALCULATION DEBUG ===');
      
      billsSnapshot.forEach((doc) => {
        const billData = doc.data();
        // Only count active bills (pending and ready_to_invoice, but not converted)
        const isActiveBill = billData.status === 'pending' || billData.status === 'ready_to_invoice';
        
        console.log(`Bill ${billData.billNumber || doc.id}: Status="${billData.status}", Total=${billData.total}, IsActive=${isActiveBill}`);
        
        if (isActiveBill) {
          activeBillsCount++;
          if (billData.total && typeof billData.total === 'number') {
            console.log(`  Adding $${billData.total} to total (running total: $${total + billData.total})`);
            total += billData.total;
          } else {
            console.log(`  Skipping - total is not a valid number:`, billData.total);
          }
        } else if (billData.status === 'converted') {
          convertedBillsCount++;
          console.log(`  Skipping converted bill with total: $${billData.total}`);
        } else {
          console.log(`  Skipping bill with status: ${billData.status}`);
        }
      });
      
      console.log(`FINAL: ${activeBillsCount} active bills, ${convertedBillsCount} converted bills, Total: $${total}`);
      console.log('=== END BILLING DEBUG ===');
      
      setBillingTotal(total);
    } catch (error) {
      console.error('Error fetching billing total:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { 
      style: 'currency', 
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const menuItems: MenuItem[] = [
    { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/calendar', name: 'Calendar', icon: <Calendar size={20} /> },
    { path: '/tasks', name: 'Tasks', icon: <CheckSquare size={20} /> },
    { path: '/customers', name: 'Customers', icon: <Users size={20} /> },
    { path: '/proposals', name: 'Proposals', icon: <FileEdit size={20} /> },
    { path: '/billing', name: 'Billing', icon: <Receipt size={20} />, badge: billingTotal > 0 ? formatCurrency(billingTotal) : null },
    { path: '/hourly-tracker', name: 'Hourly Tracker', icon: <Clock size={20} /> },
    { path: '/financial-forecast', name: 'Financial Forecast', icon: <TrendingUp size={20} /> },
    { path: '/payments', name: 'Payments', icon: <CreditCard size={20} /> },
    { path: '/invoices', name: 'Invoices', icon: <FileText size={20} /> },
    { path: '/notes', name: 'Notes', icon: <StickyNote size={20} /> },
    { path: '/services', name: 'Services', icon: <Package size={20} /> },
    { path: '/settings', name: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Building2 size={28} />
        <span className="logo-text">P25 CRM</span>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            {item.icon}
            <span>{item.name}</span>
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-email">{currentUser?.email}</span>
        </div>
        <button className="sign-out-btn" onClick={handleSignOut}>
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;