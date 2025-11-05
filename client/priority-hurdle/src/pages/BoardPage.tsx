// client/src/pages/BoardPage.tsx

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useSubscription,
  useApolloClient,
} from "@apollo/client/react";
// removed unused imports
import { GET_BOARD, GET_ME } from "../graphql/queries";
import { DELETE_NOTE_MUTATION } from "../graphql/mutations";
import { NOTE_UPDATED_SUBSCRIPTION } from "../graphql/subscriptions";
import CreateNoteForm from "../components/CreateNoteForm";
import BoardToolbar from "../components/BoardToolbar";
import DraggableNote from "../components/Note";
import CollaboratorModal from "../components/CollaboratorModel";
import type { NoteType } from "../types/NoteTypes";

// --- Data Interfaces ---
interface BoardData {
  board: {
    id: string;
    title: string;
    // FIX: The ID is now nested inside the 'creator' object
    creator: {
      id: string;
    };
    notes: NoteType[];
  };
}
interface UserData {
  me: {
    id: string;
    username: string;
  };
}

// Subscription payload shape (partial)
interface NotePayload {
  id: string;
  __typename?: string;
  _deleted?: boolean;
  content?: string;
  color?: string;
  positionX?: number;
  positionY?: number;
  upvotes?: number;
  aiPriorityScore?: number;
  creator?: { id: string; username?: string };
}

const BoardPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const client = useApolloClient();
  const boardRef = useRef<HTMLDivElement>(null);

  // --- Local States ---
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(
    null
  );
  const [newNotePosition, setNewNotePosition] = useState({ x: 50, y: 50 });

  // =========================================================
  // 1. HOOK CALLS (MUST BE UNCONDITIONAL)
  // =========================================================

  // Fetch current user details for authorization
  const { data: userData } = useQuery<UserData>(GET_ME, { skip: !boardId });
  const currentUserId = userData?.me?.id;

  // Fetch the Board data
  const { loading, error, data } = useQuery<BoardData>(GET_BOARD, {
    variables: { boardId },
    fetchPolicy: "cache-and-network",
    skip: !boardId,
  });

  // Setup Subscription
  const { data: subscriptionData } = useSubscription<{
    noteUpdated: NotePayload;
  }>(NOTE_UPDATED_SUBSCRIPTION, {
    variables: { boardId },
    skip: !boardId,
  });

  // Setup Delete Mutation
  const [deleteNote, { loading: isDeleting }] = useMutation<
    { deleteNote: string },
    { noteId: string }
  >(DELETE_NOTE_MUTATION, {
    // Manual cache update for instant deletion feedback
    update(cache, result) {
      const deletedNoteId = result.data?.deleteNote;
      if (!deletedNoteId) return;

      cache.updateQuery<BoardData | null>(
        { query: GET_BOARD, variables: { boardId } },
        (existing) => {
          if (!existing || !existing.board || !existing.board.notes)
            return existing;

          const newNotes = existing.board.notes.filter(
            (note: NoteType) => note.id !== deletedNoteId
          );

          return {
            board: {
              ...existing.board,
              notes: newNotes,
            },
          } as unknown as BoardData;
        }
      );
    },
  });

  // =========================================================
  // 2. SUBSCRIPTION HANDLER (useEffect)
  // =========================================================
  // client/src/pages/BoardPage.tsx (Inside subscription useEffect)

  useEffect(() => {
    if (subscriptionData?.noteUpdated) {
      const rawPayload = subscriptionData.noteUpdated;
      console.log("📨 Subscription received:", rawPayload);

      const payload = {
        ...rawPayload,
        __typename: rawPayload._deleted ? "NoteDeletionPayload" : "Note",
      };

      if (payload._deleted) {
        // Handle deletion
        console.log("🗑️ Deleting note:", payload.id);

        client.cache.updateQuery<BoardData>(
          { query: GET_BOARD, variables: { boardId } },
          (existing) => {
            if (!existing?.board?.notes) return existing;

            return {
              board: {
                ...existing.board,
                notes: existing.board.notes.filter(
                  (note) => note.id !== payload.id
                ),
              },
            } as unknown as BoardData;
          }
        );
      } else {
        // Handle update or creation
        console.log("✏️ Updating/Creating note:", payload.id);

        client.cache.updateQuery<BoardData>(
          { query: GET_BOARD, variables: { boardId } },
          (existing) => {
            if (!existing?.board?.notes) return existing;

            const noteIndex = existing.board.notes.findIndex(
              (note) => note.id === payload.id
            );

            const updatedNote = {
              __typename: "Note" as const,
              id: payload.id,
              content: payload.content ?? "",
              color: payload.color ?? "#ffebee",
              positionX: payload.positionX ?? 50,
              positionY: payload.positionY ?? 50,
              upvotes: payload.upvotes ?? 0,
              aiPriorityScore: payload.aiPriorityScore ?? null,
              creator: payload.creator ?? { id: "", username: "" },
            };

            if (noteIndex >= 0) {
              // Update existing note
              console.log("📝 Updating existing note at index:", noteIndex);
              const newNotes = [...existing.board.notes];
              newNotes[noteIndex] = {
                ...existing.board.notes[noteIndex],
                ...updatedNote,
              } as NoteType;

              return {
                board: {
                  ...existing.board,
                  notes: newNotes,
                },
              } as unknown as BoardData;
            } else {
              // Add new note
              console.log("➕ Adding new note to list");
              return {
                board: {
                  ...existing.board,
                  notes: [
                    updatedNote as unknown as NoteType,
                    ...existing.board.notes,
                  ],
                },
              } as unknown as BoardData;
            }
          }
        );

        console.log("✅ Cache update complete");
      }
    }
  }, [subscriptionData, client, boardId]);
  // =========================================================
  // 3. HANDLERS & HELPERS
  // =========================================================

  const startNewNoteCreation = () => {
    // Use DOM measurements of existing .note elements inside the board to avoid collisions
    const board = boardRef.current;
    const NOTE_W = 250;
    const NOTE_H = 150;
    const nudge = 24;
    let x =
      (board?.scrollLeft || 0) + ((board?.clientWidth || 800) / 2 - NOTE_W / 2);
    let y = (board?.scrollTop || 0) + 50;

    if (board) {
      const boardRect = board.getBoundingClientRect();
      const noteEls = Array.from(
        board.querySelectorAll<HTMLDivElement>(".note")
      );
      const others = noteEls.map((el) => {
        const r = el.getBoundingClientRect();
        const left = r.left - boardRect.left + board.scrollLeft;
        const top = r.top - boardRect.top + board.scrollTop;
        return { left, top, right: left + r.width, bottom: top + r.height };
      });

      const isOverlapping = (
        a: { left: number; top: number; right: number; bottom: number },
        b: { left: number; top: number; right: number; bottom: number }
      ) =>
        !(
          a.left >= b.right ||
          a.right <= b.left ||
          a.top >= b.bottom ||
          a.bottom <= b.top
        );

      let attempts = 0;
      const maxAttempts = 50;
      while (attempts < maxAttempts) {
        const myRect = {
          left: x,
          top: y,
          right: x + NOTE_W,
          bottom: y + NOTE_H,
        };
        const collided = others.some((o) => isOverlapping(myRect, o));
        if (!collided) break;
        // try nudging right/down; if we reach far edge, wrap to left and move down
        x += nudge;
        if (x + NOTE_W > board.scrollLeft + board.clientWidth - 16) {
          x = board.scrollLeft + 16;
          y += nudge;
        }
        attempts += 1;
      }
    }

    setNewNotePosition({ x, y });
    setIsCreatingNote(true);
  };

  const handleDeleteNote = (noteId: string) => {
    // open confirmation modal instead of blocking window.confirm
    setPendingDeleteNoteId(noteId);
  };

  const cancelPendingDelete = () => setPendingDeleteNoteId(null);

  const confirmPendingDelete = () => {
    if (!pendingDeleteNoteId) return;
    deleteNote({ variables: { noteId: pendingDeleteNoteId } })
      .catch(console.error)
      .finally(() => setPendingDeleteNoteId(null));
  };

  // =========================================================
  // 4. CONDITIONAL RENDERING
  // =========================================================

  // Check for missing ID only after hooks are called
  if (!boardId) {
    return (
      <p className="text-xl text-red-600 p-8">
        Error: Board ID not provided in the URL.
      </p>
    );
  }

  // Display loading/error/deleting states
  if (loading) return <p className="text-xl text-gray-600">Loading board...</p>;
  if (error)
    return <p className="text-xl text-red-600">Error: {error.message}</p>;
  if (!data?.board)
    return <p className="text-xl text-gray-600">Board not found.</p>;
  if (isDeleting)
    return <p className="text-xl text-gray-600">Deleting note...</p>;

  const { title, notes, creator } = data.board;

  // FIX: Authorization Check now uses creator.id
  const isCreator = currentUserId && creator.id === currentUserId;

  return (
    <div className="w-full h-screen  flex flex-col px-6 lg:px-10">
      <header className="flex justify-between items-center mb-4 mt-4">
        <h1 className="text-3xl font-semibold text-slate-700 drop-shadow-sm">
          {title}
        </h1>

        {/* Conditional Invite Button for the creator */}
        {isCreator && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition"
          >
            + Invite Collaborator
          </button>
        )}
      </header>

      {/* 4. Board Workspace Container */}
      <div
        id="board-canvas"
        ref={boardRef}
        className="flex-1 relative w-full h-full overflow-auto rounded-2xl  border border-gray-200  bg-[radial-gradient(circle,_rgba(0,0,0,0.05)_1px,_transparent_1px)] [background-size:20px_20px] bg-gray-50 p-6 shadow-inner"
      >
        {/* Render the Draggable Notes */}
        {notes.map((note) => (
          <DraggableNote key={note.id} {...note} onDelete={handleDeleteNote} />
        ))}

        {/* Creation Form Modal/Panel */}
        {isCreatingNote && (
          <div
            className="absolute top-0 left-0"
            style={{
              transform: `translate(${newNotePosition.x}px, ${newNotePosition.y}px)`,
            }}
          >
            <CreateNoteForm
              boardId={boardId}
              initialPosition={newNotePosition}
              onSuccess={() => setIsCreatingNote(false)}
              onCancel={() => setIsCreatingNote(false)}
            />
          </div>
        )}
      </div>

      {/* Toolbar and Modals */}

      <BoardToolbar onAddNewNote={startNewNoteCreation} boardId={boardId} />

      {isInviteModalOpen && (
        <CollaboratorModal
          boardId={boardId}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}

      {/* Confirmation modal for deleting a note */}
      {pendingDeleteNoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={cancelPendingDelete}
            aria-hidden
          />
          <div className="relative bg-white rounded-lg p-6 shadow-lg w-11/12 max-w-md">
            <h3 className="text-lg font-semibold mb-2">Delete note?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this note? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelPendingDelete}
                className="px-3 py-1 rounded-md border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmPendingDelete}
                className="px-3 py-1 rounded-md bg-red-600 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardPage;
