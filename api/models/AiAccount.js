import mongoose from 'mongoose';

const TopupSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: true }
);

const AiAccountSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: [
        'openai',
        'anthropic',
        'google',
        'fal',
        'fish',
        'ollama',
        'openrouter',
        'replicate',
        'groq',
        'mistral',
        'together',
        'custom',
      ],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    accountEmail: { type: String, default: '', trim: true },
    notes: { type: String, default: '' },
    adminKey: { type: String, default: '' },
    startingBalance: { type: Number, default: 0, min: 0 },
    startingBalanceDate: { type: Date, default: Date.now },
    topups: { type: [TopupSchema], default: [] },
    cachedCostUsd: { type: Number, default: 0 },
    // For balance-mode providers (fal.ai, fish.audio) we store the live
    // remaining balance returned by the provider directly. null = unset.
    cachedBalanceUsd: { type: Number, default: null },
    lastSyncedAt: { type: Date },
    lastError: { type: String, default: '' },
    lowBalanceNotifiedAt: { type: Date, default: null },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AiAccountSchema.virtual('id').get(function getId() {
  return this._id.toString();
});

AiAccountSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.AiAccount || mongoose.model('AiAccount', AiAccountSchema);
