import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { usePermissions } from '../hooks/usePermissions';
import { FinancialForecast } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  TrendingUp,
  DollarSign,
  Calculator,
  PieChart,
  BarChart3,
  Calendar,
  Sliders,
  Play,
  Target,
  User,
  UserCheck,
  Building,
  Minus
} from 'lucide-react';
import { format, startOfYear, endOfYear, eachMonthOfInterval, addMonths } from 'date-fns';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const FinancialForecastComponent: React.FC = () => {
  const { userProfile } = usePermissions();
  const [forecasts, setForecasts] = useState<FinancialForecast[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingForecast, setEditingForecast] = useState<FinancialForecast | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  // Slider states for dynamic forecasting
  const [weeklyRevenue, setWeeklyRevenue] = useState<number>(6000);
  const [adrianWage, setAdrianWage] = useState<number>(1500);
  const [bartWage, setBartWage] = useState<number>(1200);
  const [otherExpenses, setOtherExpenses] = useState<Array<{id: string, name: string, amount: number}>>([
    { id: '1', name: 'Office Rent', amount: 300 },
    { id: '2', name: 'Software Subscriptions', amount: 150 },
    { id: '3', name: 'Marketing', amount: 200 }
  ]);
  const [showSliders, setShowSliders] = useState<boolean>(false);
  const [sliderMode, setSliderMode] = useState<'forecast' | 'scenario'>('forecast');

  const [formData, setFormData] = useState<Partial<FinancialForecast>>({
    month: format(new Date(), 'yyyy-MM'),
    year: new Date().getFullYear(),
    monthName: format(new Date(), 'MMMM'),
    expectedSales: 0,
    expectedExpenses: 0,
    actualSales: 0,
    actualExpenses: 0,
    notes: '',
  });

  useEffect(() => {
    if (userProfile) {
      fetchForecasts();
    }
  }, [userProfile, selectedYear]);

  const fetchForecasts = async () => {
    if (!userProfile) return;

    try {
      const forecastsQuery = query(
        collection(db, 'financial_forecasts'),
        where('userId', '==', userProfile.id),
        where('year', '==', selectedYear),
        orderBy('month', 'asc')
      );

      const forecastsSnapshot = await getDocs(forecastsQuery);
      const forecastsData: FinancialForecast[] = [];
      
      forecastsSnapshot.forEach((doc) => {
        forecastsData.push({ id: doc.id, ...doc.data() } as FinancialForecast);
      });

      setForecasts(forecastsData);
    } catch (error) {
      console.error('Error fetching forecasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (forecast?: FinancialForecast) => {
    if (forecast) {
      setEditingForecast(forecast);
      setFormData(forecast);
    } else {
      setEditingForecast(null);
      const currentDate = new Date();
      setFormData({
        month: format(currentDate, 'yyyy-MM'),
        year: selectedYear,
        monthName: format(currentDate, 'MMMM'),
        expectedSales: 0,
        expectedExpenses: 0,
        actualSales: 0,
        actualExpenses: 0,
        notes: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingForecast(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) return;

    try {
      const forecastData = {
        ...formData,
        userId: userProfile.id,
        monthName: format(new Date(formData.month + '-01'), 'MMMM'),
        year: parseInt(formData.month!.split('-')[0]),
        expectedSales: Number(formData.expectedSales),
        expectedExpenses: Number(formData.expectedExpenses),
        actualSales: formData.actualSales ? Number(formData.actualSales) : undefined,
        actualExpenses: formData.actualExpenses ? Number(formData.actualExpenses) : undefined,
      };

      if (editingForecast) {
        await updateDoc(doc(db, 'financial_forecasts', editingForecast.id!), {
          ...forecastData,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'financial_forecasts'), {
          ...forecastData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      await fetchForecasts();
      closeModal();
    } catch (error) {
      console.error('Error saving forecast:', error);
    }
  };

  const deleteForecast = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this forecast?')) {
      try {
        await deleteDoc(doc(db, 'financial_forecasts', id));
        await fetchForecasts();
      } catch (error) {
        console.error('Error deleting forecast:', error);
      }
    }
  };

  // Calculate total weekly expenses
  const getTotalWeeklyExpenses = () => {
    const otherExpensesTotal = otherExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    return adrianWage + bartWage + otherExpensesTotal;
  };

  // Add new other expense
  const addOtherExpense = () => {
    const newExpense = {
      id: Date.now().toString(),
      name: 'New Expense',
      amount: 100
    };
    setOtherExpenses([...otherExpenses, newExpense]);
  };

  // Remove other expense
  const removeOtherExpense = (id: string) => {
    setOtherExpenses(otherExpenses.filter(expense => expense.id !== id));
  };

  // Update other expense
  const updateOtherExpense = (id: string, field: 'name' | 'amount', value: string | number) => {
    setOtherExpenses(otherExpenses.map(expense => 
      expense.id === id 
        ? { ...expense, [field]: field === 'amount' ? Number(value) : value }
        : expense
    ));
  };

  // Calculate monthly amounts from weekly sliders
  const calculateMonthlyFromWeekly = (weeklyAmount: number, month: Date) => {
    // Get number of weeks in the month (approximately)
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const weeksInMonth = daysInMonth / 7;
    return Math.round(weeklyAmount * weeksInMonth);
  };

  // Generate forecast data from sliders
  const generateForecastFromSliders = () => {
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(selectedYear, 0, 1)),
      end: endOfYear(new Date(selectedYear, 0, 1))
    });

    return months.map(month => {
      const monthKey = format(month, 'yyyy-MM');
      const monthlySales = calculateMonthlyFromWeekly(weeklyRevenue, month);
      const totalWeeklyExpenses = getTotalWeeklyExpenses();
      const monthlyExpenses = calculateMonthlyFromWeekly(totalWeeklyExpenses, month);
      
      return {
        month: monthKey,
        monthName: format(month, 'MMM'),
        expectedSales: monthlySales,
        expectedExpenses: monthlyExpenses,
        actualSales: 0,
        actualExpenses: 0,
        savings: monthlySales - monthlyExpenses,
        actualSavings: 0,
      };
    });
  };

  // Apply slider forecast to actual data
  const applySliderForecast = async () => {
    if (!userProfile) return;

    try {
      const sliderData = generateForecastFromSliders();
      
      // Create or update forecasts for each month
      const updatePromises = sliderData.map(async (monthData) => {
        const existingForecast = forecasts.find(f => f.month === monthData.month);
        
        const forecastData = {
          userId: userProfile.id,
          month: monthData.month,
          year: selectedYear,
          monthName: monthData.monthName,
          expectedSales: monthData.expectedSales,
          expectedExpenses: monthData.expectedExpenses,
          notes: `Generated from weekly forecast: $${weeklyRevenue}/week revenue, Adrian: $${adrianWage}/week, Bart: $${bartWage}/week, Other: $${otherExpenses.reduce((sum, exp) => sum + exp.amount, 0)}/week`,
        };

        if (existingForecast) {
          await updateDoc(doc(db, 'financial_forecasts', existingForecast.id!), {
            ...forecastData,
            updatedAt: Timestamp.now(),
          });
        } else {
          await addDoc(collection(db, 'financial_forecasts'), {
            ...forecastData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
      });

      await Promise.all(updatePromises);
      await fetchForecasts();
      setShowSliders(false);
    } catch (error) {
      console.error('Error applying slider forecast:', error);
    }
  };

  // Generate complete year data (fill missing months with zeros)
  const getCompleteYearData = () => {
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(selectedYear, 0, 1)),
      end: endOfYear(new Date(selectedYear, 0, 1))
    });

    return months.map(month => {
      const monthKey = format(month, 'yyyy-MM');
      const existingForecast = forecasts.find(f => f.month === monthKey);
      
      return {
        month: monthKey,
        monthName: format(month, 'MMM'),
        expectedSales: existingForecast?.expectedSales || 0,
        expectedExpenses: existingForecast?.expectedExpenses || 0,
        actualSales: existingForecast?.actualSales || 0,
        actualExpenses: existingForecast?.actualExpenses || 0,
        savings: (existingForecast?.expectedSales || 0) - (existingForecast?.expectedExpenses || 0),
        actualSavings: (existingForecast?.actualSales || 0) - (existingForecast?.actualExpenses || 0),
      };
    });
  };

  // Choose data source based on slider mode
  const yearData = sliderMode === 'scenario' ? generateForecastFromSliders() : getCompleteYearData();

  // Chart data
  const savingsOverTimeData = {
    labels: yearData.map(d => d.monthName),
    datasets: [
      {
        label: 'Expected Savings',
        data: yearData.map(d => d.savings),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      },
      {
        label: 'Actual Savings',
        data: yearData.map(d => d.actualSavings),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const salesVsExpensesData = {
    labels: yearData.map(d => d.monthName),
    datasets: [
      {
        label: 'Expected Sales',
        data: yearData.map(d => d.expectedSales),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Expected Expenses',
        data: yearData.map(d => d.expectedExpenses),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
    ],
  };

  const totalExpectedSales = yearData.reduce((sum, d) => sum + d.expectedSales, 0);
  const totalExpectedExpenses = yearData.reduce((sum, d) => sum + d.expectedExpenses, 0);
  const totalExpectedSavings = totalExpectedSales - totalExpectedExpenses;

  const yearSummaryData = {
    labels: ['Expected Sales', 'Expected Expenses', 'Expected Savings'],
    datasets: [
      {
        data: [totalExpectedSales, totalExpectedExpenses, totalExpectedSavings],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(239, 68, 68)',
          'rgb(59, 130, 246)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { 
      style: 'currency', 
      currency: 'CAD'
    }).format(amount);
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return context.label + ': ' + formatCurrency(context.parsed);
          }
        }
      }
    },
  };

  if (loading) {
    return <div className="loading">Loading financial forecasts...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <TrendingUp size={24} />
            <div>
              <h1>Financial Forecast</h1>
              <p>Plan and track your monthly sales and expenses</p>
            </div>
          </div>
          <div className="header-actions">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="year-selector"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
            <button 
              className={`btn-secondary ${showSliders ? 'active' : ''}`}
              onClick={() => setShowSliders(!showSliders)}
            >
              <Sliders size={18} />
              Forecast Calculator
            </button>
            <button className="btn-primary" onClick={() => openModal()}>
              <Plus size={18} />
              Add Forecast
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Interactive Forecast Calculator */}
        {showSliders && (
          <div className="card slider-panel">
            <div className="slider-header">
              <div className="slider-title">
                <Target size={24} />
                <div>
                  <h2>Weekly Forecast Calculator</h2>
                  <p>Adjust weekly amounts to see monthly projections</p>
                </div>
              </div>
              <div className="slider-mode-toggle">
                <button
                  className={`mode-btn ${sliderMode === 'scenario' ? 'active' : ''}`}
                  onClick={() => setSliderMode('scenario')}
                >
                  <PieChart size={16} />
                  Scenario View
                </button>
                <button
                  className={`mode-btn ${sliderMode === 'forecast' ? 'active' : ''}`}
                  onClick={() => setSliderMode('forecast')}
                >
                  <BarChart3 size={16} />
                  Current Data
                </button>
              </div>
            </div>

            <div className="sliders-container">
              {/* Revenue Slider */}
              <div className="slider-section">
                <h3 className="section-title">
                  <DollarSign className="revenue-icon" />
                  Weekly Revenue
                </h3>
                <div className="slider-group">
                  <div className="slider-info">
                    <div className="slider-value">
                      {formatCurrency(weeklyRevenue)}/week
                    </div>
                    <div className="monthly-projection">
                      ≈ {formatCurrency(calculateMonthlyFromWeekly(weeklyRevenue, new Date()))}/month
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20000"
                    step="100"
                    value={weeklyRevenue}
                    onChange={(e) => setWeeklyRevenue(parseInt(e.target.value))}
                    className="slider revenue-slider"
                  />
                  <div className="slider-range">
                    <span>$0</span>
                    <span>$20,000</span>
                  </div>
                </div>
              </div>

              {/* Expense Sliders */}
              <div className="slider-section">
                <h3 className="section-title">
                  <Calculator className="expense-icon" />
                  Weekly Expenses
                </h3>

                {/* Adrian Wage */}
                <div className="slider-group wage-slider">
                  <div className="slider-info">
                    <div className="slider-label">
                      <User size={16} className="wage-icon" />
                      <span>Adrian (Wage)</span>
                    </div>
                    <div className="slider-value">
                      {formatCurrency(adrianWage)}/week
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    value={adrianWage}
                    onChange={(e) => setAdrianWage(parseInt(e.target.value))}
                    className="slider wage-slider-input"
                  />
                  <div className="slider-range">
                    <span>$0</span>
                    <span>$5,000</span>
                  </div>
                </div>

                {/* Bart Wage */}
                <div className="slider-group wage-slider">
                  <div className="slider-info">
                    <div className="slider-label">
                      <UserCheck size={16} className="wage-icon" />
                      <span>Bart (Wage)</span>
                    </div>
                    <div className="slider-value">
                      {formatCurrency(bartWage)}/week
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    value={bartWage}
                    onChange={(e) => setBartWage(parseInt(e.target.value))}
                    className="slider wage-slider-input"
                  />
                  <div className="slider-range">
                    <span>$0</span>
                    <span>$5,000</span>
                  </div>
                </div>

                {/* Other Expenses */}
                <div className="other-expenses-section">
                  <div className="other-expenses-header">
                    <h4>Other Expenses</h4>
                    <button 
                      className="btn-icon add-expense-btn"
                      onClick={addOtherExpense}
                      title="Add Expense"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {otherExpenses.map((expense) => (
                    <div key={expense.id} className="expense-item">
                      <div className="expense-info">
                        <input
                          type="text"
                          value={expense.name}
                          onChange={(e) => updateOtherExpense(expense.id, 'name', e.target.value)}
                          className="expense-name-input"
                          placeholder="Expense name..."
                        />
                        <div className="expense-amount">
                          {formatCurrency(expense.amount)}/week
                        </div>
                      </div>
                      <div className="expense-controls">
                        <input
                          type="range"
                          min="0"
                          max="2000"
                          step="25"
                          value={expense.amount}
                          onChange={(e) => updateOtherExpense(expense.id, 'amount', parseInt(e.target.value))}
                          className="slider other-expense-slider"
                        />
                        <button
                          className="btn-icon delete remove-expense-btn"
                          onClick={() => removeOtherExpense(expense.id)}
                          title="Remove Expense"
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                      <div className="slider-range">
                        <span>$0</span>
                        <span>$2,000</span>
                      </div>
                    </div>
                  ))}

                  <div className="total-expenses">
                    <strong>Total Weekly Expenses: {formatCurrency(getTotalWeeklyExpenses())}</strong>
                  </div>
                </div>
              </div>

              <div className="forecast-summary-live">
                <div className="live-summary">
                  <div className="summary-item">
                    <span className="label">Weekly Net:</span>
                    <span className={`value ${weeklyRevenue - getTotalWeeklyExpenses() >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(weeklyRevenue - getTotalWeeklyExpenses())}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Monthly Net:</span>
                    <span className={`value ${calculateMonthlyFromWeekly(weeklyRevenue - getTotalWeeklyExpenses(), new Date()) >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(calculateMonthlyFromWeekly(weeklyRevenue - getTotalWeeklyExpenses(), new Date()))}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Yearly Net:</span>
                    <span className={`value ${(weeklyRevenue - getTotalWeeklyExpenses()) * 52 >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency((weeklyRevenue - getTotalWeeklyExpenses()) * 52)}
                    </span>
                  </div>
                  
                  <div className="expense-breakdown">
                    <h5>Expense Breakdown (Weekly):</h5>
                    <div className="breakdown-item">
                      <span>Adrian:</span>
                      <span>{formatCurrency(adrianWage)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span>Bart:</span>
                      <span>{formatCurrency(bartWage)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span>Other:</span>
                      <span>{formatCurrency(otherExpenses.reduce((sum, exp) => sum + exp.amount, 0))}</span>
                    </div>
                    <div className="breakdown-total">
                      <span><strong>Total:</strong></span>
                      <span><strong>{formatCurrency(getTotalWeeklyExpenses())}</strong></span>
                    </div>
                  </div>
                </div>
                
                <div className="slider-actions">
                  {sliderMode === 'forecast' && (
                    <button className="btn-primary" onClick={applySliderForecast}>
                      <Play size={16} />
                      Apply to {selectedYear} Forecast
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="summary-card positive">
            <div className="summary-icon">
              <DollarSign size={24} />
            </div>
            <div className="summary-content">
              <h3>Expected Sales ({selectedYear})</h3>
              <p className="summary-amount">{formatCurrency(totalExpectedSales)}</p>
            </div>
          </div>

          <div className="summary-card negative">
            <div className="summary-icon">
              <Calculator size={24} />
            </div>
            <div className="summary-content">
              <h3>Expected Expenses ({selectedYear})</h3>
              <p className="summary-amount">{formatCurrency(totalExpectedExpenses)}</p>
            </div>
          </div>

          <div className={`summary-card ${totalExpectedSavings >= 0 ? 'positive' : 'negative'}`}>
            <div className="summary-icon">
              <TrendingUp size={24} />
            </div>
            <div className="summary-content">
              <h3>Expected Savings ({selectedYear})</h3>
              <p className="summary-amount">{formatCurrency(totalExpectedSavings)}</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="charts-grid">
          <div className="card chart-card">
            <h2>Savings Over Time</h2>
            <Line data={savingsOverTimeData} options={chartOptions} />
          </div>

          <div className="card chart-card">
            <h2>Sales vs Expenses</h2>
            <Bar data={salesVsExpensesData} options={chartOptions} />
          </div>

          <div className="card chart-card">
            <h2>Year Summary</h2>
            <div className="chart-container-small">
              <Doughnut data={yearSummaryData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        {/* Forecasts Table */}
        <div className="card">
          <h2>Monthly Forecasts for {selectedYear}</h2>
          <div className="table-responsive">
            <table className="forecasts-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Expected Sales</th>
                  <th>Expected Expenses</th>
                  <th>Expected Savings</th>
                  <th>Actual Sales</th>
                  <th>Actual Expenses</th>
                  <th>Actual Savings</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {yearData.map((data) => {
                  const existingForecast = forecasts.find(f => f.month === data.month);
                  return (
                    <tr key={data.month}>
                      <td>{data.monthName} {selectedYear}</td>
                      <td className="amount positive">{formatCurrency(data.expectedSales)}</td>
                      <td className="amount negative">{formatCurrency(data.expectedExpenses)}</td>
                      <td className={`amount ${data.savings >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(data.savings)}
                      </td>
                      <td className="amount positive">{formatCurrency(data.actualSales)}</td>
                      <td className="amount negative">{formatCurrency(data.actualExpenses)}</td>
                      <td className={`amount ${data.actualSavings >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(data.actualSavings)}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn-icon"
                            onClick={() => openModal(existingForecast)}
                            title={existingForecast ? 'Edit' : 'Add'}
                          >
                            {existingForecast ? <Edit2 size={16} /> : <Plus size={16} />}
                          </button>
                          {existingForecast && (
                            <button
                              className="btn-icon delete"
                              onClick={() => deleteForecast(existingForecast.id!)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                <Calendar size={20} />
                {editingForecast ? 'Edit' : 'Add'} Financial Forecast
              </h2>
              <button onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="forecast-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Month</label>
                  <input
                    type="month"
                    value={formData.month}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      month: e.target.value,
                      year: parseInt(e.target.value.split('-')[0])
                    })}
                    required
                  />
                </div>

                <div className="form-group span-2">
                  <label>Notes (Optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    placeholder="Any additional notes about this month's forecast..."
                  />
                </div>

                <div className="form-group">
                  <label>Expected Sales</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.expectedSales}
                    onChange={(e) => setFormData({ ...formData, expectedSales: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Expected Expenses</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.expectedExpenses}
                    onChange={(e) => setFormData({ ...formData, expectedExpenses: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Actual Sales (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.actualSales || ''}
                    onChange={(e) => setFormData({ ...formData, actualSales: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label>Actual Expenses (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.actualExpenses || ''}
                    onChange={(e) => setFormData({ ...formData, actualExpenses: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="forecast-summary">
                <div className="summary-row">
                  <span>Expected Savings:</span>
                  <span className={`amount ${(formData.expectedSales || 0) - (formData.expectedExpenses || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency((formData.expectedSales || 0) - (formData.expectedExpenses || 0))}
                  </span>
                </div>
                {(formData.actualSales || formData.actualExpenses) && (
                  <div className="summary-row">
                    <span>Actual Savings:</span>
                    <span className={`amount ${(formData.actualSales || 0) - (formData.actualExpenses || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency((formData.actualSales || 0) - (formData.actualExpenses || 0))}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingForecast ? 'Update' : 'Add'} Forecast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialForecastComponent;