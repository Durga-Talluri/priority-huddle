// client/priority-hurdle/src/graphql/subscriptions.ts (Final Corrected Query)

import { gql } from "@apollo/client";

export const NOTE_UPDATED_SUBSCRIPTION = gql`
  subscription NoteUpdated($boardId: ID!) {
    noteUpdated(boardId: $boardId) {
      # NOTE: Querying fields directly on the Union (like 'id') is often disallowed.
      __typename # Keep this at the top level
      # 1. Fragment for Note (Creation/Update)
      ... on Note {
        id # <-- ADDED 'id' here
        content
        color
        positionX
        positionY
        upvotes
        aiPriorityScore
        aiContentScore
        aiRationale
        width
        height
        creator {
          id
          username
        }
      }

      # 2. Fragment for NoteDeletionPayload (Deletion)
      ... on NoteDeletionPayload {
        id # <-- ADDED 'id' here
        _deleted
      }
    }
  }
`;
export const NOTE_PRESENCE_SUBSCRIPTION = gql`
  subscription NotePresenceSubscription($boardId: ID!) {
    notePresence(boardId: $boardId) {
      noteId
      userId
      username
      status
      initials
      colorHex
      displayName
    }
  }
`;
