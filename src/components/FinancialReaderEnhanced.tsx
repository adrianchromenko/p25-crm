import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Plus, 
  X, 
  Filter,
  Calendar,
  Tag,
  Save,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Edit
} from 'lucide-react';
import pdfToText from 'react-pdftotext';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { BankTransaction, TransactionCategory, TransactionTag } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

interface Transaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
}

interface ParsedStatement {
  bankName?: string;
  accountNumber?: string;
  statementPeriod?: string;
  transactions: Transaction[];
}

const FinancialReaderEnhanced: React.FC = () => {
  const [parsedData, setParsedData] = useState<ParsedStatement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [manualTransaction, setManualTransaction] = useState<Transaction>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0
  });
  const [savedTransactions, setSavedTransactions] = useState<BankTransaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [tags, setTags] = useState<TransactionTag[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<BankTransaction>>({});
  const [newCategory, setNewCategory] = useState<Partial<TransactionCategory>>({
    name: '',
    type: 'expense',
    color: '#3b82f6'
  });
  const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState<Partial<TransactionTag>>({
    name: '',
    color: '#10b981',
    description: ''
  });
  const [editingTag, setEditingTag] = useState<TransactionTag | null>(null);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [monthlyStats, setMonthlyStats] = useState({
    income: 0,
    expenses: 0,
    balance: 0
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved transactions, categories, and tags on mount
  useEffect(() => {
    fetchTransactions();
    fetchCategories();
    fetchTags();
  }, [selectedMonth]);

  const fetchTransactions = async () => {
    try {
      const monthStr = format(selectedMonth, 'yyyy-MM');
      const q = query(
        collection(db, 'bank_transactions'),
        where('month', '==', monthStr),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const transactions: BankTransaction[] = [];
      let income = 0;
      let expenses = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data() as BankTransaction;
        transactions.push({ id: doc.id, ...data });
        
        if (data.amount > 0) {
          income += data.amount;
        } else {
          expenses += Math.abs(data.amount);
        }
      });
      
      setSavedTransactions(transactions);
      setMonthlyStats({
        income,
        expenses,
        balance: income - expenses
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'transaction_categories'));
      const categoriesData: TransactionCategory[] = [];
      
      snapshot.forEach((doc) => {
        categoriesData.push({ id: doc.id, ...doc.data() } as TransactionCategory);
      });
      
      // Add default categories if none exist
      if (categoriesData.length === 0) {
        const defaultCategories = [
          { name: 'Salary', type: 'income' as const, color: '#10b981' },
          { name: 'Freelance', type: 'income' as const, color: '#22c55e' },
          { name: 'Investment', type: 'income' as const, color: '#84cc16' },
          { name: 'Groceries', type: 'expense' as const, color: '#ef4444' },
          { name: 'Utilities', type: 'expense' as const, color: '#f97316' },
          { name: 'Transportation', type: 'expense' as const, color: '#f59e0b' },
          { name: 'Entertainment', type: 'expense' as const, color: '#8b5cf6' },
          { name: 'Healthcare', type: 'expense' as const, color: '#ec4899' },
          { name: 'Office Supplies', type: 'expense' as const, color: '#6366f1' },
          { name: 'Software', type: 'expense' as const, color: '#0ea5e9' },
          { name: 'Marketing', type: 'expense' as const, color: '#14b8a6' },
          { name: 'Other', type: 'expense' as const, color: '#6b7280' }
        ];
        
        for (const cat of defaultCategories) {
          const docRef = await addDoc(collection(db, 'transaction_categories'), {
            ...cat,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          categoriesData.push({ id: docRef.id, ...cat });
        }
      }
      
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const tagsSnapshot = await getDocs(collection(db, 'transaction_tags'));
      const tagsData: TransactionTag[] = [];
      
      tagsSnapshot.forEach((doc) => {
        tagsData.push({ id: doc.id, ...doc.data() } as TransactionTag);
      });
      
      setTags(tagsData);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const parseBankStatement = (text: string): ParsedStatement => {
    console.log('=== PDF PARSING DEBUG ===');
    console.log('Raw PDF text length:', text.length);
    console.log('Raw PDF text (first 1000 chars):', text.substring(0, 1000));
    console.log('Raw PDF text (full):', text);
    
    const statement: ParsedStatement = {
      bankName: 'Unknown Bank',
      accountNumber: '',
      statementPeriod: '',
      transactions: []
    };

    // Detect bank type and set appropriate parsing
    if (text.toLowerCase().includes('royal bank') || text.toLowerCase().includes('rbc')) {
      statement.bankName = 'RBC Royal Bank';
    } else if (text.toLowerCase().includes('td bank') || text.toLowerCase().includes('toronto dominion')) {
      statement.bankName = 'TD Bank';
    } else if (text.toLowerCase().includes('scotia') || text.toLowerCase().includes('bank of nova scotia')) {
      statement.bankName = 'Scotiabank';
    }

    // Extract account number (various patterns)
    const accountPatterns = [
      /\*{4}\d{4}/,           // ****1234
      /Account\s*#?\s*:?\s*(\d{4,}|\*+\d{4})/i,
      /Account\s*Number\s*:?\s*(\d{4,}|\*+\d{4})/i
    ];
    
    for (const pattern of accountPatterns) {
      const match = text.match(pattern);
      if (match) {
        statement.accountNumber = match[1] || match[0];
        break;
      }
    }

    // Extract statement period (various date formats)
    const periodPatterns = [
      /(\w{3}\s+\d{1,2},\s+\d{4})\s+to\s+(\w{3}\s+\d{1,2},\s+\d{4})/i,
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Statement\s+Period\s*:?\s*(.+)/i
    ];
    
    for (const pattern of periodPatterns) {
      const match = text.match(pattern);
      if (match) {
        statement.statementPeriod = match[2] ? `${match[1]} to ${match[2]}` : match[1];
        break;
      }
    }

    // Parse RBC bank statement format - transactions are embedded in continuous text
    console.log('=== RBC STATEMENT PROCESSING ===');
    
    // Find the "Account Activity Details" section where transactions start
    const activityStart = text.indexOf('Account Activity Details');
    if (activityStart === -1) {
      console.log('Could not find Account Activity Details section');
      return statement;
    }
    
    // Extract just the transaction portion
    const transactionText = text.substring(activityStart);
    console.log('Transaction text length:', transactionText.length);
    
    // Pattern to match date followed by transaction details: DD MMM
    // Look for date patterns with surrounding context
    const transactionPattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\s+([^0-9]*?)(?=\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\s*$)/gi;
    
    console.log('Using transaction pattern:', transactionPattern);
    
    const matches = [];
    let match;
    
    // Find all date-based transaction segments
    const dateMatches = transactionText.matchAll(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/gi);
    const datePositions = Array.from(dateMatches)
      .filter(m => m.index !== undefined)
      .map(m => ({
        date: m[1],
        index: m.index!
      }));
    
    console.log('Found date positions:', datePositions);
    
    // Process each date segment
    for (let i = 0; i < datePositions.length; i++) {
      const currentDate = datePositions[i];
      const nextDate = datePositions[i + 1];
      
      const startPos = currentDate.index + currentDate.date.length;
      const endPos = nextDate?.index ?? transactionText.length;
      
      const segment = transactionText.substring(startPos, endPos);
      console.log(`Processing segment for ${currentDate.date}:`, segment.substring(0, 200) + '...');
      
      // Process this segment for transactions
      processRBCSegment(currentDate.date, segment, statement);
    }
    
    function processRBCSegment(dateStr: string, segment: string, statement: ParsedStatement) {
      console.log('=== PROCESSING RBC SEGMENT ===');
      console.log('Date:', dateStr);
      console.log('Segment:', segment.substring(0, 300) + '...');
      
      // Pattern to find individual transactions within the segment
      // Look for transaction descriptions followed by amounts
      const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
      
      // Find all amounts in this segment
      const amounts: { amount: string, index: number }[] = [];
      let match;
      while ((match = amountPattern.exec(segment)) !== null) {
        amounts.push({
          amount: match[1],
          index: match.index
        });
      }
      
      console.log('Found amounts in segment:', amounts);
      
      if (amounts.length === 0) {
        console.log('No amounts found in segment, skipping');
        return;
      }
      
      // Look for transaction keywords to identify transaction boundaries
      const transactionKeywords = [
        'e-Transfer sent', 'e-Transfer received', 'e-Transfer - Autodeposit',
        'Contactless Interac purchase', 'Interac purchase', 'ATM withdrawal',
        'Misc Payment', 'Monthly fee', 'Online Transfer', 'Online Banking transfer',
        'INTERAC-SC-', 'INTERAC e-Transfer fee'
      ];
      
      // Find transaction starts
      const transactionStarts: { keyword: string, index: number }[] = [];
      transactionKeywords.forEach(keyword => {
        let searchIndex = 0;
        while (true) {
          const index = segment.toLowerCase().indexOf(keyword.toLowerCase(), searchIndex);
          if (index === -1) break;
          transactionStarts.push({ keyword, index });
          searchIndex = index + 1;
        }
      });
      
      // Sort transaction starts by index
      transactionStarts.sort((a, b) => a.index - b.index);
      console.log('Found transaction starts:', transactionStarts);
      
      // Process each transaction
      for (let i = 0; i < transactionStarts.length; i++) {
        const currentTxn = transactionStarts[i];
        const nextTxn = transactionStarts[i + 1];
        
        const txnStart = currentTxn.index;
        const txnEnd = nextTxn ? nextTxn.index : segment.length;
        
        const txnText = segment.substring(txnStart, txnEnd).trim();
        console.log(`Processing transaction: ${txnText.substring(0, 100)}...`);
        
        // Find amounts in this transaction
        const txnAmounts: string[] = [];
        const txnAmountRegex = new RegExp(amountPattern.source, 'g');
        let txnMatch;
        while ((txnMatch = txnAmountRegex.exec(txnText)) !== null) {
          txnAmounts.push(txnMatch[1]);
        }
        
        if (txnAmounts.length > 0) {
          // Extract description (remove amounts from text)
          let description = txnText.replace(amountPattern, '').trim();
          description = description.replace(/\s+/g, ' ').trim();
          
          // Skip if too short
          if (description.length < 3) continue;
          
          const transactionAmount = txnAmounts[0];
          const balanceAmount = txnAmounts.length > 1 ? txnAmounts[txnAmounts.length - 1] : null;
          
          console.log('Adding transaction:', {
            dateStr,
            description,
            transactionAmount,
            balanceAmount
          });
          
          addParsedTransaction(dateStr, description, transactionAmount, balanceAmount, statement);
        }
      }
    }

    console.log('=== PARSING COMPLETE ===');
    console.log('Total transactions found:', statement.transactions.length);
    console.log('Statement summary:', {
      bankName: statement.bankName,
      accountNumber: statement.accountNumber,
      statementPeriod: statement.statementPeriod,
      transactionCount: statement.transactions.length
    });
    
    return statement;
  };

  const addParsedTransaction = (dateStr: string, description: string, amountStr: string, balanceStr: string | null, statement: ParsedStatement) => {
    let amount = parseFloat(amountStr.replace(/,/g, ''));
    const debitKeywords = [
      'fee', 'withdrawal', 'purchase', 'transfer sent', 'cheque', 
      'atm', 'interac', 'online transfer to', 'payment', 'online banking transfer'
    ];
    
    const isDebit = debitKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );
    
    if (isDebit) {
      amount = -Math.abs(amount);
    } else {
      amount = Math.abs(amount);
    }
    
    // Parse date
    let formattedDate: string;
    const currentYear = new Date().getFullYear();
    
    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const parts = dateStr.trim().split(/\s+/);
      
      if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1];
        
        // Check if monthStr is a valid month abbreviation (case insensitive)
        const monthIndex = monthNames.findIndex(month => 
          month.toLowerCase() === monthStr.toLowerCase()
        );
        
        if (monthIndex >= 0 && day >= 1 && day <= 31) {
          const month = monthIndex + 1;
          formattedDate = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        } else {
          throw new Error(`Invalid date components: day=${day}, month=${monthStr}`);
        }
      } else {
        throw new Error(`Unexpected date format: "${dateStr}" (${parts.length} parts)`);
      }
    } catch (dateError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Skipping transaction due to invalid date: "${dateStr}"`, dateError);
      }
      return;
    }
    
    const balance = balanceStr ? parseFloat(balanceStr.replace(/,/g, '')) : undefined;
    
    statement.transactions.push({
      date: formattedDate,
      description: description.trim(),
      amount: amount,
      balance: balance
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const text = await pdfToText(file);
      setExtractedText(text);
      const parsedStatement = parseBankStatement(text);
      
      if (parsedStatement.transactions.length === 0) {
        setError('No transactions found in the PDF. Please check the format or use manual entry.');
        setShowManualEntry(true);
      } else {
        setParsedData(parsedStatement);
        setShowManualEntry(false);
      }
    } catch (error) {
      console.error('Error parsing PDF:', error);
      setError('Failed to parse PDF. Please try again or use manual entry.');
      setShowManualEntry(true);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTransactionsToDatabase = async () => {
    if (!parsedData || parsedData.transactions.length === 0) {
      setError('No transactions to save');
      return;
    }

    setIsLoading(true);
    try {
      let savedCount = 0;
      
      for (const transaction of parsedData.transactions) {
        const monthStr = transaction.date.substring(0, 7); // YYYY-MM
        
        // Check if transaction already exists (avoid duplicates)
        const q = query(
          collection(db, 'bank_transactions'),
          where('date', '==', transaction.date),
          where('description', '==', transaction.description),
          where('amount', '==', transaction.amount)
        );
        
        const existing = await getDocs(q);
        
        if (existing.empty) {
          // Prepare transaction data, excluding undefined values
          const transactionData: any = {
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            bankName: parsedData.bankName,
            accountNumber: parsedData.accountNumber,
            month: monthStr,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          };
          
          // Only add balance if it exists
          if (transaction.balance !== undefined && transaction.balance !== null) {
            transactionData.balance = transaction.balance;
          }
          
          await addDoc(collection(db, 'bank_transactions'), transactionData);
          savedCount++;
        }
      }
      
      setError(null);
      setParsedData(null);
      await fetchTransactions(); // Refresh the list
      
      if (savedCount < parsedData.transactions.length) {
        setError(`Saved ${savedCount} new transactions (${parsedData.transactions.length - savedCount} duplicates skipped)`);
      } else {
        setError(`Successfully saved ${savedCount} transactions`);
      }
    } catch (error) {
      console.error('Error saving transactions:', error);
      setError('Failed to save transactions to database');
    } finally {
      setIsLoading(false);
    }
  };

  const addManualTransaction = async () => {
    if (!manualTransaction.description || manualTransaction.amount === 0) {
      setError('Please fill in all transaction fields');
      return;
    }

    try {
      const monthStr = manualTransaction.date.substring(0, 7);
      
      // Prepare transaction data, excluding undefined values
      const transactionData: any = {
        date: manualTransaction.date,
        description: manualTransaction.description,
        amount: manualTransaction.amount,
        bankName: 'Manual Entry',
        month: monthStr,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // Only add balance if it exists
      if (manualTransaction.balance !== undefined && manualTransaction.balance !== null) {
        transactionData.balance = manualTransaction.balance;
      }
      
      await addDoc(collection(db, 'bank_transactions'), transactionData);
      
      // Reset form
      setManualTransaction({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: 0
      });
      
      setError(null);
      await fetchTransactions();
    } catch (error) {
      console.error('Error adding manual transaction:', error);
      setError('Failed to add transaction');
    }
  };

  const deleteTransaction = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteDoc(doc(db, 'bank_transactions', id));
        await fetchTransactions();
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const openEditModal = (transaction: BankTransaction) => {
    setEditingTransaction(transaction);
    setEditFormData({
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      tagIds: transaction.tagIds || [],
      notes: transaction.notes || ''
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingTransaction(null);
    setEditFormData({});
  };

  const saveEditedTransaction = async () => {
    if (!editingTransaction || !editFormData.date || !editFormData.description || editFormData.amount === undefined) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const category = categories.find(c => c.id === editFormData.categoryId);
      const newMonthStr = editFormData.date.substring(0, 7); // YYYY-MM
      
      const updatedData: any = {
        date: editFormData.date,
        description: editFormData.description,
        amount: editFormData.amount,
        month: newMonthStr,
        updatedAt: Timestamp.now()
      };

      // Only add optional fields if they have values
      if (editFormData.categoryId) {
        updatedData.categoryId = editFormData.categoryId;
        updatedData.categoryName = category?.name || '';
      }
      
      if (editFormData.notes) {
        updatedData.notes = editFormData.notes;
      }

      // Always include tagIds (empty array if no tags selected)
      updatedData.tagIds = editFormData.tagIds || [];

      await updateDoc(doc(db, 'bank_transactions', editingTransaction.id!), updatedData);
      
      closeEditModal();
      await fetchTransactions();
      setError(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      setError('Failed to update transaction');
    }
  };

  const updateTransactionCategory = async (transactionId: string, categoryId: string) => {
    try {
      const category = categories.find(c => c.id === categoryId);
      
      await updateDoc(doc(db, 'bank_transactions', transactionId), {
        categoryId,
        categoryName: category?.name || '',
        updatedAt: Timestamp.now()
      });
      
      await fetchTransactions();
      setSelectedTransaction(null);
    } catch (error) {
      console.error('Error updating transaction category:', error);
    }
  };

  const createCategory = async () => {
    if (!newCategory.name) {
      setError('Please enter a category name');
      return;
    }

    try {
      await addDoc(collection(db, 'transaction_categories'), {
        ...newCategory,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      setNewCategory({ name: '', type: 'expense', color: '#3b82f6' });
      setShowCategoryModal(false);
      await fetchCategories();
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const startEditCategory = (category: TransactionCategory) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      type: category.type,
      color: category.color
    });
    setIsEditingCategory(true);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setIsEditingCategory(false);
    setNewCategory({ name: '', type: 'expense', color: '#3b82f6' });
  };

  const updateCategory = async () => {
    if (!newCategory.name || !editingCategory?.id) {
      setError('Please enter a category name');
      return;
    }

    try {
      await updateDoc(doc(db, 'transaction_categories', editingCategory.id), {
        name: newCategory.name,
        type: newCategory.type,
        color: newCategory.color,
        updatedAt: Timestamp.now()
      });
      
      setEditingCategory(null);
      setIsEditingCategory(false);
      setNewCategory({ name: '', type: 'expense', color: '#3b82f6' });
      await fetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'transaction_categories', categoryId));
      await fetchCategories();
      
      // Update any transactions that were using this category
      const transactionsQuery = query(
        collection(db, 'bank_transactions'),
        where('categoryId', '==', categoryId)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      const updatePromises = transactionsSnapshot.docs.map(docRef => 
        updateDoc(docRef.ref, { categoryId: null, categoryName: null })
      );
      
      await Promise.all(updatePromises);
      await fetchTransactions();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  // Tag Management Functions
  const createTag = async () => {
    if (!newTag.name) {
      setError('Please enter a tag name');
      return;
    }

    try {
      await addDoc(collection(db, 'transaction_tags'), {
        ...newTag,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      setNewTag({ name: '', color: '#10b981', description: '' });
      setShowTagModal(false);
      await fetchTags();
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const startEditTag = (tag: TransactionTag) => {
    setEditingTag(tag);
    setNewTag({
      name: tag.name,
      color: tag.color,
      description: tag.description
    });
    setIsEditingTag(true);
  };

  const cancelEditTag = () => {
    setEditingTag(null);
    setIsEditingTag(false);
    setNewTag({ name: '', color: '#10b981', description: '' });
  };

  const updateTag = async () => {
    if (!newTag.name || !editingTag?.id) {
      setError('Please enter a tag name');
      return;
    }

    try {
      await updateDoc(doc(db, 'transaction_tags', editingTag.id), {
        name: newTag.name,
        color: newTag.color,
        description: newTag.description,
        updatedAt: Timestamp.now()
      });
      
      setEditingTag(null);
      setIsEditingTag(false);
      setNewTag({ name: '', color: '#10b981', description: '' });
      await fetchTags();
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!window.confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'transaction_tags', tagId));
      await fetchTags();
      
      // Update any transactions that were using this tag
      const transactionsQuery = query(collection(db, 'bank_transactions'));
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      const updatePromises = transactionsSnapshot.docs
        .map(doc => doc.data())
        .filter(transaction => transaction.tagIds && transaction.tagIds.includes(tagId))
        .map(transaction => {
          const updatedTagIds = transaction.tagIds.filter((id: string) => id !== tagId);
          return updateDoc(doc(db, 'bank_transactions', transaction.id), { tagIds: updatedTagIds });
        });
      
      await Promise.all(updatePromises);
      await fetchTransactions();
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  const filteredTransactions = (filterCategory === 'all' 
    ? savedTransactions 
    : savedTransactions.filter(t => t.categoryId === filterCategory))
    .sort((a, b) => {
      // Sort by date ascending (1st of month at top)
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      // Handle invalid dates
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1; // Put invalid dates at the end
      if (isNaN(dateB.getTime())) return -1;
      
      return dateA.getTime() - dateB.getTime(); // Changed to ascending order
    });

  // Calculate category breakdown for current month
  const getCategoryBreakdown = () => {
    const currentMonth = format(selectedMonth, 'yyyy-MM');
    const currentMonthTransactions = savedTransactions.filter(t => t.month === currentMonth);
    const breakdown = new Map<string, { name: string; total: number; count: number; color?: string; type?: 'income' | 'expense' }>();
    
    // Initialize uncategorized
    breakdown.set('uncategorized', { name: 'Uncategorized', total: 0, count: 0, color: '#6b7280', type: 'expense' });
    
    // Process transactions
    currentMonthTransactions.forEach(transaction => {
      const categoryId = transaction.categoryId || 'uncategorized';
      const category = categories.find(c => c.id === categoryId);
      const categoryName = category?.name || 'Uncategorized';
      
      if (!breakdown.has(categoryId)) {
        breakdown.set(categoryId, {
          name: categoryName,
          total: 0,
          count: 0,
          color: category?.color || '#6b7280',
          type: category?.type || 'expense'
        });
      }
      
      const existing = breakdown.get(categoryId)!;
      // For income categories, make amounts positive; for expense categories, make amounts negative
      const adjustedAmount = existing.type === 'income' ? Math.abs(transaction.amount) : -Math.abs(transaction.amount);
      existing.total += adjustedAmount;
      existing.count += 1;
    });
    
    // Convert to array and sort by total amount (descending)
    return Array.from(breakdown.entries())
      .map(([id, data]) => ({ id, ...data }))
      .filter(item => item.count > 0)
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  };

  const categoryBreakdown = getCategoryBreakdown();

  // Calculate tag breakdown for current month
  const getTagBreakdown = () => {
    const currentMonth = format(selectedMonth, 'yyyy-MM');
    const currentMonthTransactions = savedTransactions.filter(t => t.month === currentMonth);
    const breakdown = new Map<string, { name: string; total: number; count: number; color?: string; description?: string }>();
    
    // Process transactions
    currentMonthTransactions.forEach(transaction => {
      if (transaction.tagIds && transaction.tagIds.length > 0) {
        transaction.tagIds.forEach(tagId => {
          const tag = tags.find(t => t.id === tagId);
          const tagName = tag?.name || 'Unknown Tag';
          
          if (!breakdown.has(tagId)) {
            breakdown.set(tagId, {
              name: tagName,
              total: 0,
              count: 0,
              color: tag?.color || '#10b981',
              description: tag?.description
            });
          }
          
          const existing = breakdown.get(tagId)!;
          existing.total += transaction.amount;
          existing.count += 1;
        });
      }
    });
    
    // Convert to array and sort by total amount (descending)
    return Array.from(breakdown.entries())
      .map(([id, data]) => ({ id, ...data }))
      .filter(item => item.count > 0)
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  };

  const tagBreakdown = getTagBreakdown();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
        
        const event = {
          target: {
            files: [file]
          }
        };
        handleFileUpload(event as any);
      }
    }
  };

  return (
    <div className="financial-reader-page">
      <div className="page-header">
        <div>
          <h1><FileText size={24} style={{display: 'inline', marginRight: '12px'}} />Financial Reader</h1>
          <p>Import and categorize transactions from bank statements</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCategoryModal(true)}>
          <Tag size={16} />
          Manage Categories
        </button>
        <button className="btn-secondary" onClick={() => setShowTagModal(true)}>
          <Tag size={16} />
          Manage Tags
        </button>
      </div>

      {/* Month Navigation */}
      <div className="month-navigation">
        <button 
          className="btn-icon"
          onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
        >
          <ChevronLeft size={20} />
        </button>
        <h2>
          <Calendar size={20} />
          {format(selectedMonth, 'MMMM yyyy')}
        </h2>
        <button 
          className="btn-icon"
          onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Monthly Stats */}
      <div className="monthly-stats">
        <div className="stat-card income">
          <TrendingUp size={20} />
          <div>
            <span className="stat-label">Income</span>
            <span className="stat-value">${monthlyStats.income.toFixed(2)}</span>
          </div>
        </div>
        <div className="stat-card expenses">
          <TrendingDown size={20} />
          <div>
            <span className="stat-label">Expenses</span>
            <span className="stat-value">${monthlyStats.expenses.toFixed(2)}</span>
          </div>
        </div>
        <div className={`stat-card balance ${monthlyStats.balance >= 0 ? 'positive' : 'negative'}`}>
          <DollarSign size={20} />
          <div>
            <span className="stat-label">Balance</span>
            <span className="stat-value">${monthlyStats.balance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="financial-reader-content">
        {/* File Upload Area */}
        <div
          className="upload-area"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Upload size={48} className="upload-icon" />
          <p className="upload-title">
            Drop your PDF bank statement here
          </p>
          <p className="upload-subtitle">Supports RBC, TD, Scotiabank and other Canadian banks</p>
          <p className="upload-subtitle">or</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="btn-primary upload-btn"
          >
            Choose File
          </label>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="loading-state">
            <div className="loading-indicator">
              <div className="spinner"></div>
              Processing...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={error.includes('Successfully') ? 'success-state' : 'error-state'}>
            {error.includes('Successfully') ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{error}</span>
          </div>
        )}

        {/* Parsed Data Preview */}
        {parsedData && (
          <div className="parsed-data-section">
            <h3>Imported Transactions</h3>
            <div className="statement-info">
              <span>Bank: {parsedData.bankName}</span>
              {parsedData.accountNumber && <span>Account: ****{parsedData.accountNumber.slice(-4)}</span>}
              <span>{parsedData.transactions.length} transactions found</span>
            </div>
            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.transactions.slice(0, 10).map((transaction, index) => (
                    <tr key={index}>
                      <td>{transaction.date}</td>
                      <td>{transaction.description}</td>
                      <td className={transaction.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.transactions.length > 10 && (
                <p className="more-transactions">... and {parsedData.transactions.length - 10} more transactions</p>
              )}
            </div>
            <button className="btn-primary" onClick={saveTransactionsToDatabase}>
              <Save size={16} />
              Save to Database
            </button>
          </div>
        )}

        {/* Manual Entry Section */}
        {showManualEntry && (
          <div className="manual-entry-section">
            <h3>Manual Transaction Entry</h3>
            <div className="manual-entry-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={manualTransaction.date}
                    onChange={(e) => setManualTransaction({...manualTransaction, date: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualTransaction.amount}
                    onChange={(e) => setManualTransaction({...manualTransaction, amount: parseFloat(e.target.value) || 0})}
                    placeholder="Enter amount (negative for expenses)"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={manualTransaction.description}
                  onChange={(e) => setManualTransaction({...manualTransaction, description: e.target.value})}
                  placeholder="Enter transaction description"
                />
              </div>
              <button className="btn-primary" onClick={addManualTransaction}>
                <Plus size={16} />
                Add Transaction
              </button>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="filter-section">
          <label>
            <Filter size={16} />
            Filter by Category:
          </label>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
        </div>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <div className="category-breakdown-section">
            <h3>Category Breakdown - {format(selectedMonth, 'MMMM yyyy')}</h3>
            <div className="category-breakdown-grid">
              {categoryBreakdown.map((category) => (
                <div key={category.id} className="category-breakdown-item">
                  <div className="category-breakdown-header">
                    <span 
                      className="category-badge"
                      style={{ 
                        backgroundColor: category.color + '20', 
                        borderColor: category.color,
                        color: category.color 
                      }}
                    >
                      {category.name}
                    </span>
                    <span className="category-count">({category.count} transactions)</span>
                  </div>
                  <div className="category-breakdown-amount">
                    <span className={category.total >= 0 ? 'amount-positive' : 'amount-negative'}>
                      {category.total >= 0 ? '+' : ''}${category.total.toFixed(2)}
                    </span>
                    <div 
                      className="category-breakdown-bar"
                      style={{
                        backgroundColor: category.color + '30',
                        width: `${Math.min(100, (Math.abs(category.total) / Math.max(...categoryBreakdown.map(c => Math.abs(c.total)))) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tag Breakdown */}
        {tagBreakdown.length > 0 && (
          <div className="category-breakdown-section">
            <h3>Tag Breakdown - {format(selectedMonth, 'MMMM yyyy')}</h3>
            <div className="category-breakdown-grid">
              {tagBreakdown.map((tag) => (
                <div key={tag.id} className="category-breakdown-item">
                  <div className="category-breakdown-header">
                    <span 
                      className="tag-badge"
                      style={{ 
                        backgroundColor: tag.color + '20', 
                        borderColor: tag.color,
                        color: tag.color 
                      }}
                    >
                      {tag.name}
                    </span>
                    <span className="category-count">({tag.count} transactions)</span>
                  </div>
                  {tag.description && (
                    <div className="tag-description" style={{ marginBottom: '8px' }}>
                      {tag.description}
                    </div>
                  )}
                  <div className="category-breakdown-amount">
                    <span className={tag.total >= 0 ? 'amount-positive' : 'amount-negative'}>
                      {tag.total >= 0 ? '+' : ''}${tag.total.toFixed(2)}
                    </span>
                    <div 
                      className="category-breakdown-bar"
                      style={{
                        backgroundColor: tag.color + '30',
                        width: `${Math.min(100, (Math.abs(tag.total) / Math.max(...tagBreakdown.map(t => Math.abs(t.total)))) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved Transactions Table */}
        {filteredTransactions.length > 0 && (
          <div className="saved-transactions-section">
            <h3>Saved Transactions</h3>
            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Tags</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.date}</td>
                      <td>{transaction.description}</td>
                      <td>
                        <select
                          value={transaction.categoryId || ''}
                          onChange={(e) => updateTransactionCategory(transaction.id!, e.target.value)}
                          className="category-select"
                          style={{
                            backgroundColor: categories.find(c => c.id === transaction.categoryId)?.color + '20',
                            borderColor: categories.find(c => c.id === transaction.categoryId)?.color
                          }}
                        >
                          <option value="">Uncategorized</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="transaction-tags">
                          {transaction.tagIds?.map(tagId => {
                            const tag = tags.find(t => t.id === tagId);
                            return tag ? (
                              <span 
                                key={tagId}
                                className="tag-badge"
                                style={{ 
                                  backgroundColor: tag.color + '20', 
                                  borderColor: tag.color,
                                  color: tag.color 
                                }}
                              >
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                          {(!transaction.tagIds || transaction.tagIds.length === 0) && (
                            <span className="no-tags">No tags</span>
                          )}
                        </div>
                      </td>
                      <td className={transaction.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </td>
                      <td>
                        <button 
                          className="btn-icon small edit"
                          onClick={() => openEditModal(transaction)}
                          title="Edit transaction"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="btn-icon small delete"
                          onClick={() => deleteTransaction(transaction.id!)}
                          title="Delete transaction"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Manage Categories</h2>
              <button className="btn-icon" onClick={() => setShowCategoryModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="category-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Category Name</label>
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                      placeholder="Enter category name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={newCategory.type}
                      onChange={(e) => setNewCategory({...newCategory, type: e.target.value as 'income' | 'expense'})}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <input
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  {isEditingCategory ? (
                    <>
                      <button className="btn-secondary" onClick={cancelEditCategory}>
                        Cancel
                      </button>
                      <button className="btn-primary" onClick={updateCategory}>
                        <Save size={16} />
                        Update Category
                      </button>
                    </>
                  ) : (
                    <button className="btn-primary" onClick={createCategory}>
                      <Plus size={16} />
                      Add Category
                    </button>
                  )}
                </div>
              </div>
              <div className="categories-list">
                <h3>Existing Categories</h3>
                {categories.map(cat => (
                  <div key={cat.id} className="category-item">
                    <div className="category-info">
                      <span 
                        className="category-badge"
                        style={{ backgroundColor: cat.color + '20', borderColor: cat.color }}
                      >
                        {cat.name}
                      </span>
                      <span className={`category-type ${cat.type}`}>{cat.type}</span>
                    </div>
                    <div className="category-actions">
                      <button 
                        className="btn-icon small edit"
                        onClick={() => startEditCategory(cat)}
                        title="Edit category"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        className="btn-icon small delete"
                        onClick={() => deleteCategory(cat.id!)}
                        title="Delete category"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editingTransaction && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Transaction</h2>
              <button className="btn-icon" onClick={closeEditModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  placeholder="Enter transaction description"
                />
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({...editFormData, amount: parseFloat(e.target.value) || 0})}
                  placeholder="Enter amount (negative for expenses)"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={editFormData.categoryId || ''}
                  onChange={(e) => setEditFormData({...editFormData, categoryId: e.target.value})}
                >
                  <option value="">Uncategorized</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tags</label>
                <div className="tags-selection">
                  {tags.map(tag => (
                    <label key={tag.id} className="tag-checkbox">
                      <input
                        type="checkbox"
                        checked={editFormData.tagIds?.includes(tag.id!) || false}
                        onChange={(e) => {
                          const currentTags = editFormData.tagIds || [];
                          const newTagIds = e.target.checked
                            ? [...currentTags, tag.id!]
                            : currentTags.filter(id => id !== tag.id);
                          setEditFormData({...editFormData, tagIds: newTagIds});
                        }}
                      />
                      <span 
                        className="tag-label"
                        style={{ 
                          backgroundColor: tag.color + '20', 
                          borderColor: tag.color,
                          color: tag.color 
                        }}
                      >
                        {tag.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  placeholder="Optional notes"
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={closeEditModal}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={saveEditedTransaction}>
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tag Management Modal */}
      {showTagModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Manage Tags</h2>
              <button className="btn-icon" onClick={() => setShowTagModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="category-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Tag Name</label>
                    <input
                      type="text"
                      value={newTag.name}
                      onChange={(e) => setNewTag({...newTag, name: e.target.value})}
                      placeholder="Enter tag name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <input
                      type="color"
                      value={newTag.color}
                      onChange={(e) => setNewTag({...newTag, color: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description (Optional)</label>
                  <input
                    type="text"
                    value={newTag.description}
                    onChange={(e) => setNewTag({...newTag, description: e.target.value})}
                    placeholder="Enter tag description"
                  />
                </div>
                <div className="form-actions">
                  {isEditingTag ? (
                    <>
                      <button className="btn-secondary" onClick={cancelEditTag}>
                        Cancel
                      </button>
                      <button className="btn-primary" onClick={updateTag}>
                        <Save size={16} />
                        Update Tag
                      </button>
                    </>
                  ) : (
                    <button className="btn-primary" onClick={createTag}>
                      <Plus size={16} />
                      Add Tag
                    </button>
                  )}
                </div>
              </div>
              <div className="categories-list">
                <h3>Existing Tags</h3>
                {tags.map(tag => (
                  <div key={tag.id} className="category-item">
                    <div className="category-info">
                      <span 
                        className="tag-badge"
                        style={{ 
                          backgroundColor: tag.color + '20', 
                          borderColor: tag.color,
                          color: tag.color 
                        }}
                      >
                        {tag.name}
                      </span>
                      {tag.description && (
                        <span className="tag-description">{tag.description}</span>
                      )}
                    </div>
                    <div className="category-actions">
                      <button 
                        className="btn-icon small edit"
                        onClick={() => startEditTag(tag)}
                        title="Edit tag"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        className="btn-icon small delete"
                        onClick={() => deleteTag(tag.id!)}
                        title="Delete tag"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialReaderEnhanced;