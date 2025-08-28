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
  where,
  Timestamp 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { usePermissions } from '../hooks/usePermissions';
import { UserProfile, UserRole } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Users,
  Shield,
  Mail,
  UserCheck,
  User,
  Crown,
  Key,
  AlertTriangle,
  MoreVertical,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';

const UserManagement: React.FC = () => {
  const { userProfile, isAdmin } = usePermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<UserProfile & { password?: string }>>({
    name: '',
    email: '',
    role: 'user',
    password: '',
  });

  // Redirect if not admin
  useEffect(() => {
    if (userProfile && !isAdmin) {
      // Could redirect to unauthorized page or show error
      console.warn('Access denied: Admin role required');
    }
  }, [userProfile, isAdmin]);

  useEffect(() => {
    if (userProfile && isAdmin) {
      fetchUsers();
    }
  }, [userProfile, isAdmin]);

  const fetchUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      );

      const usersSnapshot = await getDocs(usersQuery);
      const usersData: UserProfile[] = [];
      
      usersSnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserProfile);
      });

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'user',
        password: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'user',
      password: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      alert('Access denied: Admin role required');
      return;
    }

    try {
      if (editingUser) {
        // Update existing user
        await updateDoc(doc(db, 'users', editingUser.id), {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          updatedAt: new Date(),
        });
      } else {
        // Create new user
        if (!formData.password || formData.password.length < 6) {
          alert('Password must be at least 6 characters long');
          return;
        }

        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email!,
          formData.password
        );

        // Create user profile in Firestore
        await addDoc(collection(db, 'users'), {
          id: userCredential.user.uid,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Send password reset email so user can set their own password
        await sendPasswordResetEmail(auth, formData.email!);
      }

      await fetchUsers();
      closeModal();
    } catch (error: any) {
      console.error('Error saving user:', error);
      let errorMessage = 'Failed to save user';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      
      alert(errorMessage);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!isAdmin) {
      alert('Access denied: Admin role required');
      return;
    }

    // Prevent admin from deleting themselves
    if (userId === userProfile?.id) {
      alert('You cannot delete your own account');
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      await fetchUsers();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset:', error);
      alert('Failed to send password reset email');
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Crown size={16} className="role-icon admin" />;
      case 'coordinator':
        return <Shield size={16} className="role-icon coordinator" />;
      default:
        return <User size={16} className="role-icon user" />;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'admin-role';
      case 'coordinator':
        return 'coordinator-role';
      default:
        return 'user-role';
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Full access to all features and user management';
      case 'coordinator':
        return 'Can view all tasks and events, coordinate team activities';
      default:
        return 'Standard access to personal tasks and events';
    }
  };

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="unauthorized-access">
          <AlertTriangle size={48} />
          <h2>Access Denied</h2>
          <p>You need administrator privileges to access user management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <Users size={24} />
            <div>
              <h1>User Management</h1>
              <p>Manage team members and their access levels</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => openModal()}>
              <Plus size={18} />
              Add User
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Users Overview */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon">
              <Users size={24} />
            </div>
            <div className="summary-content">
              <h3>Total Users</h3>
              <p className="summary-amount">{users.length}</p>
            </div>
          </div>

          <div className="summary-card admin-card">
            <div className="summary-icon">
              <Crown size={24} />
            </div>
            <div className="summary-content">
              <h3>Administrators</h3>
              <p className="summary-amount">{users.filter(u => u.role === 'admin').length}</p>
            </div>
          </div>

          <div className="summary-card coordinator-card">
            <div className="summary-icon">
              <Shield size={24} />
            </div>
            <div className="summary-content">
              <h3>Coordinators</h3>
              <p className="summary-amount">{users.filter(u => u.role === 'coordinator').length}</p>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="card">
          <h2>Team Members</h2>
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={user.id === userProfile?.id ? 'current-user' : ''}>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name">
                            {user.name}
                            {user.id === userProfile?.id && (
                              <span className="current-user-badge">(You)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="user-email">
                        <Mail size={14} />
                        {user.email}
                      </div>
                    </td>
                    <td>
                      <div className={`role-badge ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        <span>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                      </div>
                    </td>
                    <td className="created-date">
                      {user.createdAt ? (() => {
                        try {
                          const date = user.createdAt instanceof Date 
                            ? user.createdAt 
                            : (user.createdAt as any)?.toDate 
                              ? (user.createdAt as any).toDate() 
                              : new Date(user.createdAt as any);
                          return format(date, 'MMM dd, yyyy');
                        } catch (error) {
                          return 'N/A';
                        }
                      })() : 'N/A'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn-icon"
                          onClick={() => openModal(user)}
                          title="Edit User"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => sendPasswordReset(user.email)}
                          title="Send Password Reset"
                        >
                          <Key size={16} />
                        </button>
                        {user.id !== userProfile?.id && (
                          <button
                            className="btn-icon delete"
                            onClick={() => setShowDeleteConfirm(user.id)}
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="empty-state">
              <Users size={48} />
              <h3>No users found</h3>
              <p>Start by adding your first team member</p>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                <UserCheck size={20} />
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Enter full name..."
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={editingUser !== null}
                    placeholder="Enter email address..."
                  />
                  {editingUser && (
                    <small>Email cannot be changed after user creation</small>
                  )}
                </div>

                <div className="form-group span-2">
                  <label>User Role *</label>
                  <div className="role-selector">
                    <div className="role-options">
                      <label className={`role-option ${formData.role === 'user' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="role"
                          value="user"
                          checked={formData.role === 'user'}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                        />
                        <div className="role-content">
                          <div className="role-header">
                            <User size={20} />
                            <span>User</span>
                          </div>
                          <p>{getRoleDescription('user')}</p>
                        </div>
                      </label>

                      <label className={`role-option ${formData.role === 'coordinator' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="role"
                          value="coordinator"
                          checked={formData.role === 'coordinator'}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                        />
                        <div className="role-content">
                          <div className="role-header">
                            <Shield size={20} />
                            <span>Coordinator</span>
                          </div>
                          <p>{getRoleDescription('coordinator')}</p>
                        </div>
                      </label>

                      <label className={`role-option ${formData.role === 'admin' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="role"
                          value="admin"
                          checked={formData.role === 'admin'}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                        />
                        <div className="role-content">
                          <div className="role-header">
                            <Crown size={20} />
                            <span>Administrator</span>
                          </div>
                          <p>{getRoleDescription('admin')}</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {!editingUser && (
                  <div className="form-group span-2">
                    <label>Temporary Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Enter temporary password (min 6 characters)..."
                    />
                    <small>A password reset email will be sent automatically so the user can set their own password.</small>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content small">
            <div className="modal-header">
              <h2>
                <AlertTriangle size={20} />
                Confirm Deletion
              </h2>
              <button onClick={() => setShowDeleteConfirm(null)}>
                <X size={24} />
              </button>
            </div>

            <div className="delete-confirmation">
              <p>Are you sure you want to delete this user? This action cannot be undone.</p>
              <p><strong>User:</strong> {users.find(u => u.id === showDeleteConfirm)?.name}</p>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowDeleteConfirm(null)} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={() => deleteUser(showDeleteConfirm)} 
                  className="btn-danger"
                >
                  <Trash2 size={16} />
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;