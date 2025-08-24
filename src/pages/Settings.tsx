import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updatePassword, updateEmail } from 'firebase/auth';
import { 
  User, 
  Mail, 
  Lock, 
  Bell, 
  Shield, 
  Save,
  Folder,
  Plus,
  Edit2,
  Trash2,
  X,
  Briefcase,
  Home,
  Rocket,
  Lightbulb,
  FileText,
  Heart,
  Star,
  Target,
  Coffee,
  Book,
  Music,
  Camera,
  Phone,
  Settings as SettingsIcon,
  Users,
  Code,
  Palette,
  Zap,
  Calendar as CalendarIcon,
  CheckSquare,
  Flag
} from 'lucide-react';
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
import EmailSettings from '../components/EmailSettings';

interface Category {
  id?: string;
  name: string;
  color: string;
  icon: string;
  order: number;
}

const iconOptions = [
  { name: 'Briefcase', component: Briefcase },
  { name: 'Home', component: Home },
  { name: 'Rocket', component: Rocket },
  { name: 'Lightbulb', component: Lightbulb },
  { name: 'FileText', component: FileText },
  { name: 'Heart', component: Heart },
  { name: 'Star', component: Star },
  { name: 'Target', component: Target },
  { name: 'Coffee', component: Coffee },
  { name: 'Book', component: Book },
  { name: 'Music', component: Music },
  { name: 'Camera', component: Camera },
  { name: 'Phone', component: Phone },
  { name: 'Mail', component: Mail },
  { name: 'Settings', component: SettingsIcon },
  { name: 'Users', component: Users },
  { name: 'Code', component: Code },
  { name: 'Palette', component: Palette },
  { name: 'Zap', component: Zap },
  { name: 'Folder', component: Folder },
  { name: 'CheckSquare', component: CheckSquare },
  { name: 'Flag', component: Flag },
  { name: 'Calendar', component: CalendarIcon }
];

const getIconComponent = (iconName: string) => {
  const iconOption = iconOptions.find(option => option.name === iconName);
  return iconOption ? iconOption.component : FileText;
};

