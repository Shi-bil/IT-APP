import mongoose from 'mongoose';

const AssetHistorySchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', index: true, required: true },
    type: { type: String, enum: ['assignment', 'status'], required: true },
    previousStatus: { type: String, default: '' },
    newStatus: { type: String, default: '' },
    previousUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handoverDate: { type: Date, default: null },
    unassignedDate: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to map _id to id
AssetHistorySchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
AssetHistorySchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.models.AssetHistory || mongoose.model('AssetHistory', AssetHistorySchema);


