import mongoose from 'mongoose';
mongoose.Promise = require('bluebird');
import { Schema } from 'mongoose';

const MessageSchema = new Schema({
  owner: String,
  content: {
    type: String,
    maxlength: 200,
    minlength: 10,
  },
  createdAt: {
    type: Date,
    default: new Date(),
  },
});

export default mongoose.model('Message', MessageSchema);
