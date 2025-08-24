import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { 
  Plus, 
  Search,
  Edit2, 
  Trash2,
  FileText,
  StickyNote,
  Clock,
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface Note {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  category: 'meeting' | 'personal' | 'project' | 'other';
  lastModified: Timestamp;
  createdAt?: Timestamp;
  wordCount?: number;
}

const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Auto-save related state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Form data for editing
  const [editFormData, setEditFormData] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    category: 'other' as Note['category'],
    newTag: ''
  });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const notesSnapshot = await getDocs(
        query(collection(db, 'notes'), orderBy('lastModified', 'desc'))
      );
      const notesData: Note[] = [];
      notesSnapshot.forEach((doc) => {
        const noteData = doc.data() as Note;
        notesData.push({ 
          id: doc.id, 
          ...noteData,
          wordCount: noteData.content ? noteData.content.split(/\s+/).filter(word => word.length > 0).length : 0
        });
      });
      setNotes(notesData);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save functionality with debounce
  const debouncedSave = useCallback(
    (noteData: Partial<Note>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (selectedNote?.id) {
          setIsSaving(true);
          try {
            await updateDoc(doc(db, 'notes', selectedNote.id), {
              ...noteData,
              lastModified: Timestamp.now(),
              wordCount: noteData.content ? noteData.content.split(/\s+/).filter(word => word.length > 0).length : 0
            });
            setLastSaved(new Date());
            // Update local state
            setNotes(prev => prev.map(note => 
              note.id === selectedNote.id 
                ? { ...note, ...noteData, lastModified: Timestamp.now() }
                : note
            ));
            setSelectedNote(prev => prev ? { ...prev, ...noteData } : null);
          } catch (error) {
            console.error('Error auto-saving note:', error);
          } finally {
            setIsSaving(false);
          }
        }
      }, 1000); // 1 second debounce
    },
    [selectedNote?.id]
  );

  // Handle content changes with auto-save
  const handleContentChange = (field: string, value: string | string[]) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
    
    if (selectedNote?.id && (field === 'title' || field === 'content')) {
      debouncedSave({ [field]: value });
    }
  };

  const createNewNote = async () => {
    try {
      const newNote = {
        title: 'Untitled Note',
        content: '',
        tags: [],
        category: 'other' as Note['category'],
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now(),
        wordCount: 0
      };
      
      const docRef = await addDoc(collection(db, 'notes'), newNote);
      const createdNote = { ...newNote, id: docRef.id };
      
      setNotes(prev => [createdNote, ...prev]);
      setSelectedNote(createdNote);
      setIsEditing(true);
      setEditFormData({
        title: createdNote.title,
        content: createdNote.content,
        tags: createdNote.tags,
        category: createdNote.category,
        newTag: ''
      });
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const selectNote = (note: Note) => {
    if (selectedNote?.id !== note.id) {
      setSelectedNote(note);
      setEditFormData({
        title: note.title,
        content: note.content,
        tags: note.tags,
        category: note.category,
        newTag: ''
      });
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    setIsEditing(true);
  };

  const addTag = () => {
    const tag = editFormData.newTag.trim();
    if (tag && !editFormData.tags.includes(tag)) {
      const newTags = [...editFormData.tags, tag];
      setEditFormData(prev => ({ ...prev, tags: newTags, newTag: '' }));
      
      if (selectedNote?.id) {
        debouncedSave({ tags: newTags });
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = editFormData.tags.filter(tag => tag !== tagToRemove);
    setEditFormData(prev => ({ ...prev, tags: newTags }));
    
    if (selectedNote?.id) {
      debouncedSave({ tags: newTags });
    }
  };

  const deleteNote = async (noteId: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteDoc(doc(db, 'notes', noteId));
        setNotes(prev => prev.filter(note => note.id !== noteId));
        if (selectedNote?.id === noteId) {
          setSelectedNote(null);
          setIsEditing(false);
        }
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  const saveCategory = () => {
    if (selectedNote?.id) {
      debouncedSave({ category: editFormData.category });
    }
  };

  // Get filtered notes
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || note.category === filterCategory;
    const matchesTag = !filterTag || note.tags.includes(filterTag);
    
    return matchesSearch && matchesCategory && matchesTag;
  });

  // Get all unique tags
  const allTags = Array.from(new Set(notes.flatMap(note => note.tags)));

  if (loading) {
    return <div className="loading">Loading notes...</div>;
  }

  return (
    <div className="notes-page">
      <div className="notes-layout">
        {/* Notes Sidebar */}
        <div className="notes-sidebar">
          <div className="notes-header">
            <div className="notes-title">
              <StickyNote size={24} />
              <h2>Notes</h2>
            </div>
            <button className="btn-primary" onClick={createNewNote}>
              <Plus size={16} />
              New Note
            </button>
          </div>

          {/* Search and Filters */}
          <div className="notes-filters">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="filter-row">
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="meeting">Meeting</option>
                <option value="personal">Personal</option>
                <option value="project">Project</option>
                <option value="other">Other</option>
              </select>
              
              <select 
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes List */}
          <div className="notes-list">
            {filteredNotes.map(note => (
              <div 
                key={note.id}
                className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                onClick={() => selectNote(note)}
              >
                <div className="note-item-header">
                  <h4>{note.title}</h4>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id!);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="note-preview">{note.content.substring(0, 100)}...</p>
                <div className="note-meta">
                  <span className={`category-badge ${note.category}`}>
                    {note.category}
                  </span>
                  <span className="note-date">
                    {format(note.lastModified.toDate(), 'MMM dd, HH:mm')}
                  </span>
                </div>
                {note.tags.length > 0 && (
                  <div className="note-tags">
                    {note.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="note-tag">{tag}</span>
                    ))}
                    {note.tags.length > 2 && <span className="note-tag">+{note.tags.length - 2}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Note Editor */}
        <div className="note-editor">
          {selectedNote ? (
            <>
              <div className="editor-header">
                <div className="editor-title">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.title}
                      onChange={(e) => handleContentChange('title', e.target.value)}
                      className="title-input"
                      placeholder="Note title..."
                    />
                  ) : (
                    <h1>{selectedNote.title}</h1>
                  )}
                </div>
                
                <div className="editor-actions">
                  {isSaving && (
                    <span className="saving-indicator">
                      <Clock size={14} />
                      Saving...
                    </span>
                  )}
                  {lastSaved && !isSaving && (
                    <span className="saved-indicator">
                      <Clock size={14} />
                      Saved {format(lastSaved, 'HH:mm')}
                    </span>
                  )}
                  {!isEditing && (
                    <button className="btn-secondary" onClick={startEditing}>
                      <Edit2 size={16} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="editor-meta">
                <div className="meta-row">
                  <div className="category-selector">
                    <label>Category:</label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => {
                        handleContentChange('category', e.target.value);
                        saveCategory();
                      }}
                    >
                      <option value="meeting">Meeting</option>
                      <option value="personal">Personal</option>
                      <option value="project">Project</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="word-count">
                    {selectedNote.wordCount} words
                  </div>
                </div>

                {/* Tags Management */}
                <div className="tags-section">
                  <label>Tags:</label>
                  <div className="tags-container">
                    <div className="current-tags">
                      {editFormData.tags.map(tag => (
                        <span key={tag} className="tag-item">
                          {tag}
                          <button onClick={() => removeTag(tag)}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="add-tag">
                      <input
                        type="text"
                        value={editFormData.newTag}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, newTag: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                        placeholder="Add tag..."
                        className="tag-input"
                      />
                      <button onClick={addTag} className="btn-sm">Add</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="editor-content">
                {isEditing ? (
                  <textarea
                    value={editFormData.content}
                    onChange={(e) => handleContentChange('content', e.target.value)}
                    placeholder="Start writing your note..."
                    className="content-textarea"
                  />
                ) : (
                  <div className="content-display">
                    {selectedNote.content.split('\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-note-selected">
              <FileText size={48} />
              <h3>Select a note to view</h3>
              <p>Choose a note from the sidebar or create a new one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notes;