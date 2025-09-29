import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Laptop, Smartphone, Tablet, Signal, Car, Boxes, Zap } from 'lucide-react';
import { assetService } from '../services/assetService';

const AssetForm = () => {
  const navigate = useNavigate();
  const { assetId } = useParams();
  const [asset, setAsset] = useState({
    name: '',
    categoryId: '',
    serialNumber: '',
    status: 'free',
    quantity: 1,
    remark: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  const isEditing = Boolean(assetId);

  useEffect(() => {
    if (isEditing) {
      const fetchAsset = async () => {
        setLoading(true);
        const result = await assetService.getAssetById(assetId);
        if (result.success) {
          setAsset(result.asset);
        } else {
          setError(result.error);
        }
        setLoading(false);
      };
      fetchAsset();
    }
  }, [assetId, isEditing]);

  const categories = [
    { id: '1', name: 'Laptops', icon: <Laptop className="w-8 h-8 text-blue-400" /> },
    { id: '2', name: 'Mobiles', icon: <Smartphone className="w-8 h-8 text-green-400" /> },
    { id: '3', name: 'Tablets', icon: <Tablet className="w-8 h-8 text-purple-400" /> },
    { id: '4', name: 'SIMs', icon: <Signal className="w-8 h-8 text-cyan-400" /> },
    { id: '5', name: 'Vehicles', icon: <Car className="w-8 h-8 text-orange-400" /> },
    { id: '6', name: 'Other', icon: <Boxes className="w-8 h-8 text-slate-400" /> },
  ];
  
  // Category field configuration for dynamic labels and visibility
  const categoryFieldConfig = {
    '1': { // Laptops
      nameLabel: 'Laptop Name*',
      serialLabel: 'Serial Number*',
      showQuantity: true,
      serialPlaceholder: 'E.g. SN:0123ABCD',
    },
    '2': { // Mobiles
      nameLabel: 'Phone Model Name*',
      serialLabel: 'IMEI Number*',
      showQuantity: true,
      serialPlaceholder: 'E.g. 356938035643809',
    },
    '3': { // Tablets
      nameLabel: 'Tablet Model Name*',
      serialLabel: 'IMEI Number*',
      showQuantity: true,
      serialPlaceholder: 'E.g. 356938035643809',
    },
    '4': { // SIMs
      nameLabel: 'SIM Number*',
      serialLabel: 'Asset Code*',
      showQuantity: true,
      serialPlaceholder: 'E.g. 8991101200003204510',
    },
    '5': { // Vehicles
      nameLabel: 'Asset Name*',
      serialLabel: 'Asset Code/Serial Number*',
      showQuantity: true,
      serialPlaceholder: 'E.g. SN:0123ABCD',
    },
    '6': { // Other
      nameLabel: 'Asset Name*',
      serialLabel: 'Asset Code/Serial Number*',
      showQuantity: true,
      serialPlaceholder: 'E.g. SN:0123ABCD',
    },
  };

  // Get selected config for current category
  const selectedConfig = categoryFieldConfig[asset.categoryId] || categoryFieldConfig['6'];

  const validate = () => {
    const newErrors = {};
    if (!asset.categoryId) newErrors.categoryId = 'Category is required.';
    if (!asset.name.trim()) newErrors.name = 'This field is required.';
    if (!asset.serialNumber.trim()) newErrors.serialNumber = 'This field is required.';
    if (selectedConfig.showQuantity && (!asset.quantity || asset.quantity < 1)) newErrors.quantity = 'Quantity must be at least 1.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAsset(prevState => ({ ...prevState, [name]: value }));
    if (errors[name]) {
      setErrors(prevErrors => ({ ...prevErrors, [name]: null }));
    }
  };
  
  const handleCategoryChange = (categoryId) => {
    setAsset(prevState => ({ ...prevState, categoryId }));
    if (errors.categoryId) {
      setErrors(prevErrors => ({ ...prevErrors, categoryId: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isEditing) {
        await assetService.updateAsset(assetId, asset);
      } else {
        await assetService.createAsset(asset);
      }
      navigate('/assets');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => navigate(-1);

  if (loading && isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Loading Asset...</h1>
        </div>
        <div className="glass-morphism p-12 rounded-xl text-center border border-slate-700/30 shadow-glow animate-pulse">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
            <Loader2 className="w-16 h-16 text-cyan-400 mx-auto relative animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">Fetching asset details...</h3>
          <p className="text-slate-500">Please wait while AI processes your data</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1 sm:mb-2">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h1>
          <p className="text-slate-400 flex items-center text-sm sm:text-base">
            <Zap className="w-4 h-4 text-cyan-400 mr-2" />
            {isEditing ? 'Update the details of the existing asset.' : 'Fill in the form to add a new asset.'}
          </p>
        </div>
        <button className="btn-secondary backdrop-blur-sm hover:scale-105 transition-all" onClick={goBack}>
          <ArrowLeft className="w-4 h-4 inline-block mr-1" /> Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="animate-fade-up">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Left Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow">
              <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">Category*</h3>
              {errors.categoryId && <p className="text-red-400 text-sm mb-4">{errors.categoryId}</p>}
              <div className="grid grid-cols-3 gap-4">
                {categories.map((category, index) => (
                  <div 
                    key={category.id} 
                    className={`glass-morphism-hover p-4 rounded-lg cursor-pointer group text-center transition-all duration-300 hover:scale-105 ${
                      asset.categoryId === category.id ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 shadow-glow-blue' : ''
                    }`} 
                    onClick={() => handleCategoryChange(category.id)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex justify-center mb-2">{category.icon}</div>
                    <h4 className={`text-xs font-medium ${
                      asset.categoryId === category.id ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600' : 'text-white group-hover:text-cyan-400'
                    } transition-colors`}>{category.name}</h4>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow">
              <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">Status*</h3>
              <select 
                name="status" 
                required 
                value={asset.status} 
                onChange={handleInputChange} 
                className="input-field w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
              >
                <option value="free">Free to Use</option>
                <option value="using">Using</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-2">
            <div className="glass-morphism p-6 rounded-xl border border-slate-700/30 shadow-glow">
              <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">Asset Details</h3>
              {asset.categoryId ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">{selectedConfig.nameLabel}</label>
                    <input
                      type="text"
                      name="name"
                      value={asset.name}
                      onChange={handleInputChange}
                      className={`input-field w-full bg-slate-800/50 border ${errors.name ? 'border-red-500' : 'border-slate-700/50'} focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300`}
                      placeholder={selectedConfig.nameLabel.replace('*', '')}
                    />
                    {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">{selectedConfig.serialLabel}</label>
                    <input
                      type="text"
                      name="serialNumber"
                      value={asset.serialNumber}
                      onChange={handleInputChange}
                      className={`input-field w-full bg-slate-800/50 border ${errors.serialNumber ? 'border-red-500' : 'border-slate-700/50'} focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300`}
                      placeholder={selectedConfig.serialPlaceholder}
                    />
                    {errors.serialNumber && <p className="text-red-400 text-sm mt-1">{errors.serialNumber}</p>}
                  </div>
                  {selectedConfig.showQuantity && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Quantity*</label>
                      <input
                        type="number"
                        name="quantity"
                        min="1"
                        value={asset.quantity}
                        onChange={handleInputChange}
                        className={`input-field w-full bg-slate-800/50 border ${errors.quantity ? 'border-red-500' : 'border-slate-700/50'} focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300`}
                        placeholder="1"
                      />
                      {errors.quantity && <p className="text-red-400 text-sm mt-1">{errors.quantity}</p>}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Remark (Optional)</label>
                    <textarea
                      name="remark"
                      rows="4"
                      value={asset.remark}
                      onChange={handleInputChange}
                      className="input-field w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring focus:ring-cyan-500/20 transition-all duration-300"
                      placeholder="Add any additional notes here..."
                    ></textarea>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 p-8">
                  <p>Please select a category to see the available fields.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-4 sm:mt-8 flex flex-col sm:flex-row justify-end gap-2 sm:gap-4">
          <button 
            type="submit" 
            className="btn-primary bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 transition-all duration-300 flex items-center" 
            disabled={loading}
          >
            {loading ? 
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 
              <><Save className="w-4 h-4 mr-2" /> {isEditing ? 'Save Changes' : 'Add Asset'}</>
            }
          </button>
        </div>
      </form>
      
      {error && (
        <div className="bg-red-500/20 text-red-300 p-4 rounded-lg mt-4 border border-red-500/30 shadow-glow-error animate-fade-in">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
    </div>
  );
};

export default AssetForm; 