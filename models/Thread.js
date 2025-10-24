const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false }
});

const ThreadSchema = new mongoose.Schema({
  board: { type: String, required: true },
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  reported: { type: Boolean, default: false },
  delete_password: { type: String, required: true },
  replies: [ReplySchema]
});

// FIX: Ensure bumped_on equals created_on for new threads
ThreadSchema.pre('save', function(next) {
  // If this is a new thread, set bumped_on equal to created_on
  if (this.isNew) {
    this.bumped_on = this.created_on;
  }
  // If replies are modified (new reply added), update bumped_on
  if (this.isModified('replies') && this.replies.length > 0) {
    this.bumped_on = new Date();
  }
  next();
});

module.exports = mongoose.model('Thread', ThreadSchema);