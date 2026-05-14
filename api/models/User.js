import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    fullname: { type: String, default: '' },
    role: { type: String, default: 'employee', enum: ['admin', 'employee', 'manager'] },
    department: { type: String, default: '' },
    phone: { type: String, default: '' },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    sessionInvalidatedAt: { type: Date, default: null }, // Set when user is demoted to force logout
    notificationsEnabled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to map _id to id
UserSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash; // Never expose password hash
    return ret;
  }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);


