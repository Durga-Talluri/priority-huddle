// server/src/models/User.ts

import mongoose, { Document, Schema , Types} from "mongoose";

// 1. Define the TypeScript Interface for the document
export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

// 2. Define the Mongoose Schema
const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// 3. Export the Mongoose Model
export const User = mongoose.model<IUser>("User", UserSchema);

// Why This Structure?
// - Interface (IUser): For strong type-checking in TypeScript.
// - Schema (UserSchema): For defining structure, validation, and indexes in MongoDB.
// - Model (User): The constructor we use to interact with the database (e.g., User.findOne()).
