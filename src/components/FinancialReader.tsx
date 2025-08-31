import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Plus, X } from 'lucide-react';
import pdfToText from 'react-pdftotext';

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

const FinancialReader: React.FC = () => {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseBankStatement = (text: string): ParsedStatement => {
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

    // New approach: Split the entire text by monetary amounts first, then assign dates
    // This handles RBC's format where multiple transactions can be grouped by date
    
    // Step 1: Extract all monetary amounts and their positions
    const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
    const amounts: { amount: string, index: number }[] = [];
    let match;
    
    while ((match = amountPattern.exec(text)) !== null) {
      amounts.push({
        amount: match[1],
        index: match.index
      });
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Found', amounts.length, 'monetary amounts in the text');
    }
    
    // Step 2: For each amount, find the transaction description that precedes it
    for (let i = 0; i < amounts.length; i++) {
      const currentAmount = amounts[i];
      const nextAmount = amounts[i + 1];
      
      // Extract the text segment before this amount
      const endPos = currentAmount.index;
      const startPos = i > 0 ? amounts[i - 1].index + amounts[i - 1].amount.length : 0;
      
      const segment = text.substring(startPos, endPos + currentAmount.amount.length);
      
      // Find the most recent date before this amount
      const datePattern = /(\d{1,2}\s+\w{3})/g;
      const dates: { date: string, index: number }[] = [];
      let dateMatch;
      
      while ((dateMatch = datePattern.exec(segment)) !== null) {
        dates.push({
          date: dateMatch[1],
          index: dateMatch.index
        });
      }
      
      // Get the last date found (closest to the amount)
      const relevantDate = dates.length > 0 ? dates[dates.length - 1].date : null;
      
      if (relevantDate) {
        // Extract description between the date and the amount
        const lastDateIndex = dates[dates.length - 1].index;
        const descriptionStart = lastDateIndex + relevantDate.length;
        const descriptionEnd = segment.length - currentAmount.amount.length;
        
        let description = segment.substring(descriptionStart, descriptionEnd).trim();
        
        // Clean up the description
        description = description.replace(/\s+/g, ' ').trim();
        
        // Skip if this looks like a balance or total line
        if (description.toLowerCase().includes('balance') ||
            description.toLowerCase().includes('total') ||
            description.toLowerCase().includes('opening') ||
            description.toLowerCase().includes('closing') ||
            description.length < 5) {
          continue;
        }
        
        // Check if there's a balance amount after this transaction amount
        // In RBC format, balance appears as the next amount if it's within reasonable distance
        let balanceAmount = null;
        if (nextAmount) {
          const distanceToNext = nextAmount.index - (currentAmount.index + currentAmount.amount.length);
          // Balance should be relatively close (within 50 characters) and not be another transaction amount
          if (distanceToNext < 50) {
            const textBetween = text.substring(currentAmount.index + currentAmount.amount.length, nextAmount.index);
            // If there's minimal text between amounts, it's likely a balance
            if (textBetween.trim().length < 20 && !textBetween.toLowerCase().includes('jun') && !textBetween.toLowerCase().includes('jul')) {
              balanceAmount = nextAmount.amount;
            }
          }
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Processing transaction:', {
            date: relevantDate,
            description: description.substring(0, 100),
            amount: currentAmount.amount,
            balance: balanceAmount
          });
        }
        
        // Add the transaction
        addRBCTransaction(relevantDate, description, currentAmount.amount, balanceAmount, statement);
      }
    }

    // Helper function to add RBC transactions
    function addRBCTransaction(dateStr: string, description: string, amountStr: string, balanceStr: string | null, statement: ParsedStatement) {
      // Determine if it's a debit or credit based on description
      let amount = parseFloat(amountStr.replace(/,/g, ''));
      const debitKeywords = [
        'fee', 'withdrawal', 'purchase', 'transfer sent', 'cheque', 
        'atm', 'interac', 'online transfer to', 'payment', 'online banking transfer'
      ];
      
      const isDebit = debitKeywords.some(keyword => 
        description.toLowerCase().includes(keyword)
      );
      
      if (isDebit) {
        amount = -Math.abs(amount); // Make it negative for debits
      } else {
        amount = Math.abs(amount); // Keep it positive for credits
      }
      
      // Parse and format date (RBC uses "02 Jun" format)
      let formattedDate: string;
      const currentYear = new Date().getFullYear();
      
      try {
        // Handle "02 Jun" format specifically
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const parts = dateStr.trim().split(/\s+/);
        
        if (parts.length === 2) {
          const day = parseInt(parts[0], 10);
          const monthStr = parts[1];
          const monthIndex = monthNames.indexOf(monthStr);
          
          if (monthIndex >= 0 && day >= 1 && day <= 31) {
            const month = monthIndex + 1;
            formattedDate = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          } else {
            throw new Error('Invalid date format');
          }
        } else {
          throw new Error('Unrecognized date format');
        }
      } catch (dateError) {
        // If date parsing fails, skip this transaction
        console.warn(`Skipping transaction due to invalid date: "${dateStr}"`, dateError);
        return;
      }
      
      // Parse balance
      const balance = balanceStr ? parseFloat(balanceStr.replace(/,/g, '')) : undefined;
      
      // Add transaction to statement
      statement.transactions.push({
        date: formattedDate,
        description: description.trim(),
        amount: amount,
        balance: balance
      });
    }

    return statement;
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
      setExtractedText(text); // Store for debugging
      const parsedStatement = parseBankStatement(text);
      
      if (parsedStatement.transactions.length === 0) {
        setError(`No transactions found in the PDF. Please check the format or use manual entry.${process.env.NODE_ENV === 'development' ? ' (Check console for extracted text)' : ''}`);
        if (process.env.NODE_ENV === 'development') {
          console.log('Extracted PDF text:', text);
        }
        setShowManualEntry(true);
      } else {
        setParsedData(parsedStatement);
        setShowManualEntry(true); // Still show manual entry for additional transactions
      }
    } catch (error) {
      console.error('Error parsing PDF:', error);
      setError('Failed to parse PDF. Please try again or use manual entry.');
      setShowManualEntry(true);
    } finally {
      setIsLoading(false);
    }
  };

  const addManualTransaction = () => {
    if (!manualTransaction.description || manualTransaction.amount === 0) {
      setError('Please fill in all transaction fields');
      return;
    }

    const newParsedData: ParsedStatement = parsedData || {
      bankName: 'Manual Entry',
      accountNumber: 'Manual',
      statementPeriod: 'Manual Entry Session',
      transactions: []
    };

    newParsedData.transactions.push({ ...manualTransaction });
    setParsedData({ ...newParsedData });
    
    // Reset form
    setManualTransaction({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: 0
    });
    setError(null);
  };

  const removeTransaction = (index: number) => {
    if (parsedData) {
      const updatedTransactions = parsedData.transactions.filter((_, i) => i !== index);
      setParsedData({
        ...parsedData,
        transactions: updatedTransactions
      });
    }
  };

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
        
        // Create a proper ChangeEvent
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
          <p>Upload PDF bank statements to extract transaction data</p>
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
          <p className="upload-subtitle">Supports RBC, TD, Scotiabank and other Canadian banks<br/>Automatically splits multi-transaction lines</p>
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
              Extracting transactions from PDF...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Manual Entry Section */}
        {(showManualEntry || parsedData) && (
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

        {/* Results State */}
        {parsedData && (
          <div className="results-section">
            <div className="success-message">
              <CheckCircle size={20} />
              <span>
                Successfully parsed {parsedData.transactions.length} transactions
              </span>
            </div>

            {/* Statement Info */}
            <div className="statement-info">
              <h3>Statement Information</h3>
              <div className="info-grid">
                {parsedData.bankName && (
                  <div className="info-item">
                    <span className="info-label">Bank:</span>
                    <p className="info-value">{parsedData.bankName}</p>
                  </div>
                )}
                {parsedData.accountNumber && (
                  <div className="info-item">
                    <span className="info-label">Account:</span>
                    <p className="info-value">****{parsedData.accountNumber.slice(-4)}</p>
                  </div>
                )}
                {parsedData.statementPeriod && (
                  <div className="info-item">
                    <span className="info-label">Period:</span>
                    <p className="info-value">{parsedData.statementPeriod}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transactions Table */}
            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.transactions.map((transaction, index) => (
                    <tr key={index}>
                      <td>{transaction.date}</td>
                      <td>{transaction.description}</td>
                      <td className="amount-cell">
                        <span className={transaction.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                          ${Math.abs(transaction.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="balance-cell">
                        {transaction.balance ? `$${transaction.balance.toFixed(2)}` : '-'}
                      </td>
                      <td className="actions-cell">
                        <button 
                          className="btn-icon small delete"
                          onClick={() => removeTransaction(index)}
                          title="Remove transaction"
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
    </div>
  );
};

export default FinancialReader;