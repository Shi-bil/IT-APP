import mongoose from 'mongoose';

const CredentialSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    type: { type: String, default: '' },
    username: { type: String, default: '' },
    password: { type: String, default: '' },
    url: { type: String, default: '' },
    category: { type: String, default: '' },
    isEncrypted: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    expiryDate: { type: Date, default: null },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    isPrivate: { type: Boolean, default: true },
    sharedWithUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to map _id to id
CredentialSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
CredentialSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.models.Credential || mongoose.model('Credential', CredentialSchema);


