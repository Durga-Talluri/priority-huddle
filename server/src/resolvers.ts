// server/src/resolvers.ts

import { User } from "./models/User";
import { Board } from "./models/Board"; // <-- NEW
import { Note } from "./models/Note"; // <-- NEW
import { hashPassword, comparePasswords, createToken } from "./utils/auth";
import { Types } from "mongoose";
import { PubSub, withFilter } from "graphql-subscriptions";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { IUser } from "./models/User";
// Define the shape of the Context object for use in resolvers
interface Context {
  user: IUser | null;
  JWT_SECRET?: string;
}
enum VoteType {
  UP = "UP",
  DOWN = "DOWN",
}
interface NoteUpdatePayload {
  noteUpdated: any; // Can be a Note object or a delete payload {id, _deleted}
  boardId: string;
}
export const pubsub = new PubSub<{ [key: string]: NoteUpdatePayload }>();
const NOTE_UPDATED = "NOTE_UPDATED";

export const resolvers = {
  // Resolvers for the Query Type (Read Operations)
  Query: {
    // The 'me' query allows a logged-in user to fetch their own profile
    me: (parent: any, args: any, context: Context) => {
      // Authorization Check: If context.user is null, no one is logged in.
      if (!context.user) {
        throw new Error("Authentication required for this query.");
      }
      return context.user;
    },
    board: async (
      parent: any,
      { boardId }: { boardId: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required.");
      }

      // 1. Fetch the board by ID
      const board = await Board.findById(boardId)
        // 2. Use Mongoose 'populate' to automatically fetch and replace the Note IDs with the actual Note documents
        .populate("notes");

      if (!board) {
        throw new Error("Board not found.");
      }

      // Authorization Check (Simple): Only allow the creator (or later, collaborators) to see it
      const isCreator = board.creator.toString() == context.user._id.toString();
      const isCollaborator = board.collaboratorIds
        .map((id: any) => id.toString())
        .includes(context.user._id.toString());
      if (!isCreator && !isCollaborator) {
        throw new Error("You are not authorized to view this board.");
      }

      return board;
    },
    myBoards: async (parent: any, args: any, context: Context) => {
      if (!context.user) {
        throw new Error("Authentication required.");
      }
      const userId = context.user._id;

      // Use $or operator to find boards where:
      // 1. The current user is the creatorId OR
      // 2. The current user's ID is present in the collaboratorIds array
      const boards = await Board.find({
        $or: [{ creator: userId }, { collaboratorIds: userId }],
      })
        // Populate the creators to show ownership info on the homepage
        .populate("creator");

      return boards;
    },
    // New: Resolver for the Note Type's nested fields
    // This is critical for GraphQL to resolve non-scalar fields (like a nested User object)
  },
  Subscription: {
    noteUpdated: {
      subscribe: withFilter(
        () => {
          // Add this
          console.log("🔔 NEW SUBSCRIPTION CREATED");
          const iterator = (pubsub as any).asyncIterableIterator([
            NOTE_UPDATED,
          ]);

          return iterator;
        },
        (
          payload: any,
          variables: { boardId: string } | undefined,
          context: Context | undefined
        ) => {
          console.log("🔍 FILTER RUNNING - Event received!");
          // 1. Check authentication
          if (!context?.user) {
            console.log("❌ FILTER REJECTED - No user");

            return false;
          }

          // 2. Check if variables exist and boardId matches
          if (!variables?.boardId) {
            console.log("❌ FILTER REJECTED - No boardId");

            return false;
          }
          const publishedId = payload.boardId;
          const subscribedId = variables.boardId;

          console.log(
            `[SUBS FILTER DEBUG] Pub ID: '${publishedId}' (Type: ${typeof publishedId})`
          );
          console.log(
            `[SUBS FILTER DEBUG] Sub ID: '${subscribedId}' (Type: ${typeof subscribedId})`
          );
          // -----------------------

          const matches = publishedId.toString() === subscribedId.toString();
          console.log(`✅ Filter result: ${matches}`);

          return matches;
        }
      ),
      // 3. The resolve function formats the payload before sending it to the client
      resolve: (payload: any) => {
        return payload.noteUpdated;
      },
    },
  },
  // New: Resolver for the Note Type's nested fields
  // This is critical for GraphQL to resolve non-scalar fields (like a nested User object)
  Note: {
    // Resolves the 'creator' field on the Note type
    creator: async (note: any) => {
      // Note: The 'note' argument here is the parent object (the INote document)
      // returned by the parent resolver (e.g., the 'board' query).
      // We use the creatorId from the note to fetch the User details.
      const user = await User.findById(note.creatorId);
      return user;
    },
  },
  Board: {
    // Resolves the 'creator' field on the Board type
    creator: async (board: any, args: any, context: Context) => {
      // 1. The 'board' argument is the parent object (the IBoard document)
      //    returned by the parent resolver (e.g., the 'myBoards' query).

      // 2. We use the creatorId from the board to fetch the User details.
      //    We assume 'board.creatorId' is available from the database fetch.
      const user = await User.findById(board.creator);

      // 3. Return the User object to satisfy the 'creator: User!' field requirement
      return user;
    },

    // Optional: You could add a resolver for the 'collaborators' list here if you choose to expose it.
    // collaborators: async (board: any, args: any, context: Context) => {
    //    const users = await User.find({ _id: { $in: board.collaboratorIds } });
    //    return users;
    // },
  },
  NoteUpdatePayload: {
    __resolveType(obj: any) {
      // If the object has _deleted field, it's a NoteDeletionPayload
      if (obj._deleted) {
        return "NoteDeletionPayload";
      }
      // Otherwise, it's a Note
      return "Note";
    },
  },
  // Resolvers for the Mutation Type (Write Operations)
  Mutation: {
    // --- 1. Registration Logic ---
    register: async (
      parent: any,
      { input: { username, email, password } }: any,
      context: Context
    ) => {
      // 1. Check for existing UNIQUE email (Crucial!)
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error("A user with this email already exists.");
      }

      // Optional: Check for unique username if desired for collaboration uniqueness
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        throw new Error("This username is taken.");
      }

      // 2. Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Create the new user with email and username
      const user = new User({
        username,
        email, // <-- Save the email
        passwordHash: hashedPassword,
      });
      await user.save();

      // 4. Generate and return the token
      if (!context.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
      }
      const token = jwt.sign({ userId: user._id }, context.JWT_SECRET);
      return { token, user };
    },

    // --- 2. Login Logic ---
    login: async (
      parent: any,
      { input: { email, password } }: any,
      context: Context
    ) => {
      // 1. Find the user by email
      const user = await User.findOne({ email });
      if (!user) {
        // Use a generic message for security
        throw new Error("Invalid email or password.");
      }
      // 2. Compare the password hash
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new Error("Invalid email or password.");
      }
      // 3. Generate and return the token
      if (!context.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
      }
      // 3. Generate and return the token
      const token = jwt.sign({ userId: user._id }, context.JWT_SECRET);
      return { token, user };
    },

    // New: Create a new board
    createBoard: async (
      parent: any,
      { title }: { title: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required to create a board.");
      }

      // Create the new board document
      const newBoard = new Board({
        title,
        creator: context.user._id, // Set the creator from the context
      });

      await newBoard.save();

      return newBoard;
    },

    // New: Create a new note and link it to the board
    createNote: async (
      parent: any,
      { boardId, content, color, positionX, positionY }: any,
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required to create a note.");
      }

      // Check if the board exists and the user is authorized to add a note
      const board = await Board.findById(boardId);
      if (!board || board.creator.toString() !== context.user._id.toString()) {
        throw new Error("Board not found or you are not authorized.");
      }

      // 1. Create the new Note document
      const newNote = new Note({
        content,
        color,
        boardId,
        creatorId: context.user._id,
        // Use provided coordinates when available, otherwise fall back to model defaults
        ...(typeof positionX === "number" ? { positionX } : {}),
        ...(typeof positionY === "number" ? { positionY } : {}),
      });
      await newNote.save();

      // 2. IMPORTANT: Update the Board to include the new Note reference
      board.notes.push(newNote._id as Types.ObjectId);
      await board.save();

      // 3. To return the complete Note (including the resolved creator object),
      // we fetch the full Note document.
      const populatedNote = await Note.findById(newNote._id).populate(
        "creatorId"
      );

      const publishedBoardId = boardId.toString();

      pubsub.publish(NOTE_UPDATED, {
        noteUpdated: populatedNote,
        boardId: publishedBoardId,
      });
      return populatedNote;
    },
    updateNote: async (
      parent: any,
      {
        noteId,
        content,
        color,
      }: { noteId: string; content: string; color: string },
      context: Context
    ) => {
      if (!context.user) throw new Error("Authentication required.");

      const note = await Note.findById(noteId);
      if (!note) throw new Error("Note not found.");

      // Authorization check (optional: only allow creator to edit content)
      // if (note.creatorId.toString() !== context.user._id.toString()) {
      //     throw new Error('You are not authorized to edit this note.');
      // }

      if (content !== undefined) note.content = content;
      if (color !== undefined) note.color = color;

      const updatedNote = await note.save();
      console.log(updatedNote);
      // **REAL-TIME: PUBLISH THE UPDATE**
      pubsub.publish(NOTE_UPDATED, {
        noteUpdated: updatedNote,
        boardId: updatedNote.boardId.toString(),
      });
      return updatedNote;
    },
    updateNotePosition: async (
      parent: any,
      {
        noteId,
        positionX,
        positionY,
      }: { noteId: string; positionX: number; positionY: number },
      context: Context
    ) => {
      if (!context.user) throw new Error("Authentication required.");

      const note = await Note.findById(noteId);
      if (!note) throw new Error("Note not found.");

      // Update coordinates
      note.positionX = positionX;
      note.positionY = positionY;

      const updatedNote = await note.save();

      // **REAL-TIME: PUBLISH THE UPDATE**
      pubsub.publish(NOTE_UPDATED, {
        noteUpdated: updatedNote,
        boardId: updatedNote.boardId.toString(),
      });

      return updatedNote;
    },

    // 3. Vote Note (Used for upvote/downvote buttons)
    voteNote: async (
      parent: any,
      { noteId, type }: { noteId: string; type: VoteType },
      context: Context
    ) => {
      if (!context.user) throw new Error("Authentication required.");

      const note = await Note.findById(noteId);
      if (!note) throw new Error("Note not found.");

      // Update the vote count based on type (UP or DOWN)
      if (type === "UP") {
        note.upvotes += 1;
      } else if (type === "DOWN") {
        // Prevent going below zero if desired, or allow negative votes
        note.upvotes = Math.max(0, note.upvotes - 1);
      }

      const updatedNote = await note.save();

      // **REAL-TIME: PUBLISH THE UPDATE**
      pubsub.publish(NOTE_UPDATED, {
        noteUpdated: updatedNote,
        boardId: updatedNote.boardId.toString(),
      });

      return updatedNote;
    },
    deleteNote: async (
      parent: any,
      { noteId }: { noteId: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required to delete a note.");
      }

      // 1. Find the note to be deleted
      const noteToDelete = await Note.findById(noteId);
      if (!noteToDelete) {
        throw new Error("Note not found.");
      }
      const boardId = noteToDelete.boardId.toString();
      // 2. AUTHORIZATION CHECK: Only the creator can delete the note
      if (noteToDelete.creatorId.toString() !== context.user._id.toString()) {
        throw new Error("You are not authorized to delete this note.");
      }

      // 3. IMPORTANT: Remove the Note ID reference from its Board
      await Board.findByIdAndUpdate(
        noteToDelete.boardId,
        { $pull: { notes: noteId } }, // $pull is a MongoDB operator to remove an element from an array
        { new: true }
      );

      // 4. Delete the Note document itself
      await Note.findByIdAndDelete(noteId);
      pubsub.publish(NOTE_UPDATED, {
        // We send a minimal payload containing only the ID to be removed
        // and a flag to indicate it was a deletion
        noteUpdated: {
          id: noteId,
          _deleted: true,
          __typename: "NoteDeletionPayload",
        },
        boardId: boardId.toString(),
      });
      // 5. Return the ID so the frontend knows which note to remove from its cache/state
      return noteId;
    },
    addCollaborator: async (
      parent: any,
      { boardId, username }: { boardId: string; username: string },
      context: Context
    ) => {
      if (!context.user) throw new Error("Authentication required.");

      // 1. Find the board
      const board = await Board.findById(boardId);
      console.log(board);
      if (!board) throw new Error("Board not found.");

      const currentUserId = context.user._id.toString();
      console.log(currentUserId);
      // --- FIX 1: Use board.creator for the comparison ---
      if (board.creator.toString() !== currentUserId) {
        throw new Error("Only the creator can add collaborators.");
      }

      // 2. Find the user to be added
      const newCollaborator = await User.findOne({ username });
      if (!newCollaborator) throw new Error(`User "${username}" not found.`);

      // Prevent adding creator as a collaborator (optional)
      // --- FIX 2: Use board.creator for the comparison ---
      if (newCollaborator._id.toString() === board.creator.toString()) {
        throw new Error("User is already the creator.");
      }

      // 3. Add the user ID to the array if not already present
      const newCollaboratorId = newCollaborator._id as Types.ObjectId;

      // NOTE: collaboratorIds is an array, comparing ObjectIds is better
      const isAlreadyCollaborator = board.collaboratorIds.some((id: any) =>
        id.equals(newCollaboratorId)
      );

      if (!isAlreadyCollaborator) {
        board.collaboratorIds.push(newCollaboratorId);
        await board.save(); // This save operation should now pass validation
      } else {
        throw new Error(`User "${username}" is already a collaborator.`);
      }

      // 4. Refetch the fully populated board to return
      // Populate the 'notes' field and the 'collaborators' field (if you want collaborators returned)
      const updatedBoard = await Board.findById(boardId)
        .populate("notes")
        .populate("collaboratorIds");

      return updatedBoard;
    },
  },
};
