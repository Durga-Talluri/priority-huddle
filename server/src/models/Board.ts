// server/src/models/Board.ts

import mongoose, { Document, Schema, Types } from "mongoose";

// 1. Define the TypeScript Interface
export interface IBoard extends Document {
  title: string;
  objective?: string;
  timeHorizon?: string;
  category?: string;
  notes: Types.ObjectId[]; // Links to the Note model
  collaboratorIds: Types.ObjectId[];
  creator: Types.ObjectId;
  aiWeight?: number; // 0-1, default 0.7 (70% AI, 30% votes)
  enableAIScoring?: boolean;
  enableVoting?: boolean;
  allowDownvotes?: boolean;
  requireOwnerApprovalForDelete?: boolean;
  defaultNoteColor?: string;
  snapToGrid?: boolean;
  backgroundTheme?: string;
  showLeaderboardByDefault?: boolean;
  isArchived?: boolean;
  createdAt: Date;
}

// 2. Define the Mongoose Schema
const BoardSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  objective: { type: String, trim: true },
  timeHorizon: { type: String, trim: true },
  category: { type: String, trim: true },
  // Store the ID of the user who created this board
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // Store references to the Note documents
  notes: [{ type: Schema.Types.ObjectId, ref: "Note", default: [] }],
  createdAt: { type: Date, default: Date.now },
  collaboratorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  // Scoring configuration
  aiWeight: { type: Number, default: 0.7, min: 0, max: 1 }, // 0.7 = 70% AI, 30% votes
  enableAIScoring: { type: Boolean, default: true },
  enableVoting: { type: Boolean, default: true },
  allowDownvotes: { type: Boolean, default: true },
  requireOwnerApprovalForDelete: { type: Boolean, default: false },
  // Appearance & Behavior
  defaultNoteColor: { type: String, default: "#ffebee" },
  snapToGrid: { type: Boolean, default: false },
  backgroundTheme: { type: String, default: "light" }, // light, dark, custom
  showLeaderboardByDefault: { type: Boolean, default: false },
  // Status
  isArchived: { type: Boolean, default: false },
});

export const Board = mongoose.model<IBoard>("Board", BoardSchema);

// Why References?
// Storing an array of Note IDs in the Board (references) is more efficient
// than embedding the entire Note object. This allows us to update a single
// Note without rewriting the whole Board document.
