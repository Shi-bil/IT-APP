import mongoose from 'mongoose';

const EmailCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

EmailCodeSchema.index({ email: 1, createdAt: -1 });

// Virtual field to map _id to id
EmailCodeSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
EmailCodeSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.models.EmailCode || mongoose.model('EmailCode', EmailCodeSchema);


