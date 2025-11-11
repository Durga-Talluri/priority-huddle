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
import {
  scoreNoteContent,
  calculateVoteScore,
  calculateCombinedScore,
} from "./services/aiScorer";
import { generateAvatar } from "./utils/avatarGenerator";
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
interface PresencePayload {
  notePresence: {
    noteId: string;
    userId: string;
    username: string;
    status: string;
    initials?: string;
    colorHex?: string;
    displayName?: string;
  };
  boardId: string;
}
const NOTE_UPDATED = "NOTE_UPDATED";
const NOTE_PRESENCE = "NOTE_PRESENCE";
export const pubsub = new PubSub<{
  NOTE_UPDATED: NoteUpdatePayload;
  NOTE_PRESENCE: PresencePayload;
}>();
// Helper function to get max upvotes for a board (for vote score normalization)
async function getMaxUpvotesForBoard(boardId: string): Promise<number> {
  const notes = await Note.find({ boardId });
  if (notes.length === 0) return 0;
  return Math.max(...notes.map((note) => note.upvotes || 0));
}

// Helper function to score and update a note
async function scoreAndUpdateNote(note: any, boardId: string): Promise<any> {
  try {
    // Score the note content using AI
    const scoringResult = await scoreNoteContent(note);
    note.aiContentScore = scoringResult.ai_content_score;
    note.aiRationale = scoringResult.ai_rationale;

    // Get max upvotes for vote score normalization
    const maxUpvotes = await getMaxUpvotesForBoard(boardId);
    const voteScore = calculateVoteScore(note.upvotes || 0, maxUpvotes);

    // Calculate combined score
    note.aiPriorityScore = calculateCombinedScore(
      scoringResult.ai_content_score,
      voteScore
    );

    return await note.save();
  } catch (error) {
    console.error("Error scoring note:", error);
    // If scoring fails, use fallback (already handled in scoreNoteContent)
    // But we still need to calculate combined score
    const maxUpvotes = await getMaxUpvotesForBoard(boardId);
    const voteScore = calculateVoteScore(note.upvotes || 0, maxUpvotes);
    const aiContentScore = note.aiContentScore || 0.5; // Default if not set
    note.aiPriorityScore = calculateCombinedScore(aiContentScore, voteScore);
    return await note.save();
  }
}

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
      // 1. The current user is the creator OR
      // 2. The current user's ID is present in the collaboratorIds array
      // Note: Using $in for array matching to ensure proper ObjectId comparison
      const boards = await Board.find({
        $or: [{ creator: userId }, { collaboratorIds: { $in: [userId] } }],
      })
        // Populate the creators to show ownership info on the homepage
        .populate("creator");

      return boards;
    },
    searchUsers: async (
      parent: any,
      { query }: { query: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required.");
      }

      if (!query || query.trim().length < 1) {
        return [];
      }

      const searchTerm = query.trim();
      const currentUserId = context.user._id;

      // Search by username or email (case-insensitive)
      // Exclude the current user (board creator) from results
      const users = await User.find({
        $and: [
          {
            $or: [
              { username: { $regex: searchTerm, $options: "i" } },
              { email: { $regex: searchTerm, $options: "i" } },
            ],
          },
          { _id: { $ne: currentUserId } }, // Exclude current user
        ],
      })
        .limit(10) // Limit to 10 results
        .select("username email id") // Only return necessary fields
        .exec();

      return users;
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
    notePresence: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([NOTE_PRESENCE]),
        (
          payload: PresencePayload | undefined,
          variables: { boardId: string } | undefined
        ) => {
          // Filter by boardId to only send events to users on that board
          if (!payload || !variables) return false;
          return payload.boardId === variables.boardId;
        }
      ),
      resolve: (payload: PresencePayload) => payload.notePresence,
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
      {
        input,
      }: {
        input: {
          title: string;
          objective: string;
          timeHorizon?: string;
          category?: string;
          collaboratorUsernames?: string[];
          aiWeight?: number;
          enableAIScoring?: boolean;
          enableVoting?: boolean;
          allowDownvotes?: boolean;
          requireOwnerApprovalForDelete?: boolean;
        };
      },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required to create a board.");
      }

      // Find collaborators by username if provided
      const collaboratorIds: Types.ObjectId[] = [];
      if (
        input.collaboratorUsernames &&
        input.collaboratorUsernames.length > 0
      ) {
        for (const username of input.collaboratorUsernames) {
          const user = await User.findOne({ username });
          if (user) {
            // Don't add creator as collaborator
            if (user._id.toString() !== context.user._id.toString()) {
              collaboratorIds.push(user._id as Types.ObjectId);
            } else {
              console.warn(
                `Skipping creator ${username} from collaborators list`
              );
            }
          } else {
            console.warn(`User not found: ${username}`);
          }
        }
      }

      // Create the new board document
      const newBoard = new Board({
        title: input.title,
        objective: input.objective,
        timeHorizon: input.timeHorizon,
        category: input.category,
        creator: context.user._id,
        collaboratorIds,
        aiWeight: input.aiWeight ?? 0.7,
        enableAIScoring: input.enableAIScoring ?? true,
        enableVoting: input.enableVoting ?? true,
        allowDownvotes: input.allowDownvotes ?? true,
        requireOwnerApprovalForDelete:
          input.requireOwnerApprovalForDelete ?? false,
      });

      await newBoard.save();
      console.log(
        `Board created with ${collaboratorIds.length} collaborators:`,
        collaboratorIds.map((id) => id.toString())
      );

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
      if (!board) {
        throw new Error("Board not found.");
      }

      // Check if user is creator or collaborator
      const isCreator =
        board.creator.toString() === context.user._id.toString();
      const isCollaborator = board.collaboratorIds
        .map((id: any) => id.toString())
        .includes(context.user._id.toString());

      if (!isCreator && !isCollaborator) {
        throw new Error("You are not authorized to add notes to this board.");
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

      // 3. Score the note using AI and update combined score
      const scoredNote = await scoreAndUpdateNote(newNote, boardId.toString());

      // 4. To return the complete Note (including the resolved creator object),
      // we fetch the full Note document.
      const populatedNote = await Note.findById(scoredNote._id).populate(
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

      // If content changed, re-score the note
      if (content !== undefined) {
        const scoredNote = await scoreAndUpdateNote(
          note,
          note.boardId.toString()
        );
        pubsub.publish(NOTE_UPDATED, {
          noteUpdated: scoredNote,
          boardId: scoredNote.boardId.toString(),
        });
        return scoredNote;
      }

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
    updateNoteSize: async (
      parent: any,
      {
        noteId,
        width,
        height,
      }: { noteId: string; width: number; height: number },
      context: Context
    ) => {
      if (!context.user) throw new Error("Authentication required.");

      const note = await Note.findById(noteId);
      if (!note) throw new Error("Note not found.");

      // Validate minimum size
      const minWidth = 150;
      const minHeight = 100;
      note.width = Math.max(minWidth, width);
      note.height = Math.max(minHeight, height);

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

      // Recalculate combined score with updated votes
      const boardId = note.boardId.toString();
      const maxUpvotes = await getMaxUpvotesForBoard(boardId);
      const voteScore = calculateVoteScore(note.upvotes || 0, maxUpvotes);
      const aiContentScore = note.aiContentScore || 0.5; // Use existing AI score or default
      note.aiPriorityScore = calculateCombinedScore(aiContentScore, voteScore);

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

      // 2. Find the board to check authorization
      const board = await Board.findById(boardId);
      if (!board) {
        throw new Error("Board not found.");
      }

      // 3. AUTHORIZATION CHECK: Allow creator or collaborator to delete any note
      const isCreator =
        board.creator.toString() === context.user._id.toString();
      const isCollaborator = board.collaboratorIds
        .map((id: any) => id.toString())
        .includes(context.user._id.toString());

      if (!isCreator && !isCollaborator) {
        throw new Error(
          "You are not authorized to delete notes from this board."
        );
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
    updateBoardSettings: async (
      parent: any,
      {
        boardId,
        input,
      }: {
        boardId: string;
        input: {
          title?: string;
          objective?: string;
          timeHorizon?: string;
          category?: string;
          aiWeight?: number;
          enableAIScoring?: boolean;
          enableVoting?: boolean;
          allowDownvotes?: boolean;
          requireOwnerApprovalForDelete?: boolean;
          defaultNoteColor?: string;
          snapToGrid?: boolean;
          backgroundTheme?: string;
          showLeaderboardByDefault?: boolean;
        };
      },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required.");
      }

      const board = await Board.findById(boardId);
      if (!board) {
        throw new Error("Board not found.");
      }

      const isCreator =
        board.creator.toString() === context.user._id.toString();
      const isCollaborator = board.collaboratorIds
        .map((id: any) => id.toString())
        .includes(context.user._id.toString());

      if (!isCreator && !isCollaborator) {
        throw new Error("You are not authorized to update this board.");
      }

      // Owner-only fields
      if (!isCreator) {
        // Collaborators can only update appearance settings
        if (input.title !== undefined || input.objective !== undefined) {
          throw new Error(
            "Only the board owner can update title and objective."
          );
        }
      }

      // Update fields
      if (input.title !== undefined) board.title = input.title;
      if (input.objective !== undefined) board.objective = input.objective;
      if (input.timeHorizon !== undefined)
        board.timeHorizon = input.timeHorizon;
      if (input.category !== undefined) board.category = input.category;
      if (input.aiWeight !== undefined) board.aiWeight = input.aiWeight;
      if (input.enableAIScoring !== undefined)
        board.enableAIScoring = input.enableAIScoring;
      if (input.enableVoting !== undefined)
        board.enableVoting = input.enableVoting;
      if (input.allowDownvotes !== undefined)
        board.allowDownvotes = input.allowDownvotes;
      if (input.requireOwnerApprovalForDelete !== undefined)
        board.requireOwnerApprovalForDelete =
          input.requireOwnerApprovalForDelete;
      if (input.defaultNoteColor !== undefined)
        board.defaultNoteColor = input.defaultNoteColor;
      if (input.snapToGrid !== undefined) board.snapToGrid = input.snapToGrid;
      if (input.backgroundTheme !== undefined)
        board.backgroundTheme = input.backgroundTheme;
      if (input.showLeaderboardByDefault !== undefined)
        board.showLeaderboardByDefault = input.showLeaderboardByDefault;

      await board.save();

      return board;
    },
    archiveBoard: async (
      parent: any,
      { boardId }: { boardId: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required.");
      }

      const board = await Board.findById(boardId);
      if (!board) {
        throw new Error("Board not found.");
      }

      // Only owner can archive
      if (board.creator.toString() !== context.user._id.toString()) {
        throw new Error("Only the board owner can archive the board.");
      }

      board.isArchived = true;
      await board.save();

      return board;
    },
    deleteBoard: async (
      parent: any,
      { boardId }: { boardId: string },
      context: Context
    ) => {
      if (!context.user) {
        throw new Error("Authentication required.");
      }

      const board = await Board.findById(boardId);
      if (!board) {
        throw new Error("Board not found.");
      }

      // Only owner can delete
      if (board.creator.toString() !== context.user._id.toString()) {
        throw new Error("Only the board owner can delete the board.");
      }

      // Delete all notes first
      await Note.deleteMany({ boardId: board._id });

      // Delete the board
      await Board.findByIdAndDelete(boardId);

      return true;
    },
    broadcastPresence: async (
      parent: any,
      { noteId, status }: { noteId: string; status: string },
      context: Context
    ) => {
      if (!context.user) throw new Error("Authentication required.");

      // Get the boardId from the note (required for filtering)
      const note = await Note.findById(noteId);
      if (!note) return false;

      // Generate avatar data for the user
      const avatarData = generateAvatar(
        context.user.username,
        context.user.email
      );

      const payload = {
        noteId,
        userId: context.user._id.toString(),
        username: context.user.username,
        status,
        initials: avatarData.initials,
        colorHex: avatarData.colorHex,
        displayName: avatarData.displayName,
      };

      pubsub.publish(NOTE_PRESENCE, {
        notePresence: payload,
        boardId: note.boardId.toString(),
      });

      return true;
    },
  },
};
