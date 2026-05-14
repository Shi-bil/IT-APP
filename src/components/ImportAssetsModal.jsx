import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, Loader2, ChevronDown, Eye, Settings2, Zap, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { assetService } from '../services/assetService';

// Field definitions for mapping
const SYSTEM_FIELDS = [
  { key: 'name', label: 'Name', required: true, description: 'Asset name' },
  { key: 'serialNumber', label: 'Serial Number', required: false, description: 'Unique identifier' },
  { key: 'status', label: 'Status', required: false, description: 'using, free, maintenance, retired' },
  { key: 'quantity', label: 'Quantity', required: false, description: 'Number of assets' },
  { key: 'remark', label: 'Remark', required: false, description: 'Additional notes' },
  { key: 'userName', label: 'User Name', required: false, description: 'Required when status is "using"' },
  { key: 'simType', label: 'SIM Type', required: false, description: 'postpaid or prepaid' },
  { key: 'plan', label: 'Plan', required: false, description: 'SIM plan name' },
];

// Common header variations for auto-detection
const HEADER_MAPPINGS = {
  name: ['name', 'assetname', 'asset name', 'asset_name', 'item', 'item name', 'itemname', 'product', 'product name', 'title', 'device', 'device name'],
  serialNumber: ['serialnumber', 'serial number', 'serial_number', 'serial', 'sn', 's/n', 'serial no', 'serialno', 'imei', 'mac', 'mac address'],
  status: ['status', 'state', 'condition', 'asset status', 'assetstatus'],
  quantity: ['quantity', 'qty', 'amount', 'count', 'number', 'units'],
  remark: ['remark', 'remarks', 'note', 'notes', 'comment', 'comments', 'description', 'desc', 'memo'],
  userName: ['username', 'user name', 'user_name', 'user', 'assigned to', 'assignedto', 'assigned', 'owner', 'holder', 'employee', 'employee name'],
  simType: ['simtype', 'sim type', 'sim_type', 'type', 'sim category', 'category'],
  plan: ['plan', 'planname', 'plan name', 'plan_name', 'package', 'subscription', 'tariff'],
};