const colorOptions = [
  '#3b82f6', '#10b981', '#ef4444', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [profileData, setProfileData] = useState({
    email: currentUser?.email || '',
    displayName: currentUser?.displayName || '',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    newCustomerAlerts: true,
    paymentReminders: true,
    monthlyReports: true,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<Partial<Category>>({
    name: '',
    color: '#3b82f6',
    icon: 'FileText',
    order: 0
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const categoriesSnapshot = await getDocs(
        query(collection(db, 'task_categories'), orderBy('order', 'asc'))
      );
      const categoriesData: Category[] = [];
      categoriesSnapshot.forEach((doc) => {
        categoriesData.push({ id: doc.id, ...doc.data() } as Category);
      });
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (currentUser && profileData.email !== currentUser.email) {
        await updateEmail(currentUser, profileData.email);
      }
      setMessage('Profile updated successfully!');
    } catch (err: any) {
      setError('Failed to update profile. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (currentUser) {
        await updatePassword(currentUser, passwordData.newPassword);
        setMessage('Password updated successfully!');
        setPasswordData({ newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      setError('Failed to update password. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Notification settings updated successfully!');
  };

  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData(category);
    } else {
      setEditingCategory(null);
      setCategoryFormData({
        name: '',
        color: '#3b82f6',
        icon: 'FileText',
        order: categories.length
      });
    }
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const categoryData = {
        ...categoryFormData,
        updatedAt: Timestamp.now()
      };

      if (editingCategory) {
        await updateDoc(doc(db, 'task_categories', editingCategory.id!), categoryData);
        setMessage('Category updated successfully!');
      } else {
        await addDoc(collection(db, 'task_categories'), {
          ...categoryData,
          createdAt: Timestamp.now()
        });
        setMessage('Category created successfully!');
      }

      await fetchCategories();
      closeCategoryModal();
    } catch (error) {
      console.error('Error saving category:', error);
      setError('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      setLoading(true);
      setError('');
      setMessage('');
      
      try {
        await deleteDoc(doc(db, 'task_categories', categoryId));
        setMessage('Category deleted successfully!');
        await fetchCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
        setError('Failed to delete category');
      } finally {
        setLoading(false);
      }
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: <User size={20} /> },
    { id: 'security', name: 'Security', icon: <Shield size={20} /> },
    { id: 'notifications', name: 'Notifications', icon: <Bell size={20} /> },
    { id: 'categories', name: 'Task Categories', icon: <Folder size={20} /> },
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account and application preferences</p>
      </div>

      <div className="settings-container">
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          {activeTab === 'profile' && (
            <div className="tab-content">
              <h2>Profile Information</h2>
              <form onSubmit={handleProfileUpdate}>
                <div className="form-group">
                  <label>
                    <Mail size={18} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    <User size={18} />
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    placeholder="Your display name"
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="tab-content">
              <h2>Security Settings</h2>
              <form onSubmit={handlePasswordUpdate}>
                <div className="form-group">
                  <label>
                    <Lock size={18} />
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <Lock size={18} />
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="tab-content">
              <h2>Notification Preferences</h2>
              
              <EmailSettings />
              
              <form onSubmit={handleNotificationUpdate}>
                <div className="notification-settings">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: e.target.checked
                      })}
                    />
                    <div>
                      <strong>Email Notifications</strong>
                      <p>Receive important updates via email</p>
                    </div>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.newCustomerAlerts}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        newCustomerAlerts: e.target.checked
                      })}
                    />
                    <div>
                      <strong>New Customer Alerts</strong>
                      <p>Get notified when new customers are added</p>
                    </div>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.paymentReminders}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        paymentReminders: e.target.checked
                      })}
                    />
                    <div>
                      <strong>Payment Reminders</strong>
                      <p>Receive reminders for upcoming payments</p>
                    </div>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.monthlyReports}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        monthlyReports: e.target.checked
                      })}
                    />
                    <div>
                      <strong>Monthly Reports</strong>
                      <p>Get monthly summary reports</p>
                    </div>
                  </label>
                </div>
                <button type="submit" className="btn-primary">
                  <Save size={18} />
                  Save Preferences
                </button>
              </form>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="tab-content">
              <div className="categories-header">
                <h2>Task Categories</h2>
                <button className="btn-primary" onClick={() => openCategoryModal()}>
                  <Plus size={18} />
                  Add Category
                </button>
              </div>
              
              <div className="categories-list">
                {categories.map(category => (
                  <div key={category.id} className="category-item">
                    <div className="category-info">
                      <div className="category-visual">
                        <span className="category-icon" style={{ color: category.color }}>
                          {React.createElement(getIconComponent(category.icon), { size: 24 })}
                        </span>
                        <div>
                          <strong>{category.name}</strong>
                          <p>Order: {category.order}</p>
                        </div>
                      </div>
                      <div 
                        className="category-color-preview" 
                        style={{ backgroundColor: category.color }}
                      ></div>
                    </div>
                    <div className="category-actions">
                      <button 
                        className="btn-secondary"
                        onClick={() => openCategoryModal(category)}
                      >
                        <Edit2 size={16} />
                        Edit
                      </button>
                      <button 
                        className="btn-danger"
                        onClick={() => deleteCategory(category.id!)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                
                {categories.length === 0 && (
                  <div className="empty-state">
                    <Folder size={48} />
                    <h3>No categories found</h3>
                    <p>Create your first task category to get organized</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Create New Category'}</h2>
              <button onClick={closeCategoryModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={saveCategory} className="category-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={categoryFormData.name || ''}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Icon</label>
                <div className="icon-picker">
                  {iconOptions.map(iconOption => (
                    <button
                      key={iconOption.name}
                      type="button"
                      className={`icon-option ${categoryFormData.icon === iconOption.name ? 'selected' : ''}`}
                      onClick={() => setCategoryFormData({ ...categoryFormData, icon: iconOption.name })}
                      title={iconOption.name}
                    >
                      {React.createElement(iconOption.component, { size: 18 })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${categoryFormData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setCategoryFormData({ ...categoryFormData, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeCategoryModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;