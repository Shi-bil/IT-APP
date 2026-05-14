import 'dotenv/config';
import connectToDatabase from '../_db.js';
import { requireAuth } from '../_auth.js';
import Asset from '../models/Asset.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res, ['admin']);
  if (!auth) return;
  await connectToDatabase();

  if (req.method === 'POST') {
    try {
      const { assets, categoryId } = req.body || {};
      
      if (!assets || !Array.isArray(assets) || assets.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'No assets provided' }));
      }

      if (!categoryId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Category is required' }));
      }

      const importResults = {
        total: assets.length,
        successful: 0,
        failed: 0,
        errors: [],
        successfulAssets: []
      };

      // Process each asset
      for (let i = 0; i < assets.length; i++) {
        const assetData = assets[i];
        
        try {
          // Validate required fields
          if (!assetData.name || String(assetData.name).trim() === '') {
            importResults.failed++;
            importResults.errors.push({
              row: i + 1,
              name: assetData.name || 'N/A',
              error: 'Asset name is required'
            });
            continue;
          }

          // Create asset document
          const doc = {
            name: String(assetData.name).trim(),
            categoryId: categoryId,
            serialNumber: assetData.serialNumber ? String(assetData.serialNumber).trim() : '',
            status: assetData.status ? String(assetData.status).toLowerCase().trim() : 'free',
            quantity: assetData.quantity ? Number(assetData.quantity) : 0,
            remark: assetData.remark ? String(assetData.remark).trim() : '',
            userName: assetData.userName ? String(assetData.userName).trim() : '',
            // SIM-specific fields
            simType: assetData.simType ? String(assetData.simType).toLowerCase().trim() : '',
            plan: assetData.plan ? String(assetData.plan).trim() : '',
            createdByUserId: auth.sub,
          };

          // Validate status
          const validStatuses = ['using', 'free', 'maintenance', 'retired'];
          if (!validStatuses.includes(doc.status)) {
            doc.status = 'free'; // Default to free if invalid
          }

          // Create the asset
          const created = await Asset.create(doc);
          importResults.successful++;
          importResults.successfulAssets.push(created.toJSON());
        } catch (err) {
          importResults.failed++;
          importResults.errors.push({
            row: i + 1,
            name: assetData.name || 'N/A',
            error: err.message
          });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        success: true, 
        results: importResults
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}