const ImportAssetsModal = ({ onClose, onImportComplete, categories }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(1); // Which row contains headers (1-based)
  const [sheetPreviewRows, setSheetPreviewRows] = useState([]); // First few rows for preview
  const [parsedData, setParsedData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [validationWarning, setValidationWarning] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [defaultQuantity, setDefaultQuantity] = useState(1);
  const [defaultStatus, setDefaultStatus] = useState('auto'); // 'auto', 'using', 'free', 'maintenance', 'retired'
  const [excludedRows, setExcludedRows] = useState(new Set()); // Row numbers to exclude from import
  const [selectedPreviewRows, setSelectedPreviewRows] = useState(new Set()); // Selected rows for bulk actions
  const fileInputRef = useRef(null);

  // Auto-detect column mapping based on headers
  const autoDetectMapping = (headers) => {
    const mapping = {};
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    SYSTEM_FIELDS.forEach(field => {
      const possibleNames = HEADER_MAPPINGS[field.key] || [];
      
      // Find matching header
      const matchIndex = normalizedHeaders.findIndex(header => 
        possibleNames.some(name => header === name || header.includes(name))
      );
      
      if (matchIndex !== -1) {
        mapping[field.key] = headers[matchIndex];
      } else {
        mapping[field.key] = '';
      }
    });
    
    return mapping;
  };

  // Helper function to convert Excel date serial number to date string
  const excelDateToString = (value) => {
    // Check if it's a number that looks like an Excel date serial
    // Excel dates are typically between 1 (Jan 1, 1900) and ~50000+ (year 2037+)
    if (typeof value === 'number' && value > 0 && value < 100000) {
      try {
        // Excel's epoch is December 30, 1899
        // But there's a bug in Excel that thinks 1900 was a leap year, so we adjust
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
        
        // Check if it's a reasonable date (between year 1950 and 2100)
        const year = date.getFullYear();
        if (year >= 1950 && year <= 2100) {
          // Format as DD-MM-YYYY
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          return `${day}-${month}-${year}`;
        }
      } catch (e) {
        // If conversion fails, return as-is
      }
    }
    return value;
  };

  // Helper to process text values that might contain Excel dates
  const processTextValue = (value) => {
    if (value === null || value === undefined) return '';
    
    // Convert to string first
    let strValue = String(value);
    
    // If it's a number, try to convert as Excel date
    if (typeof value === 'number') {
      const converted = excelDateToString(value);
      if (converted !== value) {
        return converted;
      }
    }
    
    return strValue;
  };

  // Apply column mapping to raw data
  const applyMapping = (data, mapping, defQty = defaultQuantity, defStatus = defaultStatus) => {
    return data.map((row, index) => {
      const getValue = (fieldKey) => {
        const columnName = mapping[fieldKey];
        if (!columnName) return '';
        return row[columnName] || '';
      };
      
      // Get value and process for potential Excel dates
      const getProcessedValue = (fieldKey) => {
        const value = getValue(fieldKey);
        return processTextValue(value);
      };
      
      // Get quantity value, use default if not provided or is 0
      const rawQuantity = getValue('quantity');
      const quantity = rawQuantity !== '' && Number(rawQuantity) > 0 
        ? Number(rawQuantity) 
        : defQty;
      
      // Get userName
      const userName = getProcessedValue('userName');
      
      // Get status value with smart defaults
      const rawStatus = getValue('status').toString().toLowerCase();
      let status;
      
      if (rawStatus && ['using', 'free', 'maintenance', 'retired'].includes(rawStatus)) {
        // Use the status from Excel if it's valid
        status = rawStatus;
      } else if (defStatus === 'auto') {
        // Auto mode: if userName exists, set to 'using', otherwise 'free'
        status = userName && userName.trim() !== '' ? 'using' : 'free';
      } else {
        // Use the selected default status
        status = defStatus;
      }
      
      // Get plan and simType values
      const plan = getProcessedValue('plan');
      let simType = getProcessedValue('simType').toString().toLowerCase();
      
      // Auto-detect SIM Type based on Plan if simType is not provided
      // If plan contains numbers (like 100, 200, 325) → postpaid
      // If plan is "prepaid" or no numbers → prepaid
      if (!simType && plan) {
        const planStr = String(plan).toLowerCase().trim();
        if (planStr === 'prepaid') {
          simType = 'prepaid';
        } else if (/\d+/.test(planStr)) {
          simType = 'postpaid';
        } else {
          simType = 'prepaid';
        }
      }
      
      return {
        name: getProcessedValue('name'),
        serialNumber: getProcessedValue('serialNumber'),
        status: status,
        quantity: quantity,
        remark: getProcessedValue('remark'),
        userName: userName,
        simType: simType,
        plan: plan,
        rowNumber: index + 2
      };
    });
  };

  // Re-apply mapping when it changes
  useEffect(() => {
    if (rawData.length > 0 && Object.keys(columnMapping).length > 0) {
      const mapped = applyMapping(rawData, columnMapping, defaultQuantity, defaultStatus);
      setParsedData(mapped);
      validateDuplicates(mapped);
    }
  }, [columnMapping, defaultQuantity, defaultStatus]);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      loadExcelFile(selectedFile);
    }
  };

  // Load Excel file and detect sheets
  const loadExcelFile = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        // Auto-select first sheet if only one, otherwise let user choose
        if (wb.SheetNames.length === 1) {
          setSelectedSheet(wb.SheetNames[0]);
          loadSheetPreview(wb, wb.SheetNames[0]);
        } else {
          // Multiple sheets - let user select
          setSelectedSheet('');
          setParsedData([]);
          setRawData([]);
          setExcelHeaders([]);
          setColumnMapping({});
          setShowPreview(false);
          setShowColumnMapping(false);
        }
        
        setError('');
      } catch (err) {
        setError('Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file.');
        setWorkbook(null);
        setSheetNames([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle sheet selection
  const handleSheetSelect = (sheetName) => {
    setSelectedSheet(sheetName);
    setHeaderRow(1); // Reset header row when changing sheets
    setExcludedRows(new Set()); // Reset excluded rows when changing sheets
    setSelectedPreviewRows(new Set());
    if (workbook && sheetName) {
      loadSheetPreview(workbook, sheetName);
    }
  };

  // Load sheet preview (first 10 rows as arrays for header selection)
  const loadSheetPreview = (wb, sheetName) => {
    try {
      const sheet = wb.Sheets[sheetName];
      // Get all data as array of arrays (no header processing)
      const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      if (allRows.length === 0) {
        setError(`No data found in sheet "${sheetName}".`);
        setSheetPreviewRows([]);
        return;
      }
      
      // Store first 10 rows for preview
      setSheetPreviewRows(allRows.slice(0, 10));
      setError('');
      
      // Auto-detect header row (first row with non-empty cells that look like headers)
      let detectedHeaderRow = 1;
      for (let i = 0; i < Math.min(5, allRows.length); i++) {
        const row = allRows[i];
        const nonEmptyCells = row.filter(cell => cell !== '' && cell !== null && cell !== undefined);
        // If row has multiple non-empty cells and they look like text (not just numbers)
        if (nonEmptyCells.length >= 2) {
          const textCells = nonEmptyCells.filter(cell => 
            typeof cell === 'string' && isNaN(Number(cell))
          );
          if (textCells.length >= 2) {
            detectedHeaderRow = i + 1;
            break;
          }
        }
      }
      setHeaderRow(detectedHeaderRow);
      
      // Parse with detected header row
      parseSheetWithHeader(wb, sheetName, detectedHeaderRow);
    } catch (err) {
      setError('Failed to load sheet preview.');
      setSheetPreviewRows([]);
    }
  };

  // Handle header row change
  const handleHeaderRowChange = (newHeaderRow) => {
    setHeaderRow(newHeaderRow);
    setExcludedRows(new Set()); // Reset excluded rows when changing header row
    setSelectedPreviewRows(new Set());
    if (workbook && selectedSheet) {
      parseSheetWithHeader(workbook, selectedSheet, newHeaderRow);
    }
  };

  // Parse selected sheet with specific header row
  const parseSheetWithHeader = async (wb, sheetName, headerRowNum) => {
    try {
      const sheet = wb.Sheets[sheetName];
      // Get all data as array of arrays
      const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      if (allRows.length < headerRowNum) {
        setError(`Header row ${headerRowNum} is beyond the data in the sheet.`);
        setParsedData([]);
        setRawData([]);
        setExcelHeaders([]);
        return;
      }
      
      // Get headers from the selected row (0-indexed)
      const headerRowData = allRows[headerRowNum - 1];
      
      // Clean up headers - replace empty cells with column letters
      const headers = headerRowData.map((h, idx) => {
        if (h === '' || h === null || h === undefined) {
          return `Column_${String.fromCharCode(65 + idx)}`; // Column_A, Column_B, etc.
        }
        return String(h).trim();
      });
      
      // Filter out completely empty columns and _EMPTY patterns
      const validHeaders = headers.filter(h => 
        h && !h.startsWith('_EMPTY') && !h.startsWith('__EMPTY')
      );
      
      // Get data rows (after header row)
      const dataRows = allRows.slice(headerRowNum);
      
      // Convert to JSON objects using headers
      const jsonData = dataRows
        .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined)) // Skip empty rows
        .map(row => {
          const obj = {};
          headers.forEach((header, idx) => {
            if (header && !header.startsWith('_EMPTY') && !header.startsWith('__EMPTY')) {
              obj[header] = row[idx] !== undefined ? row[idx] : '';
            }
          });
          return obj;
        });
      
      if (jsonData.length === 0) {
        setError(`No data found after header row ${headerRowNum}.`);
        setParsedData([]);
        setRawData([]);
        setExcelHeaders([]);
        return;
      }
      
      setExcelHeaders(validHeaders.length > 0 ? validHeaders : headers.filter(h => h));
      setRawData(jsonData);
      
      // Auto-detect column mapping
      const detectedMapping = autoDetectMapping(headers);
      setColumnMapping(detectedMapping);
      
      // Apply initial mapping
      const mappedData = applyMapping(jsonData, detectedMapping);
        setParsedData(mappedData);
        setError('');
      setShowPreview(true);
      setShowColumnMapping(true);
        
        // Validate for duplicates
        await validateDuplicates(mappedData);
      } catch (err) {
      setError('Failed to parse the selected sheet. Please ensure it has valid data.');
        setParsedData([]);
      setRawData([]);
      setExcelHeaders([]);
    }
  };

  // Update single column mapping
  const updateColumnMapping = (fieldKey, excelColumn) => {
    setColumnMapping(prev => ({
      ...prev,
      [fieldKey]: excelColumn
    }));
  };

  // Reset to auto-detected mapping
  const resetToAutoDetect = () => {
    const detectedMapping = autoDetectMapping(excelHeaders);
    setColumnMapping(detectedMapping);
  };

  const validateDuplicates = async (data) => {
    try {
      // Get all existing assets
      const result = await assetService.getAllAssets();
      if (!result.success) {
        setValidationWarning('Could not validate duplicates. Proceeding with caution.');
        return;
      }

      const existingAssets = result.assets || [];
      const existingSerialNumbers = new Set(
        existingAssets
          .map(asset => asset.serialNumber?.toLowerCase().trim())
          .filter(sn => sn && sn !== '')
      );

      // Check for duplicates in uploaded file
      const fileSerialNumbers = new Map();
      const fileDuplicates = [];
      
      data.forEach(item => {
        const sn = item.serialNumber?.toLowerCase().trim();
        if (sn && sn !== '') {
          if (fileSerialNumbers.has(sn)) {
            fileDuplicates.push({
              rowNumber: item.rowNumber,
              name: item.name,
              serialNumber: item.serialNumber,
              type: 'file',
              message: `Duplicate serial number in file (first seen at row ${fileSerialNumbers.get(sn)})`
            });
          } else {
            fileSerialNumbers.set(sn, item.rowNumber);
          }
        }
      });

      // Check against existing database
      const dbDuplicates = data
        .filter(item => {
          const sn = item.serialNumber?.toLowerCase().trim();
          return sn && sn !== '' && existingSerialNumbers.has(sn);
        })
        .map(item => ({
          rowNumber: item.rowNumber,
          name: item.name,
          serialNumber: item.serialNumber,
          type: 'database',
          message: 'Serial number already exists in database'
        }));

      const allDuplicates = [...fileDuplicates, ...dbDuplicates];
      setDuplicates(allDuplicates);

      if (allDuplicates.length > 0) {
        setValidationWarning(
          `Found ${allDuplicates.length} duplicate serial number(s). ` +
          `${fileDuplicates.length} in file, ${dbDuplicates.length} in database.`
        );
      } else {
        setValidationWarning('');
      }
    } catch (err) {
      console.error('Validation error:', err);
      setValidationWarning('Could not validate duplicates. Proceeding with caution.');
    }
  };

  const handleImport = async () => {
    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }
    
    if (parsedData.length === 0) {
      setError('No valid data to import');
      return;
    }
    
    // Validate that Name field is mapped
    if (!columnMapping.name) {
      setError('Name field mapping is required. Please configure column mapping.');
      setShowColumnMapping(true);
      return;
    }
    
    // Validate userName for items with status "using" (only non-excluded rows)
    const missingUserName = parsedData.filter(item => 
      !excludedRows.has(item.rowNumber) && item.status === 'using' && !item.userName?.trim()
    );
    
    if (missingUserName.length > 0) {
      setError(`User Name is required for ${missingUserName.length} item(s) with status "Using". Please update your Excel file, adjust column mapping, or exclude those rows.`);
      return;
    }

    setIsImporting(true);
    setError('');
    
    try {
      // Filter out excluded rows first
      let dataToImport = parsedData.filter(item => !excludedRows.has(item.rowNumber));
      
      if (dataToImport.length === 0) {
        setError('All rows have been excluded. Nothing to import.');
        setIsImporting(false);
        return;
      }
      
      // Filter out duplicates if skipDuplicates is enabled
      if (skipDuplicates && duplicates.length > 0) {
        const duplicateSerialNumbers = new Set(
          duplicates.map(d => d.serialNumber?.toLowerCase().trim())
        );
        
        dataToImport = dataToImport.filter(item => {
          const sn = item.serialNumber?.toLowerCase().trim();
          return !sn || sn === '' || !duplicateSerialNumbers.has(sn);
        });
        
        if (dataToImport.length === 0) {
          setError('All remaining items have duplicate serial numbers. Nothing to import.');
          setIsImporting(false);
          return;
        }
      }
      
      const result = await assetService.importAssets(dataToImport, selectedCategory);
      
      if (result.success) {
        // Add skipped duplicates to the results
        if (skipDuplicates && duplicates.length > 0) {
          result.results.skipped = duplicates.length;
          result.results.duplicates = duplicates;
        }
        
        setImportResults(result.results);
        if (result.results.successful > 0) {
          onImportComplete();
        }
      } else {
        setError(result.error || 'Import failed');
      }
    } catch (err) {
      setError('An unexpected error occurred during import');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Check if selected category is SIMs
    const selectedCat = categories.find(c => c.id === selectedCategory);
    const isSIMCategory = selectedCat?.name?.toLowerCase().includes('sim');
    
    let templateData;
    
    if (isSIMCategory) {
      // SIM-specific template
      templateData = [
        {
          Name: 'Example SIM 1',
          SerialNumber: 'SIM12345',
          Status: 'free',
          UserName: '',
          'SIM Type': 'postpaid',
          Plan: 'Business Plan 100GB',
          Quantity: 1,
          Remark: 'SIM Type: postpaid or prepaid'
        },
        {
          Name: 'Example SIM 2',
          SerialNumber: 'SIM67890',
          Status: 'using',
          UserName: 'John Doe',
          'SIM Type': 'prepaid',
          Plan: 'Prepaid 50GB',
          Quantity: 1,
          Remark: 'User Name is required when Status is "using"'
        }
      ];
    } else {
      // General asset template
      templateData = [
        {
          Name: 'Example Laptop',
          SerialNumber: 'SN12345',
          Status: 'free',
          UserName: '',
          Quantity: 1,
          Remark: 'Sample remark'
        },
        {
          Name: 'Example Mobile',
          SerialNumber: 'SN67890',
          Status: 'using',
          UserName: 'John Doe',
          Quantity: 1,
          Remark: 'User Name is required when Status is "using"'
        }
      ];
    }
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, `${isSIMCategory ? 'sim' : 'asset'}_import_template.xlsx`);
  };

  const handleReset = () => {
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setHeaderRow(1);
    setSheetPreviewRows([]);
    setParsedData([]);
    setRawData([]);
    setExcelHeaders([]);
    setColumnMapping({});
    setShowColumnMapping(false);
    setImportResults(null);
    setError('');
    setDuplicates([]);
    setValidationWarning('');
    setSkipDuplicates(true);
    setShowPreview(false);
    setDefaultQuantity(1);
    setDefaultStatus('auto');
    setExcludedRows(new Set());
    setSelectedPreviewRows(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get mapping status for a field
  const getMappingStatus = (fieldKey) => {
    const mapping = columnMapping[fieldKey];
    if (!mapping) return 'unmapped';
    
    // Check if auto-detected
    const autoDetected = autoDetectMapping(excelHeaders);
    if (autoDetected[fieldKey] === mapping) return 'auto';
    return 'manual';
  };

  // Count how many fields are mapped
  const getMappedFieldsCount = () => {
    return Object.values(columnMapping).filter(v => v && v !== '').length;
  };

  // Toggle row selection for preview
  const toggleRowSelection = (rowNumber) => {
    setSelectedPreviewRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowNumber)) {
        newSet.delete(rowNumber);
      } else {
        newSet.add(rowNumber);
      }
      return newSet;
    });
  };

  // Select all rows in preview (excluding already excluded rows)
  const selectAllRows = () => {
    const allRowNumbers = parsedData
      .filter(item => !excludedRows.has(item.rowNumber))
      .map(item => item.rowNumber);
    setSelectedPreviewRows(new Set(allRowNumbers));
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedPreviewRows(new Set());
  };

  // Exclude selected rows
  const excludeSelectedRows = () => {
    setExcludedRows(prev => {
      const newSet = new Set(prev);
      selectedPreviewRows.forEach(rowNum => newSet.add(rowNum));
      return newSet;
    });
    setSelectedPreviewRows(new Set());
  };

  // Include (un-exclude) a row
  const includeRow = (rowNumber) => {
    setExcludedRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(rowNumber);
      return newSet;
    });
  };

  // Include all excluded rows
  const includeAllRows = () => {
    setExcludedRows(new Set());
  };

  // Get count of rows that will be imported (excluding duplicates and excluded rows)
  const getImportableRowsCount = () => {
    let count = parsedData.filter(item => !excludedRows.has(item.rowNumber)).length;
    if (skipDuplicates && duplicates.length > 0) {
      const duplicateRows = new Set(duplicates.map(d => d.rowNumber));
      count = parsedData.filter(item => 
        !excludedRows.has(item.rowNumber) && !duplicateRows.has(item.rowNumber)
      ).length;
    }
    return count;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'using': return 'text-green-400';
      case 'free': return 'text-blue-400';
      case 'maintenance': return 'text-yellow-400';
      case 'retired': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="glass-morphism bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative animate-fade-up">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1">
                Import Assets from Excel
              </h2>
              <p className="text-slate-400 text-sm">Upload an Excel file to import multiple assets at once</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {importResults ? (
            <div className="space-y-4">
              <div className="glass-morphism p-6 rounded-xl border border-slate-700/30">
                <div className="flex items-center space-x-3 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                  <h3 className="text-xl font-semibold text-white">Import Complete</h3>
                </div>
                
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-cyan-400">{importResults.total}</p>
                    <p className="text-sm text-slate-400">Total Records</p>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                    <p className="text-2xl font-bold text-green-400">{importResults.successful}</p>
                    <p className="text-sm text-slate-400">Successful</p>
                  </div>
                  {importResults.skipped > 0 && (
                    <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                      <p className="text-2xl font-bold text-yellow-400">{importResults.skipped}</p>
                      <p className="text-sm text-slate-400">Skipped (Duplicates)</p>
                    </div>
                  )}
                  <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                    <p className="text-2xl font-bold text-red-400">{importResults.failed}</p>
                    <p className="text-sm text-slate-400">Failed</p>
                  </div>
                </div>

                {importResults.duplicates && importResults.duplicates.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-yellow-400 mb-2">Skipped Duplicates:</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {importResults.duplicates.map((dup, index) => (
                        <div key={index} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                          <p className="text-sm text-yellow-300">
                            <span className="font-semibold">Row {dup.rowNumber}:</span> {dup.name} ({dup.serialNumber}) - {dup.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResults.errors && importResults.errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-red-400 mb-2">Import Errors:</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {importResults.errors.map((error, index) => (
                        <div key={index} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                          <p className="text-sm text-red-300">
                            <span className="font-semibold">Row {error.row}:</span> {error.name} - {error.error}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleReset}
                  className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                >
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Category Selection - Always visible */}
              <div className="glass-morphism p-6 rounded-xl border border-slate-700/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold mr-3">1</span>
                  Select Category
                </h3>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setShowPreview(false);
                  }}
                  className="input-field w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
                  disabled={isImporting}
                >
                  <option value="">Choose a category...</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">All imported assets will be added to this category</p>
                
                {!selectedCategory && (
                  <div className="mt-4 p-3 bg-slate-800/50 border border-slate-600/30 rounded-lg">
                    <p className="text-sm text-slate-400 text-center">
                      Please select a category to continue with import
                    </p>
                    </div>
                )}
              </div>

              {/* Step 2: Upload Section - Only visible after category selection */}
              {selectedCategory && (
                <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold mr-3">2</span>
                  Upload Excel File
                </h3>
                
                    {/* Download Template Button - On the side */}
                  <button
                    onClick={handleDownloadTemplate}
                      className="btn-secondary backdrop-blur-sm hover:scale-[1.02] transition-all flex items-center space-x-2 px-4 py-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Template</span>
                  </button>
                  </div>
                  
                  {/* User Name Requirement Info */}
                  <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-cyan-300">
                        <span className="font-semibold">Important:</span> When Status is "Using", User Name is <span className="font-semibold">required</span>. Make sure to include the user's name in the UserName column for all assets with "using" status.
                      </div>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div
                    onClick={() => !isImporting && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      file 
                        ? 'border-green-500/50 bg-green-500/5' 
                        : 'border-slate-600 hover:border-cyan-500/50 hover:bg-slate-800/30'
                    } ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isImporting}
                    />
                    {file ? (
                      <div className="space-y-2">
                        <FileSpreadsheet className="w-12 h-12 text-green-400 mx-auto" />
                        <p className="text-green-400 font-semibold">{file.name}</p>
                        {sheetNames.length > 1 ? (
                          <p className="text-sm text-cyan-400">{sheetNames.length} sheets found</p>
                        ) : parsedData.length > 0 ? (
                        <p className="text-sm text-slate-400">{parsedData.length} records found</p>
                        ) : null}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReset();
                          }}
                          className="text-xs text-slate-400 hover:text-red-400 underline mt-2"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                        <p className="text-slate-300 font-semibold">Click to upload Excel file</p>
                        <p className="text-sm text-slate-400">Supports .xlsx and .xls formats</p>
                      </div>
                    )}
                  </div>

                  {/* Sheet Selection - When multiple sheets exist */}
                  {sheetNames.length > 1 && (
                    <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-3">
                        <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-white">Select Sheet</span>
                        <span className="text-xs text-slate-400">({sheetNames.length} sheets available)</span>
                  </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {sheetNames.map((sheetName, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSheetSelect(sheetName)}
                            className={`px-3 py-2 rounded-lg text-sm transition-all text-left truncate ${
                              selectedSheet === sheetName
                                ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-300'
                                : 'bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:border-cyan-500/50 hover:bg-slate-700'
                            }`}
                            title={sheetName}
                          >
                            <span className="flex items-center space-x-2">
                              <span className="w-5 h-5 flex items-center justify-center rounded bg-slate-600/50 text-xs">
                                {idx + 1}
                              </span>
                              <span className="truncate">{sheetName}</span>
                            </span>
                          </button>
                        ))}
                </div>
                      
                      {selectedSheet && parsedData.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            Selected: <span className="text-cyan-400 font-medium">{selectedSheet}</span>
                          </span>
                          <span className="text-xs text-green-400">
                            {parsedData.length} records found
                          </span>
              </div>
                      )}
                    </div>
                  )}

                  {/* Header Row Selection - When sheet has data */}
                  {selectedSheet && sheetPreviewRows.length > 0 && (
                    <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-white">Header Row</span>
                          <span className="text-xs text-slate-400">(which row contains column names)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="text-xs text-slate-400">Row:</label>
                          <select
                            value={headerRow}
                            onChange={(e) => handleHeaderRowChange(Number(e.target.value))}
                            className="bg-slate-700/50 border border-slate-600/50 rounded px-2 py-1 text-sm text-white focus:border-cyan-500 focus:outline-none"
                          >
                            {sheetPreviewRows.map((_, idx) => (
                              <option key={idx} value={idx + 1}>Row {idx + 1}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {/* Preview of first rows */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <tbody>
                            {sheetPreviewRows.slice(0, 5).map((row, rowIdx) => (
                              <tr 
                                key={rowIdx}
                                className={`${
                                  rowIdx + 1 === headerRow 
                                    ? 'bg-cyan-500/20 border-2 border-cyan-500' 
                                    : rowIdx + 1 < headerRow 
                                      ? 'bg-slate-700/30 opacity-50' 
                                      : 'bg-slate-800/30'
                                }`}
                              >
                                <td className="px-2 py-1 border border-slate-600/30 text-slate-400 font-mono w-12">
                                  {rowIdx + 1}
                                  {rowIdx + 1 === headerRow && (
                                    <span className="ml-1 text-cyan-400 text-[10px]">HDR</span>
                                  )}
                                </td>
                                {row.slice(0, 8).map((cell, cellIdx) => (
                                  <td 
                                    key={cellIdx}
                                    className={`px-2 py-1 border border-slate-600/30 max-w-[120px] truncate ${
                                      rowIdx + 1 === headerRow ? 'text-cyan-300 font-medium' : 'text-slate-300'
                                    }`}
                                    title={String(cell)}
                                  >
                                    {cell === '' || cell === null || cell === undefined 
                                      ? <span className="text-slate-500 italic">empty</span>
                                      : String(cell)
                                    }
                                  </td>
                                ))}
                                {row.length > 8 && (
                                  <td className="px-2 py-1 border border-slate-600/30 text-slate-500">
                                    +{row.length - 8} more
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <p className="text-xs text-slate-500 mt-2">
                        Row {headerRow} will be used as column headers. Rows before it will be skipped.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons - Below upload area when file is loaded */}
                  {parsedData.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => setShowColumnMapping(!showColumnMapping)}
                        className={`backdrop-blur-sm hover:scale-[1.02] transition-all flex items-center space-x-2 px-5 py-2.5 rounded-lg border ${
                          showColumnMapping 
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' 
                            : 'bg-slate-800/50 border-slate-600/50 text-slate-300 hover:border-purple-500/50'
                        }`}
                      >
                        <Settings2 className="w-4 h-4" />
                        <span>Column Mapping</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          getMappedFieldsCount() >= 1 ? 'bg-green-500/30 text-green-300' : 'bg-yellow-500/30 text-yellow-300'
                        }`}>
                          {getMappedFieldsCount()}/{SYSTEM_FIELDS.length}
                        </span>
                      </button>
                      
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`backdrop-blur-sm hover:scale-[1.02] transition-all flex items-center space-x-2 px-5 py-2.5 rounded-lg border ${
                          showPreview 
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' 
                            : 'bg-slate-800/50 border-slate-600/50 text-slate-300 hover:border-cyan-500/50'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
                        <span className="bg-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full text-xs">
                          {parsedData.length}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Column Mapping Section */}
              {selectedCategory && excelHeaders.length > 0 && showColumnMapping && (
                <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                      <Settings2 className="w-5 h-5 text-purple-400 mr-2" />
                      Column Mapping
                    </h3>
                    <button
                      onClick={resetToAutoDetect}
                      className="flex items-center space-x-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset to Auto-Detect</span>
                    </button>
                  </div>
                  
                  {/* Auto-detection notice */}
                  <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Zap className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-purple-300">
                        <span className="font-semibold">Auto-Detection:</span> Columns have been automatically mapped based on header names. 
                        You can manually adjust any mapping using the dropdowns below.
                      </div>
                    </div>
                  </div>

                  {/* Detected Headers */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">Detected columns in your file:</p>
                    <div className="flex flex-wrap gap-2">
                      {excelHeaders.map((header, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-1 bg-slate-800/50 border border-slate-600/50 rounded text-xs text-slate-300"
                        >
                          {header}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Mapping Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SYSTEM_FIELDS.map(field => {
                      const status = getMappingStatus(field.key);
                      const isRequired = field.required;
                      const isMapped = columnMapping[field.key] && columnMapping[field.key] !== '';
                      
                      return (
                        <div 
                          key={field.key}
                          className={`p-3 rounded-lg border transition-all ${
                            !isMapped && isRequired
                              ? 'bg-red-500/5 border-red-500/30'
                              : isMapped
                                ? 'bg-green-500/5 border-green-500/30'
                                : 'bg-slate-800/30 border-slate-700/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-white">{field.label}</span>
                              {isRequired && (
                                <span className="text-xs text-red-400">*required</span>
                              )}
                            </div>
                            {isMapped && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                status === 'auto' 
                                  ? 'bg-purple-500/20 text-purple-300' 
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}>
                                {status === 'auto' ? 'Auto' : 'Manual'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mb-2">{field.description}</p>
                          <select
                            value={columnMapping[field.key] || ''}
                            onChange={(e) => updateColumnMapping(field.key, e.target.value)}
                            className={`w-full text-sm bg-slate-800/50 border rounded-lg px-3 py-2 transition-all focus:ring focus:ring-cyan-500/20 ${
                              !isMapped && isRequired
                                ? 'border-red-500/50 focus:border-red-500'
                                : isMapped
                                  ? 'border-green-500/50 focus:border-green-500'
                                  : 'border-slate-600/50 focus:border-cyan-500'
                            }`}
                          >
                            <option value="">-- Not Mapped --</option>
                            {excelHeaders.map((header, idx) => (
                              <option key={idx} value={header}>{header}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {/* Default Values Section */}
                  <div className="mt-4 pt-4 border-t border-slate-700/30">
                    <h4 className="text-sm font-medium text-white mb-3">Default Values</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Default Quantity */}
                      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                        <label className="text-sm text-slate-300 font-medium block mb-2">Default Quantity</label>
                        <div className="flex items-center">
                          <button
                            onClick={() => setDefaultQuantity(Math.max(0, defaultQuantity - 1))}
                            className="w-8 h-8 flex items-center justify-center bg-slate-700/50 border border-slate-600/50 rounded-l-lg text-slate-300 hover:bg-slate-600/50 transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={defaultQuantity}
                            onChange={(e) => setDefaultQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 h-8 text-center bg-slate-800/50 border-y border-slate-600/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                          <button
                            onClick={() => setDefaultQuantity(defaultQuantity + 1)}
                            className="w-8 h-8 flex items-center justify-center bg-slate-700/50 border border-slate-600/50 rounded-r-lg text-slate-300 hover:bg-slate-600/50 transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Applied when quantity is empty or 0
                        </p>
                      </div>
                      
                      {/* Default Status */}
                      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                        <label className="text-sm text-slate-300 font-medium block mb-2">Default Status</label>
                        <select
                          value={defaultStatus}
                          onChange={(e) => setDefaultStatus(e.target.value)}
                          className="w-full h-8 px-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="auto">Auto (based on User Name)</option>
                          <option value="using">Using</option>
                          <option value="free">Free</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="retired">Retired</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-2">
                          {defaultStatus === 'auto' 
                            ? 'If User Name exists → "Using", otherwise → "Free"'
                            : `Applied when status is not provided`
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mapping Summary */}
                  <div className="mt-4 pt-4 border-t border-slate-700/30">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <span className="text-slate-400">
                          Mapped: <span className="text-green-400 font-semibold">{getMappedFieldsCount()}</span>/{SYSTEM_FIELDS.length}
                        </span>
                        {!columnMapping.name && (
                          <span className="text-red-400 text-xs flex items-center space-x-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Name field is required</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                          <span className="text-slate-400">Auto-detected</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          <span className="text-slate-400">Manual</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Warning */}
              {selectedCategory && validationWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 animate-fade-in">
                  <div className="flex items-start space-x-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-yellow-300 text-sm font-semibold mb-2">{validationWarning}</p>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                          className="w-4 h-4 text-cyan-500 focus:ring-cyan-500 rounded"
                        />
                        <span className="text-sm text-slate-300">Skip duplicate items (recommended)</span>
                      </label>
                    </div>
                  </div>
                  
                  {duplicates.length > 0 && (
                    <div className="mt-3">
                      <details className="cursor-pointer">
                        <summary className="text-xs font-semibold text-yellow-400 mb-2 hover:text-yellow-300">
                          View {duplicates.length} duplicate(s)
                        </summary>
                        <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                          {duplicates.map((dup, index) => (
                            <div key={index} className="text-xs text-yellow-200 bg-yellow-500/5 rounded p-2">
                              Row {dup.rowNumber}: {dup.name} ({dup.serialNumber}) - {dup.message}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Preview Data - Only visible when showPreview is true */}
              {selectedCategory && parsedData.length > 0 && showPreview && (
                <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold mr-3">3</span>
                    Preview Data ({parsedData.length} records)
                      {excludedRows.size > 0 && (
                        <span className="ml-2 text-sm text-red-400">
                          ({excludedRows.size} excluded)
                      </span>
                    )}
                      <span className="ml-2 text-sm text-green-400">
                        ({getImportableRowsCount()} will be imported)
                      </span>
                  </h3>
                    
                    {/* Selection Controls */}
                    <div className="flex items-center space-x-2">
                      {selectedPreviewRows.size > 0 && (
                        <>
                          <span className="text-sm text-cyan-400">
                            {selectedPreviewRows.size} selected
                          </span>
                          <button
                            onClick={excludeSelectedRows}
                            className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg transition-colors flex items-center space-x-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Remove Selected</span>
                          </button>
                          <button
                            onClick={clearSelection}
                            className="px-3 py-1.5 text-xs bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 text-slate-300 rounded-lg transition-colors"
                          >
                            Clear Selection
                          </button>
                        </>
                      )}
                      {selectedPreviewRows.size === 0 && (
                        <button
                          onClick={selectAllRows}
                          className="px-3 py-1.5 text-xs bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 text-slate-300 rounded-lg transition-colors"
                        >
                          Select All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Excluded Rows Banner */}
                  {excludedRows.size > 0 && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <X className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-300">
                          <span className="font-semibold">{excludedRows.size}</span> row(s) excluded from import
                        </span>
                      </div>
                      <button
                        onClick={includeAllRows}
                        className="px-3 py-1.5 text-xs bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 text-slate-300 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Include All</span>
                      </button>
                    </div>
                  )}
                  
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/50 sticky top-0">
                        <tr>
                          <th className="text-center py-2 px-2 text-slate-300 font-medium w-10">
                            <input
                              type="checkbox"
                              checked={selectedPreviewRows.size === parsedData.filter(item => !excludedRows.has(item.rowNumber)).length && parsedData.filter(item => !excludedRows.has(item.rowNumber)).length > 0}
                              onChange={(e) => e.target.checked ? selectAllRows() : clearSelection()}
                              className="w-4 h-4 text-cyan-500 focus:ring-cyan-500 rounded border-slate-500"
                            />
                          </th>
                          <th className="text-left py-2 px-3 text-slate-300 font-medium">Row</th>
                          <th className="text-left py-2 px-3 text-slate-300 font-medium">Name</th>
                          <th className="text-left py-2 px-3 text-slate-300 font-medium">Serial Number</th>
                          <th className="text-left py-2 px-3 text-slate-300 font-medium">Status</th>
                          <th className="text-left py-2 px-3 text-slate-300 font-medium">User Name</th>
                          {parsedData.some(item => item.simType || item.plan) && (
                            <>
                              <th className="text-left py-2 px-3 text-slate-300 font-medium">SIM Type</th>
                              <th className="text-left py-2 px-3 text-slate-300 font-medium">Plan</th>
                            </>
                          )}
                          <th className="text-left py-2 px-3 text-slate-300 font-medium">Quantity</th>
                          <th className="text-left py-2 px-3 text-slate-300 font-medium">Remark</th>
                          <th className="text-center py-2 px-2 text-slate-300 font-medium w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {parsedData.slice(0, 100).map((item, index) => {
                          const isDuplicate = duplicates.some(
                            d => d.serialNumber?.toLowerCase() === item.serialNumber?.toLowerCase()
                          );
                          const willBeSkipped = isDuplicate && skipDuplicates;
                          const missingUserName = item.status === 'using' && !item.userName?.trim();
                          const isExcluded = excludedRows.has(item.rowNumber);
                          const isSelected = selectedPreviewRows.has(item.rowNumber);
                          
                          return (
                            <tr 
                              key={index} 
                              className={`hover:bg-slate-800/30 transition-colors ${
                                isExcluded ? 'opacity-40 bg-red-500/10 line-through' :
                                willBeSkipped ? 'opacity-50 bg-yellow-500/5' : 
                                missingUserName ? 'bg-red-500/5 border-l-2 border-red-500' :
                                isSelected ? 'bg-cyan-500/10' : ''
                              }`}
                            >
                              <td className="py-2 px-2 text-center">
                                {!isExcluded && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleRowSelection(item.rowNumber)}
                                    className="w-4 h-4 text-cyan-500 focus:ring-cyan-500 rounded border-slate-500"
                                  />
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {item.rowNumber}
                                {isExcluded && <span className="ml-2 text-xs text-red-400">🚫</span>}
                                {!isExcluded && willBeSkipped && <span className="ml-2 text-xs text-yellow-400">⚠️</span>}
                                {!isExcluded && missingUserName && <span className="ml-2 text-xs text-red-400">❌</span>}
                              </td>
                              <td className="py-2 px-3 text-white">{item.name || <span className="text-red-400">Missing</span>}</td>
                              <td className="py-2 px-3 text-slate-300">
                                {item.serialNumber || '-'}
                                {isDuplicate && <span className="ml-2 text-xs text-yellow-400">(duplicate)</span>}
                              </td>
                              <td className="py-2 px-3">
                                <span className={getStatusColor(item.status)}>{item.status || 'free'}</span>
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                {item.userName || '-'}
                                {item.status === 'using' && !item.userName && <span className="ml-2 text-xs text-red-400">(required)</span>}
                              </td>
                              {parsedData.some(i => i.simType || i.plan) && (
                                <>
                                  <td className="py-2 px-3 text-slate-300">
                                    {item.simType ? (
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        item.simType === 'postpaid' ? 'bg-blue-500/20 text-blue-300' :
                                        item.simType === 'prepaid' ? 'bg-purple-500/20 text-purple-300' :
                                        'bg-slate-500/20 text-slate-300'
                                      }`}>
                                        {item.simType}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-slate-300">{item.plan || '-'}</td>
                                </>
                              )}
                              <td className="py-2 px-3 text-slate-300">{item.quantity || 0}</td>
                              <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{item.remark || '-'}</td>
                              <td className="py-2 px-2 text-center">
                                {isExcluded ? (
                                  <button
                                    onClick={() => includeRow(item.rowNumber)}
                                    className="px-2 py-1 text-xs bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 rounded transition-colors"
                                    title="Include this row"
                                  >
                                    Include
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setExcludedRows(prev => {
                                        const newSet = new Set(prev);
                                        newSet.add(item.rowNumber);
                                        return newSet;
                                      });
                                      setSelectedPreviewRows(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(item.rowNumber);
                                        return newSet;
                                      });
                                    }}
                                    className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded transition-colors"
                                    title="Exclude this row"
                                  >
                                    Remove
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {parsedData.length > 100 && (
                      <p className="text-center text-sm text-slate-400 mt-2">
                        Showing first 100 of {parsedData.length} records
                      </p>
                    )}
                    
                    {/* Validation Summary */}
                    {(() => {
                      const missingUserNames = parsedData.filter(item => 
                        !excludedRows.has(item.rowNumber) && item.status === 'using' && !item.userName?.trim()
                      );
                      
                      if (missingUserNames.length > 0) {
                        return (
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-start space-x-3">
                              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-red-400">Validation Error</p>
                                <p className="text-sm text-red-300 mt-1">
                                  <span className="font-semibold">{missingUserNames.length}</span> item(s) with status "Using" are missing User Name. 
                                  You can exclude these rows or update your Excel file.
                                </p>
                                {missingUserNames.length <= 5 && (
                                  <ul className="mt-2 text-xs text-red-300 space-y-1">
                                    {missingUserNames.map((item, idx) => (
                                      <li key={idx} className="flex items-center justify-between">
                                        <span>• Row {item.rowNumber}: {item.name || 'Unnamed asset'}</span>
                                        <button
                                          onClick={() => {
                                            setExcludedRows(prev => {
                                              const newSet = new Set(prev);
                                              newSet.add(item.rowNumber);
                                              return newSet;
                                            });
                                          }}
                                          className="ml-2 px-2 py-0.5 text-xs bg-red-500/30 hover:bg-red-500/40 rounded text-red-200"
                                        >
                                          Exclude
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start space-x-3 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all"
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedCategory || parsedData.length === 0 || isImporting || getImportableRowsCount() === 0}
                  className={`btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 flex items-center space-x-2 ${
                    (!selectedCategory || parsedData.length === 0 || isImporting || getImportableRowsCount() === 0) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        Import {getImportableRowsCount()} Assets
                        {(excludedRows.size > 0 || (skipDuplicates && duplicates.length > 0)) && (
                          <span className="text-xs ml-1">
                            ({excludedRows.size > 0 && `${excludedRows.size} excluded`}
                            {excludedRows.size > 0 && skipDuplicates && duplicates.length > 0 && ', '}
                            {skipDuplicates && duplicates.length > 0 && `${duplicates.length} duplicates`})
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportAssetsModal;
