import React, { useState, useEffect, useCallback } from 'react';
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
import { UserProfile } from '../types';
import { migrateTasks } from '../utils/migrateTasks';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  CheckSquare,
  Square,
  Flag,
  Folder,
  Calendar as CalendarIcon,
  Filter,
  Circle,
  Tag,
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
  Mail,
  Settings,
  Users,
  Code,
  Palette,
  Zap,
  GripVertical
} from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id?: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed';
  color: string;
  dueDate?: string;
  tags: string[];
  order: number;
  daySection?: 'today' | 'tomorrow' | 'dayAfter' | null;
  isActive?: boolean;
  userId: string; // Owner of the task
  userName?: string; // For display purposes
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

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
  { name: 'Settings', component: Settings },
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

const defaultCategories: Omit<Category, 'id'>[] = [
  { name: 'Work', color: '#3b82f6', icon: 'Briefcase', order: 0 },
  { name: 'Personal', color: '#10b981', icon: 'Home', order: 1 },
  { name: 'Projects', color: '#8b5cf6', icon: 'Rocket', order: 2 },
  { name: 'Ideas', color: '#f59e0b', icon: 'Lightbulb', order: 3 }
];

const priorityColors = {
  low: '#6b7280',
  medium: '#f59e0b', 
  high: '#ef4444',
  urgent: '#dc2626'
};

const statusColors = {
  todo: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#10b981'
};

const colorOptions = [
  '#3b82f6', '#10b981', '#ef4444', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

const Tasks: React.FC = () => {
  const { userProfile, isCoordinator, isAdmin, canViewAllUsers, canEditUserTasks } = usePermissions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', status: '', priority: '', user: '' });
  const [selectedUserId, setSelectedUserId] = useState<string>(''); // For admin filtering
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'created' | 'order'>('order');
  const [showFilters, setShowFilters] = useState(false);
  
  // Drag and drop state - simplified
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverTask, setDragOverTask] = useState<string | null>(null);

  const [taskFormData, setTaskFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    status: 'todo',
    color: '#3b82f6',
    dueDate: '',
    tags: [],
    order: 0,
    daySection: null,
    isActive: false
  });


  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (userProfile) {
      initializeData();
    }
  }, [userProfile, canViewAllUsers]);

  const initializeData = async () => {
    if (!userProfile) return;
    
    try {
      // Check if categories exist, if not create defaults
      const categoriesSnapshot = await getDocs(collection(db, 'task_categories'));
      if (categoriesSnapshot.empty) {
        // Create default categories
        for (const category of defaultCategories) {
          await addDoc(collection(db, 'task_categories'), {
            ...category,
            createdAt: Timestamp.now()
          });
        }
      }

      // Run migration for legacy tasks
      try {
        await migrateTasks(userProfile.id);
      } catch (migrationError) {
        console.error('Migration warning:', migrationError);
        // Continue even if migration fails
      }
      
      const promises = [fetchTasks(), fetchCategories()];
      
      // Fetch users if user has permission to view all users
      if (canViewAllUsers) {
        promises.push(fetchUsers());
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (!userProfile) return;
    
    try {
      let tasksQuery;
      
      if (isCoordinator && !selectedUserId) {
        // Coordinators see all tasks by default
        tasksQuery = query(collection(db, 'tasks'), orderBy('order', 'asc'));
      } else if (isAdmin && selectedUserId) {
        // Admins can filter by specific user
        tasksQuery = query(
          collection(db, 'tasks'), 
          where('userId', '==', selectedUserId),
          orderBy('order', 'asc')
        );
      } else if (isAdmin && !selectedUserId) {
        // Admins see all tasks when no user is selected
        tasksQuery = query(collection(db, 'tasks'), orderBy('order', 'asc'));
      } else {
        // Regular users only see their own tasks
        tasksQuery = query(
          collection(db, 'tasks'), 
          where('userId', '==', userProfile.id),
          orderBy('order', 'asc')
        );
      }

      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData: Task[] = [];
      
      tasksSnapshot.forEach((doc) => {
        const taskData = { id: doc.id, ...doc.data() } as Task;
        // Add userName for display if we have user info
        if (taskData.userId && users.length > 0) {
          const user = users.find(u => u.id === taskData.userId);
          taskData.userName = user ? user.name : 'Unknown User';
        }
        tasksData.push(taskData);
      });
      
      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

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

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserProfile[] = [];
      usersSnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const openTaskModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskFormData(task);
    } else {
      setEditingTask(null);
      setTaskFormData({
        title: '',
        description: '',
        category: categories[0]?.name || '',
        priority: 'medium',
        status: 'todo',
        color: '#3b82f6',
        dueDate: '',
        tags: [],
        order: tasks.length,
        daySection: null,
        isActive: false,
        userId: userProfile?.id || ''
      });
    }
    setShowTaskModal(true);
  };

  const closeModals = () => {
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) return;
    
    try {
      const taskData = {
        ...taskFormData,
        userId: taskFormData.userId || userProfile.id, // Ensure userId is set
        updatedAt: Timestamp.now()
      };

      if (editingTask) {
        // Check if user can edit this task
        if (!canEditUserTasks(editingTask.userId)) {
          alert('You do not have permission to edit this task');
          return;
        }
        await updateDoc(doc(db, 'tasks', editingTask.id!), taskData);
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...taskData,
          createdAt: Timestamp.now()
        });
      }

      await fetchTasks();
      closeModals();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };


  const deleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
        await fetchTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 
                     task.status === 'todo' ? 'in_progress' : 'completed';
    
    try {
      await updateDoc(doc(db, 'tasks', task.id!), { 
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      await fetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const toggleTaskActive = async (task: Task) => {
    try {
      // Simply toggle the active state of this task
      await updateDoc(doc(db, 'tasks', task.id!), {
        isActive: !task.isActive,
        updatedAt: Timestamp.now()
      });
      await fetchTasks();
    } catch (error) {
      console.error('Error toggling task active state:', error);
    }
  };

  // Simple drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    console.log('Drag started:', task.title);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id || '');
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    console.log('Drag ended');
    setDraggedTask(null);
    setDragOverTask(null);
  };

  const handleDragOver = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    if (draggedTask && draggedTask.id !== targetTask.id) {
      setDragOverTask(targetTask.id!);
    }
  };

  const handleDragLeave = () => {
    setDragOverTask(null);
  };

  const handleDrop = async (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask.id === targetTask.id) {
      return;
    }

    console.log('Dropping', draggedTask.title, 'onto', targetTask.title);

    const filteredTasks = getFilteredAndSortedTasks();
    const draggedIndex = filteredTasks.findIndex(t => t.id === draggedTask.id);
    const targetIndex = filteredTasks.findIndex(t => t.id === targetTask.id);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Create new order
    const newTasks = [...filteredTasks];
    const [removed] = newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, removed);

    // Update orders
    const updates = newTasks.map((task, index) => ({
      ...task,
      order: index
    }));

    // Update local state
    const updatedAllTasks = tasks.map(task => {
      const updatedTask = updates.find(u => u.id === task.id);
      return updatedTask || task;
    });
    
    setTasks(updatedAllTasks);

    // Update Firebase
    try {
      const firebaseUpdates = updates.map((task, index) =>
        updateDoc(doc(db, 'tasks', task.id!), {
          order: index,
          updatedAt: Timestamp.now()
        })
      );
      
      await Promise.all(firebaseUpdates);
      console.log('Order updated in Firebase');
    } catch (error) {
      console.error('Error updating order:', error);
      // Revert on error
      fetchTasks();
    }
    
    // Clean up
    setDraggedTask(null);
    setDragOverTask(null);
  };

  const moveToDaySection = async (task: Task, daySection: 'today' | 'tomorrow' | 'dayAfter' | null) => {
    try {
      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, daySection } : t
      ));

      // Update Firebase
      await updateDoc(doc(db, 'tasks', task.id!), {
        daySection,
        updatedAt: Timestamp.now()
      });

      console.log(`Task moved to ${daySection || 'unscheduled'} section`);
    } catch (error) {
      console.error('Error moving task to day section:', error);
      // Revert on error
      fetchTasks();
    }

    setDraggedTask(null);
  };

  const addTag = () => {
    if (newTag.trim() && !taskFormData.tags?.includes(newTag.trim())) {
      setTaskFormData({
        ...taskFormData,
        tags: [...(taskFormData.tags || []), newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTaskFormData({
      ...taskFormData,
      tags: (taskFormData.tags || []).filter(tag => tag !== tagToRemove)
    });
  };

  const getFilteredAndSortedTasks = () => {
    let filteredTasks = tasks.filter(task => {
      if (filter.category && task.category !== filter.category) return false;
      if (filter.status && task.status !== filter.status) return false;
      if (filter.priority && task.priority !== filter.priority) return false;
      if (filter.user && task.userId !== filter.user) return false;
      return true;
    });

    filteredTasks.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'created':
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        default:
          return a.order - b.order;
      }
    });

    return filteredTasks;
  };

  const getCategoryByName = (name: string) => {
    return categories.find(cat => cat.name === name);
  };

  if (loading) {
    return <div className="loading">Loading tasks...</div>;
  }

  const filteredTasks = getFilteredAndSortedTasks();

  return (
    <div className="tasks-page">
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          {isCoordinator && <p>Coordinator View - Seeing all tasks</p>}
          {isAdmin && !selectedUserId && <p>Admin View - All users</p>}
          {isAdmin && selectedUserId && <p>Admin View - Filtered by user</p>}
        </div>
        <div className="header-actions">
          {isAdmin && (
            <select
              value={selectedUserId}
              onChange={async (e) => {
                setSelectedUserId(e.target.value);
                // Refetch tasks when admin changes user filter
                try {
                  await fetchTasks();
                } catch (error) {
                  console.error('Error refetching tasks:', error);
                }
              }}
              className="user-filter-select"
            >
              <option value="">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          )}
          <button 
            className="btn-secondary filter-toggle" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} />
          </button>
          <button className="btn-primary add-task-btn" onClick={() => openTaskModal()}>
            <Plus size={18} />
            Add Task
          </button>
        </div>
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="tasks-controls">
          <div className="filters">
            <select 
              value={filter.category} 
              onChange={(e) => setFilter({...filter, category: e.target.value})}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            <select 
              value={filter.status} 
              onChange={(e) => setFilter({...filter, status: e.target.value})}
            >
              <option value="">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <select 
              value={filter.priority} 
              onChange={(e) => setFilter({...filter, priority: e.target.value})}
            >
              <option value="">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {isCoordinator && (
              <select 
                value={filter.user} 
                onChange={(e) => setFilter({...filter, user: e.target.value})}
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            )}

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="order">Custom Order (Drag to reorder)</option>
              <option value="priority">Priority</option>
              <option value="dueDate">Due Date</option>
              <option value="created">Created Date</option>
            </select>
          </div>
        </div>
      )}


      {/* Day Sections */}
      <div className="task-sections">
        {[
          { key: 'today', title: 'Today', icon: '📅', getDate: () => new Date() },
          { key: 'tomorrow', title: 'Tomorrow', icon: '⏰', getDate: () => {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            return date;
          }},
          { key: 'dayAfter', title: 'Day After Tomorrow', icon: '📆', getDate: () => {
            const date = new Date();
            date.setDate(date.getDate() + 2);
            return date;
          }},
          { key: 'unscheduled', title: 'Unscheduled', icon: '📋', getDate: () => null }
        ].map(section => {
          const sectionTasks = filteredTasks.filter(task => 
            section.key === 'unscheduled' 
              ? !task.daySection || task.daySection === null
              : task.daySection === section.key
          );
          
          const sectionDate = section.getDate();
          const dateString = sectionDate ? format(sectionDate, 'EEEE, MMM d') : null;
          
          return (
            <div key={section.key} className="task-section">
              <div className="section-header">
                <span className="section-icon">{section.icon}</span>
                <div className="section-title-container">
                  <h3 className="section-title">{section.title}</h3>
                  {dateString && <span className="section-date">({dateString})</span>}
                </div>
                <span className="section-count">({sectionTasks.length})</span>
              </div>
              
              <div 
                className={`task-drop-zone ${section.key}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('drag-over');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('drag-over');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  if (draggedTask) {
                    moveToDaySection(draggedTask, section.key === 'unscheduled' ? null : section.key as 'today' | 'tomorrow' | 'dayAfter');
                  }
                }}
              >
                {sectionTasks.length === 0 && (
                  <div className="empty-section">
                    Drop tasks here or click "Add Task"
                  </div>
                )}
                
                {sectionTasks.map((task, index) => {
                  const category = getCategoryByName(task.category);
                  const isDraggable = sortBy === 'order';
                  const isBeingDragged = draggedTask?.id === task.id;
                  const isDragTarget = dragOverTask === task.id;
                  
                  return (
                    <div key={task.id} className="task-item-wrapper">
                      <div 
                        className={`task-card ${task.status} ${
                          isDraggable ? 'draggable' : ''
                        } ${
                          isBeingDragged ? 'being-dragged' : ''
                        } ${
                          isDragTarget ? 'drag-target' : ''
                        } ${
                          task.isActive ? 'active-task' : ''
                        }`}
                        style={{ borderLeftColor: task.isActive ? '#ef4444' : task.color }}
                        draggable={isDraggable}
                        onDragStart={isDraggable ? (e) => handleDragStart(e, task) : undefined}
                        onDragEnd={isDraggable ? handleDragEnd : undefined}
                        onDragOver={isDraggable ? (e) => handleDragOver(e, task) : undefined}
                        onDragLeave={isDraggable ? handleDragLeave : undefined}
                        onDrop={isDraggable ? (e) => handleDrop(e, task) : undefined}
                        onDoubleClick={() => toggleTaskActive(task)}
                      >
                      <div className="task-main">
                        {isDraggable && (
                          <div className="drag-handle" title="Drag to reorder">
                            <GripVertical size={16} />
                          </div>
                        )}
                        
                        <div className="task-checkbox" onClick={() => toggleTaskStatus(task)}>
                          {task.status === 'completed' ? 
                            <CheckSquare size={20} style={{ color: statusColors.completed }} /> :
                            <Square size={20} style={{ color: statusColors[task.status] }} />
                          }
                        </div>

                        <div className="task-content">
                          <div className="task-title">
                            {task.title}
                            {(isCoordinator || isAdmin) && task.userName && (
                              <span className="task-user"> - {task.userName}</span>
                            )}
                          </div>
                          {task.description && (
                            <div className="task-description">{task.description}</div>
                          )}
                          
                          <div className="task-meta">
                            {category && (
                              <span className="task-category" style={{ color: category.color }}>
                                {React.createElement(getIconComponent(category.icon), { size: 14 })} {category.name}
                              </span>
                            )}
                            
                            <span className={`task-priority priority-${task.priority}`}>
                              <Flag size={14} />
                              {task.priority}
                            </span>

                            <span className={`task-status status-${task.status}`}>
                              <Circle size={14} />
                              {task.status.replace('_', ' ')}
                            </span>

                            {task.dueDate && (
                              <span className="task-due-date">
                                <CalendarIcon size={14} />
                                {format(new Date(task.dueDate), 'MMM dd')}
                              </span>
                            )}
                          </div>

                          {task.tags && task.tags.length > 0 && (
                            <div className="task-tags">
                              {task.tags.map(tag => (
                                <span key={tag} className="task-tag">
                                  <Tag size={12} />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="task-actions">
                          <label className="active-switch" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={task.isActive || false}
                              onChange={() => toggleTaskActive(task)}
                            />
                            <span className="slider"></span>
                          </label>
                          <button onClick={() => openTaskModal(task)}>
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => deleteTask(task.id!)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="empty-state">
            <CheckSquare size={48} />
            <h3>No tasks found</h3>
            <p>Create your first task to get organized</p>
          </div>
        )}
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
              <button onClick={closeModals}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={saveTask} className="task-form">
              <div className="form-grid">
                <div className="form-group span-2">
                  <label>Title</label>
                  <input
                    type="text"
                    value={taskFormData.title || ''}
                    onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group span-2">
                  <label>Description</label>
                  <textarea
                    value={taskFormData.description || ''}
                    onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={taskFormData.category || ''}
                    onChange={(e) => setTaskFormData({ ...taskFormData, category: e.target.value })}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={taskFormData.priority || 'medium'}
                    onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value as Task['priority'] })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={taskFormData.status || 'todo'}
                    onChange={(e) => setTaskFormData({ ...taskFormData, status: e.target.value as Task['status'] })}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={taskFormData.dueDate || ''}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Schedule For</label>
                  <select
                    value={taskFormData.daySection || ''}
                    onChange={(e) => setTaskFormData({ ...taskFormData, daySection: e.target.value as Task['daySection'] })}
                  >
                    <option value="">Unscheduled</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="dayAfter">Day After Tomorrow</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker">
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${taskFormData.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setTaskFormData({ ...taskFormData, color })}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="tags-section">
                <label>Tags</label>
                <div className="tags-input">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add a tag..."
                  />
                  <button type="button" onClick={addTag}>Add</button>
                </div>
                
                <div className="tags-list">
                  {(taskFormData.tags || []).map(tag => (
                    <span key={tag} className="tag-item">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)}>
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={closeModals} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Tasks;