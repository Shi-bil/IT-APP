import mongoose from 'mongoose';
import crypto from 'crypto';

const PasswordResetTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    code: { type: String, required: true }, // 6-digit code for email verification
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for cleanup of expired tokens
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual field to map _id to id
PasswordResetTokenSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
PasswordResetTokenSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Static method to generate a secure token
PasswordResetTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Static method to generate a 6-digit code
PasswordResetTokenSchema.statics.generateCode = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default mongoose.models.PasswordResetToken || mongoose.model('PasswordResetToken', PasswordResetTokenSchema);


