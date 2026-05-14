import mongoose from 'mongoose';

const SubtaskSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true, required: true },
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    assigneeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    orderIndex: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

SubtaskSchema.virtual('id').get(function () {
  return this._id.toString();
});

SubtaskSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.Subtask || mongoose.model('Subtask', SubtaskSchema);
