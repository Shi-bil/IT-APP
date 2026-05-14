import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#06b6d4' },
    icon: { type: String, default: 'Rocket' },
    status: { type: String, default: 'active' }, // active | on-hold | completed | archived
    priority: { type: String, default: 'medium' }, // low | medium | high | urgent
    startDate: { type: Date, default: null },
    deadline: { type: Date, default: null },
    tags: { type: [String], default: [] },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    memberUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProjectSchema.virtual('id').get(function () {
  return this._id.toString();
});

ProjectSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.Project || mongoose.model('Project', ProjectSchema);
