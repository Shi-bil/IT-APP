import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, Edit } from 'lucide-react';
import { exportService } from '../services/exportService';
import { assetService } from '../services/assetService';
import logo from '../assets/logo.png'; // Import the replaced logo image

const AssetView = ({ asset, onClose, categories }) => {
  const [loading, setLoading] = useState(false);
  const [assigneeDetails, setAssigneeDetails] = useState({
    name: asset?.assignee || 'N/A',
    email: '',
    department: '',
    phone: ''
  });
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [assetHistory, setAssetHistory] = useState([]);
  const [handoverDate, setHandoverDate] = useState(asset?.handedoverdate || null);
  const [remark, setRemark] = useState(asset.remark || '');
  const [handoverAdmin, setHandoverAdmin] = useState(asset?.assignedBy?.fullname || 'Admin');

  useEffect(() => {
    // In a real application, you would fetch these details from your API
    // This is a placeholder to simulate fetching user details
    if (asset && asset.assignee) {
      setAssigneeDetails({
        name: asset.assignee,
        email: `${asset.assignee.toLowerCase().replace(/\s+/g, '.')}@company.com`,
        department: 'IT Department',
        phone: phoneNumber || '05XXXXXXXX'
      });
      
      // Fetch asset history to get the real handover date
      fetchAssetHistory(asset.id);
    }
    setRemark(asset.remark || ''); // Reset remark when asset changes
  }, [asset, phoneNumber]);

  const fetchAssetHistory = async (assetId) => {
    setLoading(true);
    try {
      const result = await assetService.getAssetHistory(assetId);
      if (result.success) {
        setAssetHistory(result.history);
        
        // Find the most recent assignment record for the current assignee
        const assignmentRecords = result.history.filter(
          record => record.type === 'assignment' && 
                   record.assignedTo?.fullname === asset.assignee
        );
        
        if (assignmentRecords.length > 0) {
          // Sort by date descending to get the most recent
          assignmentRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setHandoverDate(assignmentRecords[0].handoverDate);
          setHandoverAdmin(assignmentRecords[0].assignedBy?.fullname || 'Admin');
        }
      }
    } catch (error) {
      console.error("Error fetching asset history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!asset) return null;
  
  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleExportDocx = () => {
    const category = getCategoryName(asset.categoryId).toLowerCase();
    const assetCode = getAssetCode();
    
    const data = [{
      Name: getAssetParticular(),
      AssetCode: assetCode,
      Category: getCategoryName(asset.categoryId),
      Status: asset.status === 'using' ? 'Using' : 
              asset.status === 'free' ? 'Free to Use' : 
              asset.status.charAt(0).toUpperCase() + asset.status.slice(1),
      AssignedTo: asset.assignee || 'N/A',
      HandoverDate: formatDate(handoverDate),
      Remarks: getAssetRemarks()
    }];
    
    exportService.exportToDocx(data, `asset_handover_${asset.id}`, `Asset Handover: ${asset.name}`);
  };

  const handlePhoneEdit = () => {
    setIsEditingPhone(true);
  };

  const handlePhoneSave = () => {
    setIsEditingPhone(false);
  };

  const getAssetParticular = () => {
    const category = getCategoryName(asset.categoryId).toLowerCase();
    if (category === 'sims') {
      return 'SIM Card';
    }
    return asset.name;
  };

  const getAssetRemarks = () => {
    return remark;
  };

  const getAssetCode = () => {
    // Use serial number as asset code for all asset types
    return asset.serialNumber || asset.id; // Fallback to ID if serial number is not available
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-4xl max-h-[90vh] overflow-auto print:shadow-none print:border print:border-black print:rounded-none print:max-h-none print:bg-white print:w-[794px] print:h-[1123px] print:max-w-none print:mx-auto print:overflow-visible p-2 sm:p-4 md:p-8"
        style={{ width: '100%', maxWidth: '794px', height: 'auto' }} // 794x1123px = 210x297mm at 96dpi
      >
        {/* Header with actions - hidden when printing */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700 print:hidden">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Asset Handover Form</h2>
          <div className="flex items-center space-x-3">
            {loading && <span className="text-slate-400">Loading history...</span>}
            <button 
              onClick={handlePrint}
              className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-white transition-colors hover:scale-110"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button 
              onClick={handleExportDocx}
              className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-blue-400 transition-colors hover:scale-110"
              title="Export to Word"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-red-400 transition-colors hover:scale-110"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Document Content */}
        <div className="p-8 print:p-2 print:text-black print:text-[12px] print:leading-tight print:overflow-visible" style={{ minHeight: '100%' }}>
          {/* Add two line spaces above the logo for print */}
          <div className="hidden print:block" style={{ height: '2em' }}></div>
          {/* Company Header */}
          <div className="mb-2 print:mb-2 flex items-start">
            <img 
              src={logo} 
              alt="Company Logo" 
              className="h-14 w-auto print:h-12" 
              style={{ minWidth: '48px' }}
            />
          </div>
          <div className="mb-8 print:mb-4 text-center">
            <h2 className="text-xl font-bold text-white print:text-black print:text-base uppercase">ASSET HANDOVER FORM</h2>
          </div>
          
          {/* Employee and Handover Details */}
          <div className="mb-8 print:mb-6">
            <table className="w-full border border-slate-700 print:border-black">
              <tbody>
                <tr>
                  <td className="border border-slate-700 print:border-black p-2 w-1/2">
                    <div>
                      <span className="font-bold">Name of Employee: </span>
                      {assigneeDetails.name}
                    </div>
                    <div>
                      <span className="font-bold">Email: </span>
                      {assigneeDetails.email}
                    </div>
                    <div>
                      <span className="font-bold">Department: </span>
                      {assigneeDetails.department}
                    </div>
                    <div className="flex items-center">
                      <span className="font-bold">Phone: </span>
                      {isEditingPhone ? (
                        <div className="flex items-center ml-1">
                          <input 
                            type="text" 
                            value={phoneNumber} 
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-600 px-2 py-1 rounded w-32 print:hidden"
                          />
                          <button 
                            onClick={handlePhoneSave}
                            className="ml-2 text-green-400 hover:text-green-300 print:hidden"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center ml-1">
                          <span>{assigneeDetails.phone}</span>
                          <button 
                            onClick={handlePhoneEdit}
                            className="ml-2 text-blue-400 hover:text-blue-300 print:hidden"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <span className="hidden print:inline">{assigneeDetails.phone}</span>
                    </div>
                  </td>
                  <td className="border border-slate-700 print:border-black p-2 w-1/2">
                    <div>
                      <span className="font-bold">Handover Date: </span>
                      {formatDate(handoverDate)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="font-bold">Assign For: </span>
                      <div className="flex items-center">
                        <input type="checkbox" className="mr-1" defaultChecked={true} />
                        <span>Permanent</span>
                      </div>
                      <div className="flex items-center ml-4">
                        <input type="checkbox" className="mr-1" />
                        <span>Temp</span>
                      </div>
                    </div>
                    <div className="mt-1">
                      <span className="font-bold">Return Date(if Temp): </span>
                    </div>
                    <div className="mt-1">
                      <span className="font-bold">Handover By: </span>
                      {handoverAdmin}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Introduction Text */}
          <div className="mb-4">
            <p className="text-white print:text-black">
              Dear Sir / Madam<br />
              Please find the below as the assets handed over to <strong>{assigneeDetails.name}</strong>, to support you in carrying out your assignment in a most Proficient manner.
            </p>
          </div>
          
          {/* Assets Table */}
          <div className="mb-8 print:mb-6">
            <table className="w-full border border-slate-700 print:border-black">
              <thead>
                <tr className="bg-slate-800 print:bg-gray-200">
                  <th className="border border-slate-700 print:border-black p-2 text-left">Sr. No.</th>
                  <th className="border border-slate-700 print:border-black p-2 text-left">Particulars</th>
                  <th className="border border-slate-700 print:border-black p-2 text-left">Asset Code</th>
                  <th className="border border-slate-700 print:border-black p-2 text-left">Qty</th>
                  <th className="border border-slate-700 print:border-black p-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-700 print:border-black p-2">1</td>
                  <td className="border border-slate-700 print:border-black p-2">{getAssetParticular()}</td>
                  <td className="border border-slate-700 print:border-black p-2">{getAssetCode()}</td>
                  <td className="border border-slate-700 print:border-black p-2">{asset.quantity || 1}</td>
                  <td className="border border-slate-700 print:border-black p-2">
                    <input
                      type="text"
                      value={remark}
                      onChange={e => setRemark(e.target.value)}
                      className="bg-slate-800 text-white border border-slate-600 px-2 py-1 rounded w-full print:hidden"
                    />
                    <span className="hidden print:inline">{remark}</span>
                  </td>
                </tr>
                {/* Empty rows for additional assets */}
                {[...Array(9)].map((_, index) => (
                  <tr key={index}>
                    <td className="border border-slate-700 print:border-black p-2">{index + 2}</td>
                    <td className="border border-slate-700 print:border-black p-2"></td>
                    <td className="border border-slate-700 print:border-black p-2"></td>
                    <td className="border border-slate-700 print:border-black p-2"></td>
                    <td className="border border-slate-700 print:border-black p-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Signature Section */}
          <div className="mb-8 print:mb-6">
            <table className="w-full border border-slate-700 print:border-black">
              <tbody>
                <tr>
                  <td className="border border-slate-700 print:border-black p-4 w-1/2">
                    <p className="font-bold mb-4">Authorized Signatory<br />(Employee)</p>
                    <div className="h-16"></div>
                  </td>
                  <td className="border border-slate-700 print:border-black p-4 w-1/2">
                    <p className="font-bold mb-4">Authorized Signatory<br />(Assigner)</p>
                    <div className="h-16"></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Acknowledgement Section */}
          <div className="mb-8 print:mb-6">
            <h3 className="text-lg font-bold text-white print:text-black mb-2">ACKNOWLEDGEMENT AND DECLARATION BY EMPLOYEE</h3>
            <p className="text-white print:text-black mb-4">
              I, Ms/Mr. <span className="underline">{assigneeDetails.name}</span> hereby acknowledge that I have received the above mentioned assets. I understand that this asset belong to company and is under my possession for carrying out my office work. I hereby assure that I will take care of the assets of the company to the best possible extend.
            </p>
          </div>
          
          {/* Final Signature Section */}
          <div className="mb-8 print:mb-6">
            <div className="flex justify-between">
              <div>
                <p className="font-bold mb-2">Employee Signature:_________________</p>
              </div>
              <div>
                <p className="font-bold mb-2">General Manager Sign:_________________</p>
              </div>
            </div>
          </div>
          
          {/* Return Consent */}
          <div className="mb-8 print:mb-6">
            <p className="font-bold underline mb-2">Return Consent:</p>
            <div className="flex justify-between">
              <div>
                <p className="font-bold mb-2">Date:_________________</p>
              </div>
              <div>
                <p className="font-bold mb-2">Employee Sign:_________________</p>
              </div>
              <div>
                <p className="font-bold mb-2">Receiver Sign:_________________</p>
              </div>
            </div>
          </div>
          <div className="mb-8 print:mb-6"></div>
        </div>
      </div>
    </div>
  );
};

export default AssetView;
