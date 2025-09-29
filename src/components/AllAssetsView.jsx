import React, { useRef, useState } from 'react';
import logo from '../assets/logo.png';
import { assetService } from '../services/assetService';
import { exportService } from '../services/exportService';
import { useAuth } from '../contexts/AuthContext';
import { FileText, FileSpreadsheet, Printer, Package } from 'lucide-react';

const AllAssetsView = ({ assets, user, onClose }) => {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === 'admin';
  const [latestHandover, setLatestHandover] = React.useState({ date: null, admin: null });
  const [remarks, setRemarks] = useState(() => assets.map(asset => asset.remarks || ''));
  const modalContentRef = useRef();

  React.useEffect(() => {
    const fetchLatestHandover = async () => {
      let latest = { date: null, admin: null };
      for (const asset of assets) {
        const result = await assetService.getAssetHistory(asset.id);
        if (result.success && Array.isArray(result.history)) {
          const assignmentRecords = result.history.filter(r => r.type === 'assignment');
          for (const record of assignmentRecords) {
            if (!latest.date || new Date(record.handoverDate) > new Date(latest.date)) {
              latest = {
                date: record.handoverDate,
                admin: record.assignedBy?.fullname || 'Admin',
              };
            }
          }
        }
      }
      setLatestHandover(latest);
    };
    fetchLatestHandover();
  }, [assets]);

  // If no assets, show a popup
  if (!assets || assets.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
        <div className="glass-morphism bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto relative p-8 animate-fade-up text-center">
          <Package className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">No Assets Assigned</h2>
          <p className="text-slate-300 mb-6">{user?.fullname || 'This user'} has not been assigned any assets.</p>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // Use the first asset's assignee for details
  const assignee = assets[0]?.assignee || user?.fullname || 'N/A';
  const email = user?.email || '';
  const department = user?.department || 'IT Department';
  const phone = user?.phone || '05XXXXXXXX';

  // Export handlers
  const handleExportDocx = async () => {
    // Map data to template placeholders (matching your screenshot)
    const data = {
      employee_name: assignee,
      email: email,
      department: department,
      phone: phone,
      handover_date: latestHandover.date ? new Date(latestHandover.date).toLocaleDateString() : '',
      handover_by: latestHandover.admin || '',
      asset_table: assets.map((asset, idx) => ({
        sr: idx + 1,
        particulars: asset.name || '',
        asset_code: asset.serialNumber || '',
        qty: asset.quantity || 1,
        remarks: remarks[idx] || ''
      }))
    };
    await exportService.exportDocxFromTemplate(data, 'templates/handover_template.docx', `assets_${assignee.replace(/\s+/g, '_').toLowerCase()}`);
  };
  const handlePrint = () => {
    window.print();
  };

  // Update remark for a specific asset
  const handleRemarkChange = (idx, value) => {
    setRemarks(prev => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-2 sm:p-4">
      <div ref={modalContentRef} className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-4xl max-h-[90vh] overflow-auto relative p-2 sm:p-4 md:p-8 print:shadow-none print:border print:border-black print:rounded-none print:max-h-none print:bg-white print:w-[794px] print:h-[1123px] print:max-w-none print:mx-auto print:overflow-visible">
        {/* Header with actions - hidden when printing */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Asset Handover Form</h2>
          <div className="flex items-center space-x-3">
            {isAdmin && (
              <>
                <button
                  onClick={handleExportDocx}
                  className="p-2 rounded-lg glass-morphism-hover text-blue-400 hover:text-white transition-colors hover:scale-110"
                  title="Export to Word"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePrint}
                  className="p-2 rounded-lg glass-morphism-hover text-cyan-400 hover:text-white transition-colors hover:scale-110"
                  title="Print"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </>
            )}
            <button 
              onClick={onClose}
              className="p-2 rounded-lg glass-morphism-hover text-slate-400 hover:text-red-400 transition-colors hover:scale-110"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        {/* Document Content */}
        <div className="print:p-2 print:text-black print:text-[10px] print:leading-tight print:overflow-visible" style={{ minHeight: '100%' }}>
          <div className="mb-2 print:mb-1 flex items-start">
            <img 
              src={logo} 
              alt="Company Logo" 
              className="h-14 w-auto print:h-10" 
              style={{ minWidth: '48px' }}
            />
          </div>
          <div className="mb-8 print:mb-2 text-center">
            <h2 className="text-xl font-bold text-white print:text-black print:text-[11px] uppercase">ASSET HANDOVER FORM</h2>
          </div>
          {/* Employee and Handover Details */}
          <div className="mb-8 print:mb-2">
            <table className="w-full border border-slate-700 print:border-black">
              <tbody>
                <tr>
                  <td className="border border-slate-700 print:border-black p-2 w-1/2">
                    <div><span className="font-bold">Name of Employee: </span>{assignee}</div>
                    <div><span className="font-bold">Email: </span>{email}</div>
                    <div><span className="font-bold">Department: </span>{department}</div>
                    <div><span className="font-bold">Phone: </span>{phone}</div>
                  </td>
                  <td className="border border-slate-700 print:border-black p-2 w-1/2">
                    <div><span className="font-bold">Handover Date: </span>{latestHandover.date ? new Date(latestHandover.date).toLocaleDateString() : 'N/A'}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="font-bold">Assign For: </span>
                      <div className="flex items-center"><input type="checkbox" className="mr-1"  /><span>Permanent</span></div>
                      <div className="flex items-center ml-4"><input type="checkbox" className="mr-1" /><span>Temp</span></div>
                    </div>
                    <div className="mt-1"><span className="font-bold">Return Date(if Temp): </span></div>
                    <div className="mt-1"><span className="font-bold">Handover By: </span>{latestHandover.admin || 'Admin'}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Introduction Text */}
          <div className="mb-4">
            <p className="text-white print:text-black">
              Dear Sir / Madam<br />
              Please find the below as the assets handed over to you, to support you in carrying out your assignment in a most Proficient manner.
            </p>
          </div>
          {/* Assets Table */}
          <div className="mb-8 print:mb-2">
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
                {assets.map((asset, idx) => (
                  <tr key={asset.id}>
                    <td className="border border-slate-700 print:border-black p-2">{idx + 1}</td>
                    <td className="border border-slate-700 print:border-black p-2">{asset.name}</td>
                    <td className="border border-slate-700 print:border-black p-2">{asset.serialNumber}</td>
                    <td className="border border-slate-700 print:border-black p-2">{asset.quantity || 1}</td>
                    <td className="border border-slate-700 print:border-black p-2">
                      {asset.remarks ? asset.remarks : (
                        <input
                          type="text"
                          className="input-field w-full bg-slate-800 border border-slate-700 text-white px-2 py-1 rounded"
                          placeholder="Enter remark"
                          value={remarks[idx] || ''}
                          onChange={e => handleRemarkChange(idx, e.target.value)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {/* Empty rows for up to 10 total */}
                {Array.from({ length: Math.max(0, 10 - assets.length) }).map((_, idx) => (
                  <tr key={assets.length + idx}>
                    <td className="border border-slate-700 print:border-black p-2">{assets.length + idx + 1}</td>
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
          <div className="mb-8 print:mb-2">
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
          <div className="mb-8 print:mb-2">
            <h3 className="text-lg font-bold text-white print:text-black mb-2">ACKNOWLEDGEMENT AND DECLARATION BY EMPLOYEE</h3>
            <p className="text-white print:text-black mb-4">
              I, Ms/Mr. <span className="underline">{assignee}</span> hereby acknowledge that I have received the above mentioned assets. I understand that this asset belong to company and is under my possession for carrying out my office work. I hereby assure that I will take care of the assets of the company to the best possible extend.
            </p>
          </div>
          {/* Final Signature Section */}
          <div className="mb-8 print:mb-2">
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
          <div className="mb-8 print:mb-2">
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
        </div>
      </div>
    </div>
  );
};

export default AllAssetsView; 