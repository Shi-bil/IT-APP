import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    priority: { type: String, default: '' },
    status: { type: String, default: 'open' },
    tags: { type: [String], default: [] },
    dueDate: { type: Date, default: null },
    resolution: { type: String, default: '' },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to map _id to id
TicketSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
TicketSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);


