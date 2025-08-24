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
import { db } from '../config/firebase';
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
  ArrowUp,
  ArrowDown,
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
  Zap
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: '', status: '', priority: '' });
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'created' | 'order'>('order');
  const [showFilters, setShowFilters] = useState(false);

  const [taskFormData, setTaskFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    status: 'todo',
    color: '#3b82f6',
    dueDate: '',
    tags: [],
    order: 0
  });


  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
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
      
      await Promise.all([fetchTasks(), fetchCategories()]);
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const tasksSnapshot = await getDocs(
        query(collection(db, 'tasks'), orderBy('order', 'asc'))
      );
      const tasksData: Task[] = [];
      tasksSnapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() } as Task);
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
        order: tasks.length
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
    
    try {
      const taskData = {
        ...taskFormData,
        updatedAt: Timestamp.now()
      };

      if (editingTask) {
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

  const updateTaskOrder = async (taskId: string, newOrder: number) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { 
        order: newOrder,
        updatedAt: Timestamp.now()
      });
      await fetchTasks();
    } catch (error) {
      console.error('Error updating task order:', error);
    }
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
        </div>
        <div className="header-actions">
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

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="order">Custom Order</option>
              <option value="priority">Priority</option>
              <option value="dueDate">Due Date</option>
              <option value="created">Created Date</option>
            </select>
          </div>
        </div>
      )}


      {/* Tasks List */}
      <div className="tasks-list">
        {filteredTasks.map((task, index) => {
          const category = getCategoryByName(task.category);
          
          return (
            <div 
              key={task.id} 
              className={`task-card ${task.status}`}
              style={{ borderLeftColor: task.color }}
            >
              <div className="task-main">
                <div className="task-checkbox" onClick={() => toggleTaskStatus(task)}>
                  {task.status === 'completed' ? 
                    <CheckSquare size={20} style={{ color: statusColors.completed }} /> :
                    <Square size={20} style={{ color: statusColors[task.status] }} />
                  }
                </div>

                <div className="task-content">
                  <div className="task-title">{task.title}</div>
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
                  <div className="task-order-controls">
                    <button 
                      onClick={() => updateTaskOrder(task.id!, task.order - 1)}
                      disabled={index === 0}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button 
                      onClick={() => updateTaskOrder(task.id!, task.order + 1)}
                      disabled={index === filteredTasks.length - 1}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  
                  <button onClick={() => openTaskModal(task)}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteTask(task.id!)}>
                    <Trash2 size={16} />
                  </button>
                </div>
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