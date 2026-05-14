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

const SubscriptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, default: '', trim: true },
    providerAccount: { type: String, default: '', trim: true }, // encrypted
    category: { type: String, default: 'General', trim: true },
    username: { type: String, default: '', trim: true },
    password: { type: String, default: '', trim: true }, // encrypted
    authType: { type: String, enum: ['password', 'google'], default: 'password' },
    url: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Active', 'Paused', 'Cancelled', 'Pending'],
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
    // Legacy fields kept so old docs don't break on load — new UI ignores them.
    monthlyUsage: { type: Number, default: 0, min: 0 },
    usageUnit: { type: String, default: 'units', trim: true },
    payments: { type: [PaymentSchema], default: [] },
    recurringPayments: { type: [PaymentSchema], default: [] },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

SubscriptionSchema.virtual('id').get(function getId() {
  return this._id.toString();
});

SubscriptionSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
