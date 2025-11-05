// server/src/schema.ts

// This file defines the structure of our entire GraphQL API.

const typeDefs = `#graphql
  # --- Core Types ---

  type User {
    id: ID!
    username: String!
    email: String!
    createdAt: String!
  }

  type Note {
    id: ID!
    content: String!
    positionX: Float!
    positionY: Float!
    color: String!
    upvotes: Int!
    creator: User! 
    aiPriorityScore: Float # From Phase 3
  }

  type Board {
    id: ID!
    title: String!
    notes: [Note!]!
    creator: User!
    collaborators: [User!]
  }

  # The main type for Authentication results
  type AuthPayload {
    token: String!
    user: User!
  }

  # --- Input Types for Mutations (Security Focus) ---

  input RegisterInput {
    username: String!   # Display name/Collaborator invite name
    email: String!      # Unique login ID
    password: String!
}
  
input LoginInput {
    email: String!
    password: String!
}
   enum VoteType {
    UP
    DOWN
}
  
  # --- API Entry Points (Queries/Mutations) ---

  type Query {
    me: User # Get the currently logged-in user
    board(boardId: ID!): Board
    myBoards: [Board!]!
    
    # We'll add more queries later
  }

  type Mutation {
    # Phase 1 Auth Mutations
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    # Phase 1 Core Mutations
    createBoard(title: String!): Board!
    createNote(boardId: ID!, content: String!, color: String!, positionX: Float!, positionY: Float!): Note!
    deleteNote(noteId: ID!): ID!
    # We'll add updateNote and moveNote later
    updateNote(noteId: ID!, content: String, color: String): Note
    updateNotePosition(noteId: ID!, positionX: Float!, positionY: Float!): Note
    voteNote(noteId: ID!, type: VoteType!): Note
    addCollaborator(boardId: ID!, username: String!): Board
  }

  # --- Subscription Type (Phase 2) ---
  type Subscription {
    noteUpdated(boardId: ID!): NoteUpdatePayload
  }
  # Assumed union/interface structure for subscription payload (based on previous discussion)
   union NoteUpdatePayload = Note | NoteDeletionPayload

type NoteDeletionPayload {
    id: ID!
    _deleted: Boolean! # Flag to signal deletion
}
`;

export default typeDefs;

// Why This Schema?
// - Input Types: Forces clients to send exactly what we expect (e.g., RegisterInput), which is cleaner than passing 3 separate arguments.
// - AuthPayload: Standard practice to return the JWT (token) and the User object after a successful login/registration.
// - '!' (Required): Ensures data integrity. For example, a Note *must* have content and position.
// - Creator Field: Linking the Note back to the User is essential for authorization checks.
