import mongoose from 'mongoose';

const AssetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    categoryId: { type: String, default: '' },
    serialNumber: { type: String, default: '' },
    status: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    remark: { type: String, default: '' },
    userName: { type: String, default: '' },
    // SIM-specific fields
    simType: { type: String, default: '' }, // 'postpaid' or 'prepaid'
    plan: { type: String, default: '' }, // Plan name/details
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assigneeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    handoverDate: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to map _id to id
AssetSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
AssetSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Compound index for the admin list view which sorts by createdAt and filters by status.
AssetSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Asset || mongoose.model('Asset', AssetSchema);


