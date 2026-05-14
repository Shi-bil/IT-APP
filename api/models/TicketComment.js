import mongoose from 'mongoose';

const TicketCommentSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', index: true, required: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    text: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to map _id to id
TicketCommentSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Transform for JSON serialization
TicketCommentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.models.TicketComment || mongoose.model('TicketComment', TicketCommentSchema);


