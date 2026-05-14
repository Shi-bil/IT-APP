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

const VpsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, default: '', trim: true },
    providerAccount: { type: String, default: '', trim: true },
    hostname: { type: String, default: '', trim: true },
    ipAddress: { type: String, default: '', trim: true },
    password: { type: String, default: '', trim: true },
    os: { type: String, default: '', trim: true },
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

VpsSchema.virtual('id').get(function getId() {
  return this._id.toString();
});

VpsSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.Vps || mongoose.model('Vps', VpsSchema);
