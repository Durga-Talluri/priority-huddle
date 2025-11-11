// server/src/models/Note.ts

import mongoose, { Document, Schema, Types } from 'mongoose';

// 1. Define the TypeScript Interface
export interface INote extends Document {
  content: string;
  positionX: number;
  positionY: number;
  color: string;
  upvotes: number;
  creatorId: Types.ObjectId; // Links to the User model
  boardId: Types.ObjectId; // Links to the Board model
  aiPriorityScore: number;
  aiContentScore: number | null;
  aiRationale: string | null;
  width: number;
  height: number;
}

// 2. Define the Mongoose Schema
const NoteSchema: Schema = new Schema({
  content: { type: String, required: true, default: '' },
  positionX: { type: Number, required: true, default: 100 },
  positionY: { type: Number, required: true, default: 100 },
  color: { type: String, required: true, default: '#ffffff' },
  upvotes: { type: Number, default: 0 },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
  // AI scoring fields
  aiPriorityScore: { type: Number, default: 0.5 },
  aiContentScore: { type: Number, default: null },
  aiRationale: { type: String, default: null },
  width: { type: Number, default: 256 }, // Default width (w-64 = 256px)
  height: { type: Number, default: 150 }, // Default height
});

export const Note = mongoose.model<INote>('Note', NoteSchema);