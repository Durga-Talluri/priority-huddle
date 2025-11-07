// client/src/graphql/queries.ts (Verified/Confirmed)

import { gql } from "@apollo/client";

// Fragment to define the core fields of a Note, making queries cleaner
export const NOTE_FIELDS = gql`
  fragment NoteFields on Note {
    id
    content
    color
    # Corrected field names match the backend structure:
    positionX
    positionY
    upvotes # Correct
    aiPriorityScore # Correct
    width
    height
    creator {
      id
      username
    }
  }
`;
export const BOARD_LIST_FIELDS = gql`
  fragment BoardListFields on Board {
    id
    title
    creator {
      id
      username
    }
  }
`;
export const GET_MY_BOARDS = gql`
  query MyBoards {
    myBoards {
      ...BoardListFields
    }
  }
  ${BOARD_LIST_FIELDS}
`;
export const GET_BOARD = gql`
  query GetBoard($boardId: ID!) {
    board(boardId: $boardId) {
      id
      title
      creator { 
        id
        username
      }
      notes {
        ...NoteFields
      }
    }
  }
  ${NOTE_FIELDS}
`;

// Query to get the currently logged-in user (No change)
export const GET_ME = gql`
  query Me {
    me {
      id
      username
    }
  }
`;
