import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, default: 'todo' }, // todo | in-progress | review | done
    priority: { type: String, default: 'medium' }, // low | medium | high | urgent
    progress: { type: Number, default: 0, min: 0, max: 100 },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    tags: { type: [String], default: [] },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    assigneeUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    orderIndex: { type: Number, default: 0 }, // for kanban column ordering
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

TaskSchema.virtual('id').get(function () {
  return this._id.toString();
});

TaskSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
