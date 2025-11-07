import { gql } from "@apollo/client";
import { NOTE_FIELDS } from "./queries";

// NOTE: Enum types must be defined on the server schema. Do NOT include schema/type definitions in client operation documents.

// --- AUTHENTICATION ---
export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
        email
      }
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        username
        email
      }
    }
  }
`;

// --- BOARD MUTATIONS ---
export const CREATE_BOARD_MUTATION = gql`
  mutation CreateBoard($title: String!) {
    createBoard(title: $title) {
      id
      title
      # Correctly selecting subfields for the complex User type
      creator {
        id
        username
      }
    }
  }
`;

export const ADD_COLLABORATOR_MUTATION = gql`
  mutation AddCollaborator($boardId: ID!, $username: String!) {
    addCollaborator(boardId: $boardId, username: $username) {
      id
      title
      # Correctly selecting subfields for the complex User type
      creator {
        id
        username
      }
      # The 'collaborators' field is correctly omitted/avoided here to prevent validation errors
    }
  }
`;

// --- NOTE CRUD & INTERACTIVITY ---
export const CREATE_NOTE_MUTATION = gql`
  mutation CreateNote(
    $boardId: ID!
    $content: String!
    $color: String!
    $positionX: Float!
    $positionY: Float!
  ) {
    createNote(
      boardId: $boardId
      content: $content
      color: $color
      positionX: $positionX
      positionY: $positionY
    ) {
      ...NoteFields
    }
  }
  ${NOTE_FIELDS}
`;

export const UPDATE_NOTE_POSITION = gql`
  mutation UpdateNotePosition($noteId: ID!, $x: Float!, $y: Float!) {
    updateNotePosition(noteId: $noteId, positionX: $x, positionY: $y) {
      id
      positionX
      positionY
    }
  }
`;

export const UPDATE_NOTE_SIZE = gql`
  mutation UpdateNoteSize($noteId: ID!, $width: Float!, $height: Float!) {
    updateNoteSize(noteId: $noteId, width: $width, height: $height) {
      id
      width
      height
    }
  }
`;

export const UPDATE_NOTE_MUTATION = gql`
  mutation UpdateNote($noteId: ID!, $content: String, $color: String) {
    updateNote(noteId: $noteId, content: $content, color: $color) {
      ...NoteFields
    }
  }
  ${NOTE_FIELDS}
`;

export const VOTE_NOTE_MUTATION = gql`
  mutation VoteNote($noteId: ID!, $type: VoteType!) {
    voteNote(noteId: $noteId, type: $type) {
      id
      upvotes
    }
  }
`;
export const DELETE_NOTE_MUTATION = gql`
  mutation DeleteNote($noteId: ID!) {
    deleteNote(noteId: $noteId)
  }
`;
export const BROADCAST_PRESENCE_MUTATION = gql`
  mutation BroadcastPresence($noteId: ID!, $status: String!) {
    broadcastPresence(noteId: $noteId, status: $status)
  }
`;
