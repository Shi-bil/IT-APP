import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.PushSubscription
  || mongoose.model('PushSubscription', PushSubscriptionSchema);
