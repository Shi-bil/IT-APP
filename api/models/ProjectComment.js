import mongoose from 'mongoose';

const ProjectCommentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true, default: null },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectComment', index: true, default: null },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    text: { type: String, required: true },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProjectCommentSchema.virtual('id').get(function () {
  return this._id.toString();
});

ProjectCommentSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Compound index covering the most common thread fetch: projectId + taskId + sort.
ProjectCommentSchema.index({ projectId: 1, taskId: 1, createdAt: 1 });

export default mongoose.models.ProjectComment || mongoose.model('ProjectComment', ProjectCommentSchema);
