// server/src/models/Board.ts

import mongoose, { Document, Schema, Types } from "mongoose";

// 1. Define the TypeScript Interface
export interface IBoard extends Document {
  title: string;
  notes: Types.ObjectId[]; // Links to the Note model
  collaboratorIds: Types.ObjectId[];
  creator: Types.ObjectId;
  createdAt: Date;
}

// 2. Define the Mongoose Schema
const BoardSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  // Store the ID of the user who created this board
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // Store references to the Note documents
  notes: [{ type: Schema.Types.ObjectId, ref: "Note", default: [] }],
  createdAt: { type: Date, default: Date.now },
  collaboratorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

export const Board = mongoose.model<IBoard>("Board", BoardSchema);

// Why References?
// Storing an array of Note IDs in the Board (references) is more efficient
// than embedding the entire Note object. This allows us to update a single
// Note without rewriting the whole Board document.
