import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    currency: { type: String, enum: ['USD', 'EUR', 'AED'], default: 'USD' },
  },
  { _id: true }
);

const ObjectStorageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, default: '', trim: true },
    providerAccount: { type: String, default: '', trim: true },
    size: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Active', 'Paused', 'Terminated', 'Pending'],
      default: 'Active',
    },
    monthlyCost: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ['USD', 'EUR', 'AED'], default: 'USD' },
    billingCycle: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'Annual', 'One-time'],
      default: 'Monthly',
    },
    nextPaymentDate: { type: Date },
    recurrenceEndDate: { type: Date },
    notes: { type: String, default: '' },
    payments: { type: [PaymentSchema], default: [] },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ObjectStorageSchema.virtual('id').get(function getId() {
  return this._id.toString();
});

ObjectStorageSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.ObjectStorage || mongoose.model('ObjectStorage', ObjectStorageSchema);
