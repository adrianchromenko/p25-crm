import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Users, Package, DollarSign, TrendingUp } from 'lucide-react';

interface DashboardStats {
  totalCustomers: number;
  totalServices: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalServices: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const customersQuery = query(collection(db, 'customers'));
      const customersSnapshot = await getDocs(customersQuery);
      const totalCustomers = customersSnapshot.size;

      const servicesQuery = query(collection(db, 'services'));
      const servicesSnapshot = await getDocs(servicesQuery);
      const totalServices = servicesSnapshot.size;

      let activeSubscriptions = 0;
      let monthlyRevenue = 0;

      customersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'active') {
          activeSubscriptions++;
        }
        if (data.totalMonthlyFee) {
          monthlyRevenue += data.totalMonthlyFee;
        } else if (data.websites) {
          // Calculate from individual websites for backward compatibility
          data.websites.forEach((website: any) => {
            if (website.monthlyFee) {
              monthlyRevenue += website.monthlyFee;
            }
          });
        }
      });

      setStats({
        totalCustomers,
        totalServices,
        activeSubscriptions,
        monthlyRevenue,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      icon: <Users size={24} />,
      color: 'blue',
    },
    {
      title: 'Services',
      value: stats.totalServices,
      icon: <Package size={24} />,
      color: 'purple',
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions,
      icon: <TrendingUp size={24} />,
      color: 'green',
    },
    {
      title: 'Monthly Revenue',
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      icon: <DollarSign size={24} />,
      color: 'orange',
    },
  ];

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome to your CRM dashboard</p>
      </div>

      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className={`stat-card ${card.color}`}>
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-content">
              <h3>{card.title}</h3>
              <p className="stat-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content">
        <div className="recent-section">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            <p className="empty-state">No recent activity to display</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;