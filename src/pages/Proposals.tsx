import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Edit2, 
  Trash2, 
  X, 
  Save,
  FileText,
  Download,
  Eye,
  Copy,
  Image,
  Type,
  Table,
  Layout,
  Palette,
  FileEdit,
  Printer,
  Share,
  ChevronLeft,
  ChevronRight,
  FilePlus
} from 'lucide-react';

interface Proposal {
  id?: string;
  title: string;
  client: string;
  content: ProposalContent;
  template: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface ProposalContent {
  pages: ProposalPage[];
  theme: {
    primaryColor: string;
    backgroundColor: string;
    fontFamily: string;
    backgroundStyle?: {
      type: 'solid' | 'gradient' | 'pattern' | 'geometric';
      style: string;
    };
  };
}

interface ProposalPage {
  id: string;
  sections: ProposalSection[];
}

interface ProposalSection {
  id: string;
  type: 'text' | 'image' | 'table' | 'spacer';
  content: any;
  styling: {
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right';
    fontWeight?: 'normal' | 'bold';
    color?: string;
    marginTop?: number;
    marginBottom?: number;
  };
}

interface ProposalTemplate {
  id: string;
  name: string;
  preview: string;
  content: ProposalContent;
}

const defaultTemplates: ProposalTemplate[] = [
  {
    id: 'modern-business',
    name: 'Modern Business',
    preview: 'Wireframe landscape design with mountain silhouettes and grid lines',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: 'BUSINESS PROPOSAL', tag: 'h1' },
              styling: { fontSize: 32, textAlign: 'center', fontWeight: 'bold', color: '#2563eb', marginBottom: 30 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: 'Company Name', tag: 'h2' },
              styling: { fontSize: 24, textAlign: 'center', color: '#374151', marginBottom: 20 }
            },
            {
              id: '3',
              type: 'spacer',
              content: { height: 40 },
              styling: {}
            },
            {
              id: '4',
              type: 'text',
              content: { text: 'Executive Summary', tag: 'h2' },
              styling: { fontSize: 20, fontWeight: 'bold', color: '#2563eb', marginBottom: 15 }
            },
            {
              id: '5',
              type: 'text',
              content: { text: 'Enter your executive summary here...', tag: 'p' },
              styling: { fontSize: 14, color: '#374151', marginBottom: 20 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#2563eb',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-wireframe-landscape'
        }
      }
    }
  },
  {
    id: 'creative-agency',
    name: 'Creative Agency',
    preview: 'Paint splash design with artistic brushstrokes and vibrant colors',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: 'CREATIVE PROPOSAL', tag: 'h1' },
              styling: { fontSize: 36, textAlign: 'center', fontWeight: 'bold', color: '#ec4899', marginBottom: 25 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: 'Bringing Your Vision to Life', tag: 'h2' },
              styling: { fontSize: 18, textAlign: 'center', color: '#6b7280', marginBottom: 30 }
            },
            {
              id: '3',
              type: 'text',
              content: { text: 'Our Approach', tag: 'h2' },
              styling: { fontSize: 22, fontWeight: 'bold', color: '#8b5cf6', marginBottom: 15 }
            },
            {
              id: '4',
              type: 'text',
              content: { text: 'Describe your creative approach here...', tag: 'p' },
              styling: { fontSize: 14, color: '#374151', marginBottom: 20 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#ec4899',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-creative-splash'
        }
      }
    }
  },
  {
    id: 'executive-minimal',
    name: 'Executive Minimal',
    preview: 'Minimalist dot pattern with sophisticated spacing and clean lines',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: 'PROJECT PROPOSAL', tag: 'h1' },
              styling: { fontSize: 28, textAlign: 'left', fontWeight: 'bold', color: '#1f2937', marginBottom: 40 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: 'Presented to: [Client Name]', tag: 'p' },
              styling: { fontSize: 16, textAlign: 'left', color: '#6b7280', marginBottom: 10 }
            },
            {
              id: '3',
              type: 'text',
              content: { text: 'Prepared by: [Your Company]', tag: 'p' },
              styling: { fontSize: 16, textAlign: 'left', color: '#6b7280', marginBottom: 40 }
            },
            {
              id: '4',
              type: 'text',
              content: { text: 'Project Overview', tag: 'h2' },
              styling: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 20 }
            },
            {
              id: '5',
              type: 'text',
              content: { text: 'This proposal outlines our approach to delivering exceptional results for your project. We bring extensive experience and proven methodologies to ensure success.', tag: 'p' },
              styling: { fontSize: 14, color: '#374151', marginBottom: 30 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#1f2937',
        backgroundColor: '#ffffff',
        fontFamily: 'Georgia, serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-minimal-dots'
        }
      }
    }
  },
  {
    id: 'tech-startup',
    name: 'Tech Startup',
    preview: 'Tech circuit board pattern with nodes and connection lines',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: '🚀 INNOVATION PROPOSAL', tag: 'h1' },
              styling: { fontSize: 34, textAlign: 'center', fontWeight: 'bold', color: '#7c3aed', marginBottom: 20 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: 'Building the Future Together', tag: 'h2' },
              styling: { fontSize: 20, textAlign: 'center', color: '#059669', marginBottom: 40 }
            },
            {
              id: '3',
              type: 'text',
              content: { text: 'Our Mission', tag: 'h2' },
              styling: { fontSize: 24, fontWeight: 'bold', color: '#7c3aed', marginBottom: 15 }
            },
            {
              id: '4',
              type: 'text',
              content: { text: 'We leverage cutting-edge technology to transform ideas into scalable solutions that drive growth and innovation.', tag: 'p' },
              styling: { fontSize: 16, color: '#374151', marginBottom: 30 }
            },
            {
              id: '5',
              type: 'text',
              content: { text: 'Key Benefits', tag: 'h2' },
              styling: { fontSize: 24, fontWeight: 'bold', color: '#059669', marginBottom: 15 }
            },
            {
              id: '6',
              type: 'text',
              content: { text: '• Rapid prototyping and development\n• Scalable cloud-native architecture\n• AI-powered analytics and insights\n• 24/7 support and monitoring', tag: 'p' },
              styling: { fontSize: 14, color: '#374151', marginBottom: 20 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#7c3aed',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-tech-circuit'
        }
      }
    }
  },
  {
    id: 'consulting-professional',
    name: 'Professional Consulting',
    preview: 'Corporate geometric pattern with hexagons and triangular shapes',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: 'STRATEGIC CONSULTING PROPOSAL', tag: 'h1' },
              styling: { fontSize: 30, textAlign: 'center', fontWeight: 'bold', color: '#dc2626', marginBottom: 30 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: 'Excellence in Strategic Advisory', tag: 'h2' },
              styling: { fontSize: 18, textAlign: 'center', color: '#4b5563', marginBottom: 40 }
            },
            {
              id: '3',
              type: 'table',
              content: {
                headers: ['Service Area', 'Expertise Level', 'Delivery Timeline'],
                rows: [
                  ['Strategy Development', 'Expert', '4-6 weeks'],
                  ['Market Analysis', 'Advanced', '2-3 weeks'],
                  ['Implementation Planning', 'Expert', '3-4 weeks']
                ]
              },
              styling: { marginBottom: 30 }
            },
            {
              id: '4',
              type: 'text',
              content: { text: 'Why Choose Us', tag: 'h2' },
              styling: { fontSize: 22, fontWeight: 'bold', color: '#dc2626', marginBottom: 15 }
            },
            {
              id: '5',
              type: 'text',
              content: { text: 'With over 15 years of experience in strategic consulting, we have helped Fortune 500 companies achieve their most ambitious goals through data-driven insights and proven methodologies.', tag: 'p' },
              styling: { fontSize: 14, color: '#374151', marginBottom: 20 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#dc2626',
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica, Arial, sans-serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-corporate-geometric'
        }
      }
    }
  },
  {
    id: 'design-portfolio',
    name: 'Creative Portfolio',
    preview: 'Flowing wave patterns with organic shapes and artistic elements',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: 'CREATIVE VISION', tag: 'h1' },
              styling: { fontSize: 40, textAlign: 'left', fontWeight: 'bold', color: '#f59e0b', marginBottom: 20 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: '& Strategic Design', tag: 'h2' },
              styling: { fontSize: 32, textAlign: 'left', fontWeight: 'normal', color: '#8b5cf6', marginBottom: 40 }
            },
            {
              id: '3',
              type: 'text',
              content: { text: 'Our Creative Process', tag: 'h2' },
              styling: { fontSize: 24, fontWeight: 'bold', color: '#f59e0b', marginBottom: 20 }
            },
            {
              id: '4',
              type: 'text',
              content: { text: '1. Discover & Research\n2. Ideate & Conceptualize\n3. Design & Prototype\n4. Test & Refine\n5. Launch & Optimize', tag: 'p' },
              styling: { fontSize: 16, color: '#374151', marginBottom: 30 }
            },
            {
              id: '5',
              type: 'text',
              content: { text: 'Let\'s Create Something Amazing', tag: 'h2' },
              styling: { fontSize: 26, fontWeight: 'bold', color: '#8b5cf6', marginBottom: 15 }
            },
            {
              id: '6',
              type: 'text',
              content: { text: 'We believe great design tells a story. Our team combines artistic vision with strategic thinking to create experiences that resonate with your audience and drive meaningful results.', tag: 'p' },
              styling: { fontSize: 14, color: '#6b7280', marginBottom: 20 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#f59e0b',
        backgroundColor: '#ffffff',
        fontFamily: 'Playfair Display, serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-artistic-waves'
        }
      }
    }
  },
  {
    id: 'sales-pitch',
    name: 'Sales Pitch',
    preview: 'Sales chart pattern with grid lines and data visualization elements',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: 'REVENUE ACCELERATION', tag: 'h1' },
              styling: { fontSize: 36, textAlign: 'center', fontWeight: 'bold', color: '#059669', marginBottom: 20 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: 'PROPOSAL', tag: 'h1' },
              styling: { fontSize: 36, textAlign: 'center', fontWeight: 'bold', color: '#dc2626', marginBottom: 40 }
            },
            {
              id: '3',
              type: 'text',
              content: { text: '📈 Growth Opportunity', tag: 'h2' },
              styling: { fontSize: 22, fontWeight: 'bold', color: '#059669', marginBottom: 15 }
            },
            {
              id: '4',
              type: 'text',
              content: { text: 'Increase your revenue by 35% within the next 12 months through our proven sales optimization framework.', tag: 'p' },
              styling: { fontSize: 16, color: '#374151', marginBottom: 30 }
            },
            {
              id: '5',
              type: 'table',
              content: {
                headers: ['Metric', 'Current State', 'Target State', 'Improvement'],
                rows: [
                  ['Conversion Rate', '2.5%', '4.2%', '+68%'],
                  ['Average Deal Size', '$12,500', '$18,750', '+50%'],
                  ['Sales Cycle', '45 days', '32 days', '-29%']
                ]
              },
              styling: { marginBottom: 30 }
            },
            {
              id: '6',
              type: 'text',
              content: { text: '💼 Ready to Transform Your Sales?', tag: 'h2' },
              styling: { fontSize: 24, fontWeight: 'bold', color: '#dc2626', marginBottom: 15 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#059669',
        backgroundColor: '#ffffff',
        fontFamily: 'Roboto, sans-serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-sales-chart'
        }
      }
    }
  },
  {
    id: 'research-academic',
    name: 'Research & Academic',
    preview: 'Academic paper design with ruled lines, margins, and binder holes',
    content: {
      pages: [
        {
          id: 'page-1',
          sections: [
            {
              id: '1',
              type: 'text',
              content: { text: 'RESEARCH PROPOSAL', tag: 'h1' },
              styling: { fontSize: 28, textAlign: 'center', fontWeight: 'bold', color: '#1e40af', marginBottom: 30 }
            },
            {
              id: '2',
              type: 'text',
              content: { text: 'Research Title: [Enter Your Research Title]', tag: 'h2' },
              styling: { fontSize: 20, textAlign: 'left', fontWeight: 'bold', color: '#374151', marginBottom: 20 }
            },
            {
              id: '3',
              type: 'text',
              content: { text: 'Principal Investigator: [Your Name]', tag: 'p' },
              styling: { fontSize: 14, color: '#6b7280', marginBottom: 10 }
            },
            {
              id: '4',
              type: 'text',
              content: { text: 'Institution: [Your Institution]', tag: 'p' },
              styling: { fontSize: 14, color: '#6b7280', marginBottom: 30 }
            },
            {
              id: '5',
              type: 'text',
              content: { text: 'Abstract', tag: 'h2' },
              styling: { fontSize: 18, fontWeight: 'bold', color: '#1e40af', marginBottom: 15 }
            },
            {
              id: '6',
              type: 'text',
              content: { text: 'This research proposal outlines a comprehensive study to investigate [research topic]. The methodology combines quantitative and qualitative approaches to provide robust insights into [research focus].', tag: 'p' },
              styling: { fontSize: 14, color: '#374151', marginBottom: 20 }
            },
            {
              id: '7',
              type: 'text',
              content: { text: 'Research Objectives', tag: 'h2' },
              styling: { fontSize: 18, fontWeight: 'bold', color: '#1e40af', marginBottom: 15 }
            },
            {
              id: '8',
              type: 'text',
              content: { text: '1. To examine the relationship between [variable A] and [variable B]\n2. To identify key factors influencing [phenomenon]\n3. To develop a framework for [specific application]\n4. To validate findings through empirical testing', tag: 'p' },
              styling: { fontSize: 14, color: '#374151', marginBottom: 20 }
            }
          ]
        }
      ],
      theme: {
        primaryColor: '#1e40af',
        backgroundColor: '#ffffff',
        fontFamily: 'Times New Roman, serif',
        backgroundStyle: {
          type: 'pattern',
          style: 'bg-academic-paper'
        }
      }
    }
  }
];

const Proposals: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<number | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string>('page-1');

  const [proposalFormData, setProposalFormData] = useState<Partial<Proposal>>({
    title: '',
    client: '',
    status: 'draft',
    template: 'modern-business',
    content: defaultTemplates[0].content
  });

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const proposalsSnapshot = await getDocs(
        query(collection(db, 'proposals'), orderBy('createdAt', 'desc'))
      );
      const proposalsData: Proposal[] = [];
      proposalsSnapshot.forEach((doc) => {
        proposalsData.push({ id: doc.id, ...doc.data() } as Proposal);
      });
      setProposals(proposalsData);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      setError('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const openTemplateModal = () => {
    setShowTemplateModal(true);
  };

  const selectTemplate = (template: ProposalTemplate) => {
    setSelectedTemplate(template);
    
    if (showEditor && proposalFormData.content?.pages?.length) {
      // If we're in the editor with existing content, ask user for confirmation
      if (window.confirm('Applying a new template will replace your current content. Continue?')) {
        applyTemplate(template);
      }
    } else {
      // New proposal, apply template directly
      setProposalFormData({
        ...proposalFormData,
        template: template.id,
        content: { ...template.content }
      });
      setCurrentPageId(template.content.pages[0]?.id || 'page-1');
    }
    
    setShowTemplateModal(false);
    if (!showEditor) {
      setShowEditor(true);
    }
  };

  const applyTemplate = (template: ProposalTemplate) => {
    setProposalFormData({
      ...proposalFormData,
      template: template.id,
      content: { ...template.content }
    });
    setCurrentPageId(template.content.pages[0]?.id || 'page-1');
  };

  const openEditor = (proposal?: Proposal) => {
    if (proposal) {
      setEditingProposal(proposal);
      setProposalFormData(proposal);
      setCurrentPageId(proposal.content?.pages?.[0]?.id || 'page-1');
    } else {
      setEditingProposal(null);
      setProposalFormData({
        title: '',
        client: '',
        status: 'draft',
        template: 'modern-business',
        content: defaultTemplates[0].content
      });
      setCurrentPageId('page-1');
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingProposal(null);
    setSelectedTemplate(null);
  };

  const saveProposal = async () => {
    if (!proposalFormData.title || !proposalFormData.client) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const proposalData = {
        ...proposalFormData,
        updatedAt: Timestamp.now()
      };

      if (editingProposal) {
        await updateDoc(doc(db, 'proposals', editingProposal.id!), proposalData);
        setMessage('Proposal updated successfully!');
      } else {
        await addDoc(collection(db, 'proposals'), {
          ...proposalData,
          createdAt: Timestamp.now()
        });
        setMessage('Proposal created successfully!');
      }

      await fetchProposals();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving proposal:', error);
      setError('Failed to save proposal');
    } finally {
      setLoading(false);
    }
  };

  const deleteProposal = async (proposalId: string) => {
    if (window.confirm('Are you sure you want to delete this proposal?')) {
      try {
        await deleteDoc(doc(db, 'proposals', proposalId));
        setMessage('Proposal deleted successfully!');
        await fetchProposals();
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Error deleting proposal:', error);
        setError('Failed to delete proposal');
      }
    }
  };

  const duplicateProposal = async (proposal: Proposal) => {
    try {
      const duplicateData = {
        ...proposal,
        title: `${proposal.title} (Copy)`,
        status: 'draft' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      delete duplicateData.id;

      await addDoc(collection(db, 'proposals'), duplicateData);
      setMessage('Proposal duplicated successfully!');
      await fetchProposals();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error duplicating proposal:', error);
      setError('Failed to duplicate proposal');
    }
  };

  const exportToPDF = () => {
    setMessage('PDF export feature coming soon!');
    setTimeout(() => setMessage(''), 3000);
  };

  const getCurrentPage = (): ProposalPage | null => {
    return proposalFormData.content?.pages?.find(page => page.id === currentPageId) || null;
  };

  const addNewPage = () => {
    const newPageId = `page-${Date.now()}`;
    const newPage: ProposalPage = {
      id: newPageId,
      sections: []
    };

    setProposalFormData({
      ...proposalFormData,
      content: {
        ...proposalFormData.content!,
        pages: [...(proposalFormData.content?.pages || []), newPage]
      }
    });
    
    setCurrentPageId(newPageId);
  };

  const deletePage = (pageId: string) => {
    const pages = proposalFormData.content?.pages || [];
    if (pages.length <= 1) {
      setError('Cannot delete the last page');
      return;
    }

    const filteredPages = pages.filter(page => page.id !== pageId);
    const newCurrentPageId = currentPageId === pageId ? filteredPages[0]?.id : currentPageId;

    setProposalFormData({
      ...proposalFormData,
      content: {
        ...proposalFormData.content!,
        pages: filteredPages
      }
    });

    setCurrentPageId(newCurrentPageId);
  };

  const previewProposal = () => {
    setMessage('Opening preview...');
    setTimeout(() => setMessage(''), 2000);
  };

  const addSection = (type: ProposalSection['type'], dropIndex?: number) => {
    const newSection: ProposalSection = {
      id: Date.now().toString(),
      type,
      content: type === 'text' ? { text: 'Enter text here...', tag: 'p' } :
               type === 'table' ? { headers: ['Column 1', 'Column 2'], rows: [['Data 1', 'Data 2']] } :
               type === 'image' ? { src: '', alt: 'Image' } :
               { height: 20 },
      styling: {
        fontSize: 14,
        textAlign: 'left',
        color: '#374151',
        marginBottom: 15
      }
    };

    const currentPage = getCurrentPage();
    if (!currentPage) return;

    const currentSections = currentPage.sections || [];
    let newSections: ProposalSection[];
    
    if (dropIndex !== undefined && dropIndex >= 0) {
      // Insert at specific position
      newSections = [...currentSections];
      newSections.splice(dropIndex, 0, newSection);
    } else {
      // Add to end
      newSections = [...currentSections, newSection];
    }

    // Update the specific page
    const updatedPages = proposalFormData.content!.pages.map(page =>
      page.id === currentPageId ? { ...page, sections: newSections } : page
    );

    setProposalFormData({
      ...proposalFormData,
      content: {
        ...proposalFormData.content!,
        pages: updatedPages
      }
    });
  };

  const updateSection = (sectionId: string, updates: Partial<ProposalSection>) => {
    const updatedPages = proposalFormData.content!.pages.map(page =>
      page.id === currentPageId
        ? {
            ...page,
            sections: page.sections.map(section =>
              section.id === sectionId ? { ...section, ...updates } : section
            )
          }
        : page
    );

    setProposalFormData({
      ...proposalFormData,
      content: {
        ...proposalFormData.content!,
        pages: updatedPages
      }
    });
  };

  const removeSection = (sectionId: string) => {
    const updatedPages = proposalFormData.content!.pages.map(page =>
      page.id === currentPageId
        ? {
            ...page,
            sections: page.sections.filter(section => section.id !== sectionId)
          }
        : page
    );

    setProposalFormData({
      ...proposalFormData,
      content: {
        ...proposalFormData.content!,
        pages: updatedPages
      }
    });
  };

  // Drag and Drop handlers
  const handleElementDragStart = (e: React.DragEvent, elementType: string) => {
    setDraggedElement(elementType);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', elementType);
  };

  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggedSection(sectionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sectionId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = draggedElement ? 'copy' : 'move';
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedElement || draggedSection) {
      setDropZone(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedElement) {
      // Dropping a new element from sidebar
      addSection(draggedElement as ProposalSection['type'], dropIndex);
    } else if (draggedSection) {
      // Moving existing section
      moveSection(draggedSection, dropIndex);
    }
    
    // Clear drag state
    setDraggedElement(null);
    setDraggedSection(null);
    setDropZone(null);
  };

  const moveSection = (sectionId: string, newIndex: number) => {
    const currentPage = getCurrentPage();
    if (!currentPage) return;

    const sections = currentPage.sections || [];
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    
    if (sectionIndex === -1) return;
    
    const newSections = [...sections];
    const [movedSection] = newSections.splice(sectionIndex, 1);
    
    // Adjust index if we're moving down
    const adjustedIndex = sectionIndex < newIndex ? newIndex - 1 : newIndex;
    newSections.splice(adjustedIndex, 0, movedSection);
    
    const updatedPages = proposalFormData.content!.pages.map(page =>
      page.id === currentPageId ? { ...page, sections: newSections } : page
    );

    setProposalFormData({
      ...proposalFormData,
      content: {
        ...proposalFormData.content!,
        pages: updatedPages
      }
    });
  };

  const handleDocumentDrop = (e: React.DragEvent) => {
    // Only prevent default if we're not over a drop zone
    if (dropZone === null) {
      e.preventDefault();
      e.stopPropagation();
      
      // Add to end of document only if we have a dragged element
      if (draggedElement) {
        addSection(draggedElement as ProposalSection['type']);
      }
    }
    
    // Clear drag state
    setDraggedElement(null);
    setDraggedSection(null);
    setDropZone(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Clear all drag state when drag ends
    setDraggedElement(null);
    setDraggedSection(null);
    setDropZone(null);
  };

  if (loading) {
    return <div className="loading">Loading proposals...</div>;
  }

  if (showEditor) {
    return (
      <div className="proposals-editor">
        <div className="editor-header">
          <div className="editor-title">
            <FileEdit size={24} />
            <h1>{editingProposal ? 'Edit Proposal' : 'Create New Proposal'}</h1>
          </div>
          <div className="editor-actions">
            <button className="btn-secondary" onClick={previewProposal}>
              <Eye size={18} />
              Preview
            </button>
            <button className="btn-secondary" onClick={exportToPDF}>
              <Download size={18} />
              Export PDF
            </button>
            <button className="btn-primary" onClick={saveProposal}>
              <Save size={18} />
              Save
            </button>
            <button className="btn-secondary" onClick={closeEditor}>
              <X size={18} />
              Close
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="page-navigation">
          <div className="page-tabs">
            {proposalFormData.content?.pages?.map((page, index) => (
              <button
                key={page.id}
                className={`page-tab ${currentPageId === page.id ? 'active' : ''}`}
                onClick={() => setCurrentPageId(page.id)}
              >
                <FileText size={16} />
                Page {index + 1}
                {proposalFormData.content!.pages.length > 1 && (
                  <button
                    className="delete-page-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePage(page.id);
                    }}
                    title="Delete page"
                  >
                    <X size={12} />
                  </button>
                )}
              </button>
            ))}
            <button className="add-page-btn" onClick={addNewPage} title="Add new page">
              <FilePlus size={16} />
              New Page
            </button>
          </div>
        </div>

        <div className="editor-container">
          <div className="editor-sidebar">
            <div className="editor-panel">
              <h3>Proposal Details</h3>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={proposalFormData.title || ''}
                  onChange={(e) => setProposalFormData({ ...proposalFormData, title: e.target.value })}
                  placeholder="Enter proposal title"
                />
              </div>
              <div className="form-group">
                <label>Client *</label>
                <input
                  type="text"
                  value={proposalFormData.client || ''}
                  onChange={(e) => setProposalFormData({ ...proposalFormData, client: e.target.value })}
                  placeholder="Enter client name"
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={proposalFormData.status || 'draft'}
                  onChange={(e) => setProposalFormData({ ...proposalFormData, status: e.target.value as Proposal['status'] })}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="editor-panel">
              <h3>Template</h3>
              <button 
                className="btn-secondary template-change-btn" 
                onClick={() => setShowTemplateModal(true)}
                type="button"
              >
                <Palette size={16} />
                Change Template
              </button>
            </div>

            <div className="editor-panel">
              <h3>Drag Elements</h3>
              <div className="element-buttons">
                <button 
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'text')}
                  onDragEnd={handleDragEnd}
                  onClick={() => addSection('text')} 
                  className="element-btn draggable-element"
                  title="Drag onto document or click to add"
                >
                  <Type size={16} />
                  Text
                </button>
                <button 
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'table')}
                  onDragEnd={handleDragEnd}
                  onClick={() => addSection('table')} 
                  className="element-btn draggable-element"
                  title="Drag onto document or click to add"
                >
                  <Table size={16} />
                  Table
                </button>
                <button 
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'image')}
                  onDragEnd={handleDragEnd}
                  onClick={() => addSection('image')} 
                  className="element-btn draggable-element"
                  title="Drag onto document or click to add"
                >
                  <Image size={16} />
                  Image
                </button>
                <button 
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'spacer')}
                  onDragEnd={handleDragEnd}
                  onClick={() => addSection('spacer')} 
                  className="element-btn draggable-element"
                  title="Drag onto document or click to add"
                >
                  <Layout size={16} />
                  Spacer
                </button>
              </div>
            </div>
          </div>

          <div className="editor-main">
            <div className="document-canvas" ref={editorRef}>
              <div 
                className={`document-page ${proposalFormData.content?.theme?.backgroundStyle?.style || ''}`}
                style={{
                  backgroundColor: proposalFormData.content?.theme?.backgroundColor || '#ffffff',
                  fontFamily: proposalFormData.content?.theme?.fontFamily || 'Arial, sans-serif'
                }}
                onDragOver={handleDragOver}
                onDrop={handleDocumentDrop}
                onDragLeave={handleDragLeave}
              >
                {/* Drop zone at the beginning */}
                <div 
                  className={`drop-zone ${dropZone === 0 ? 'active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropZone(0);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropZone(0);
                  }}
                  onDrop={(e) => handleDrop(e, 0)}
                />
                
                {getCurrentPage()?.sections?.map((section, index) => (
                  <React.Fragment key={section.id}>
                    <div 
                      className="document-section"
                      draggable
                      onDragStart={(e) => handleSectionDragStart(e, section.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="section-controls">
                        <button onClick={() => removeSection(section.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    
                    {section.type === 'text' && (
                      <div
                        style={{
                          fontSize: section.styling.fontSize,
                          textAlign: section.styling.textAlign,
                          fontWeight: section.styling.fontWeight,
                          color: section.styling.color,
                          marginTop: section.styling.marginTop,
                          marginBottom: section.styling.marginBottom
                        }}
                      >
                        <textarea
                          value={section.content.text}
                          onChange={(e) => updateSection(section.id, {
                            content: { ...section.content, text: e.target.value }
                          })}
                          className="text-editor"
                          style={{
                            fontSize: section.styling.fontSize,
                            fontWeight: section.styling.fontWeight,
                            color: section.styling.color
                          }}
                        />
                      </div>
                    )}

                    {section.type === 'table' && (
                      <div className="table-editor">
                        <table>
                          <thead>
                            <tr>
                              {section.content.headers?.map((header: string, index: number) => (
                                <th key={index}>
                                  <input
                                    value={header}
                                    onChange={(e) => {
                                      const newHeaders = [...section.content.headers];
                                      newHeaders[index] = e.target.value;
                                      updateSection(section.id, {
                                        content: { ...section.content, headers: newHeaders }
                                      });
                                    }}
                                  />
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.content.rows?.map((row: string[], rowIndex: number) => (
                              <tr key={rowIndex}>
                                {row.map((cell: string, cellIndex: number) => (
                                  <td key={cellIndex}>
                                    <input
                                      value={cell}
                                      onChange={(e) => {
                                        const newRows = [...section.content.rows];
                                        newRows[rowIndex][cellIndex] = e.target.value;
                                        updateSection(section.id, {
                                          content: { ...section.content, rows: newRows }
                                        });
                                      }}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {section.type === 'spacer' && (
                      <div
                        style={{ height: section.content.height }}
                        className="spacer-section"
                      >
                        <span>Spacer ({section.content.height}px)</span>
                      </div>
                    )}
                    </div>
                    
                    {/* Drop zone after each section */}
                    <div 
                      className={`drop-zone ${dropZone === index + 1 ? 'active' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropZone(index + 1);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropZone(index + 1);
                      }}
                      onDrop={(e) => handleDrop(e, index + 1)}
                    />
                  </React.Fragment>
                ))}
                
                {/* Empty document message */}
                {(!getCurrentPage()?.sections || getCurrentPage()?.sections.length === 0) && (
                  <div className="empty-document">
                    <div className="empty-document-content">
                      <FileEdit size={48} />
                      <h3>Start building your proposal</h3>
                      <p>Drag elements from the sidebar or click them to add content</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Template Modal */}
        {showTemplateModal && (
          <div 
            className="modal-overlay" 
            style={{ 
              zIndex: 9999, 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div className="modal-content template-modal">
              <div className="modal-header">
                <h2>Choose Template</h2>
                <button onClick={() => setShowTemplateModal(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="templates-grid">
                {defaultTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="template-card"
                    onClick={() => selectTemplate(template)}
                  >
                    <div 
                      className={`template-preview ${template.content.theme.backgroundStyle?.style || ''}`} 
                      style={{ 
                        backgroundColor: template.content.theme.backgroundColor,
                        borderLeft: `4px solid ${template.content.theme.primaryColor}`
                      }}
                    >
                      <div className="template-preview-content">
                        <div 
                          className="preview-title"
                          style={{ 
                            color: template.content.theme.primaryColor,
                            fontFamily: template.content.theme.fontFamily
                          }}
                        >
                          {template.content.pages[0]?.sections[0]?.content.text?.substring(0, 20) || 'Template'}
                        </div>
                        <div className="preview-lines">
                          <div className="preview-line" style={{ backgroundColor: template.content.theme.primaryColor }}></div>
                          <div className="preview-line short" style={{ backgroundColor: `${template.content.theme.primaryColor}80` }}></div>
                          <div className="preview-line" style={{ backgroundColor: `${template.content.theme.primaryColor}60` }}></div>
                        </div>
                      </div>
                    </div>
                    <div className="template-info">
                      <h3 style={{ color: template.content.theme.primaryColor }}>{template.name}</h3>
                      <p>{template.preview}</p>
                      <div className="template-theme">
                        <span className="theme-color" style={{ backgroundColor: template.content.theme.primaryColor }}></span>
                        <span className="theme-font">{template.content.theme.fontFamily.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="proposals-page">
      <div className="page-header">
        <div>
          <h1>Proposals</h1>
          <p>Create and manage client proposals with templates and PDF export</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={openTemplateModal}>
            <Layout size={20} />
            Templates
          </button>
          <button className="btn-primary" onClick={() => openEditor()}>
            <Plus size={20} />
            New Proposal
          </button>
        </div>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="proposals-grid">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="proposal-card">
            <div className="proposal-header">
              <div className="proposal-info">
                <h3>{proposal.title}</h3>
                <p className="proposal-client">{proposal.client}</p>
                <span className={`proposal-status status-${proposal.status}`}>
                  {proposal.status.replace('_', ' ')}
                </span>
              </div>
              <div className="proposal-actions">
                <button onClick={() => openEditor(proposal)} title="Edit">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => duplicateProposal(proposal)} title="Duplicate">
                  <Copy size={16} />
                </button>
                <button onClick={() => deleteProposal(proposal.id!)} title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="proposal-meta">
              <small>Created: {proposal.createdAt?.toDate().toLocaleDateString()}</small>
              {proposal.updatedAt && (
                <small>Updated: {proposal.updatedAt.toDate().toLocaleDateString()}</small>
              )}
            </div>
          </div>
        ))}

        {proposals.length === 0 && (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No proposals yet</h3>
            <p>Create your first proposal to get started</p>
            <button className="btn-primary" onClick={() => openEditor()}>
              <Plus size={18} />
              Create Proposal
            </button>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div 
          className="modal-overlay" 
          style={{ 
            zIndex: 9999, 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="modal-content template-modal">
            <div className="modal-header">
              <h2>Choose Template</h2>
              <button onClick={() => setShowTemplateModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="templates-grid">
              {defaultTemplates.map((template) => (
                <div
                  key={template.id}
                  className="template-card"
                  onClick={() => selectTemplate(template)}
                >
                  <div 
                    className={`template-preview ${template.content.theme.backgroundStyle?.style || ''}`} 
                    style={{ 
                      backgroundColor: template.content.theme.backgroundColor,
                      borderLeft: `4px solid ${template.content.theme.primaryColor}`
                    }}
                  >
                    <div className="template-preview-content">
                      <div 
                        className="preview-title"
                        style={{ 
                          color: template.content.theme.primaryColor,
                          fontFamily: template.content.theme.fontFamily
                        }}
                      >
                        {template.content.pages[0]?.sections[0]?.content.text?.substring(0, 20) || 'Template'}
                      </div>
                      <div className="preview-lines">
                        <div className="preview-line" style={{ backgroundColor: template.content.theme.primaryColor }}></div>
                        <div className="preview-line short" style={{ backgroundColor: `${template.content.theme.primaryColor}80` }}></div>
                        <div className="preview-line" style={{ backgroundColor: `${template.content.theme.primaryColor}60` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="template-info">
                    <h3 style={{ color: template.content.theme.primaryColor }}>{template.name}</h3>
                    <p>{template.preview}</p>
                    <div className="template-theme">
                      <span className="theme-color" style={{ backgroundColor: template.content.theme.primaryColor }}></span>
                      <span className="theme-font">{template.content.theme.fontFamily.split(',')[0]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Proposals;