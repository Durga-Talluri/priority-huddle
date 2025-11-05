// client/src/components/CreateNoteForm.tsx

import React, { useState } from "react";
import { useMutation, useApolloClient } from "@apollo/client/react";
import type { FetchResult } from "@apollo/client";
import { CREATE_NOTE_MUTATION } from "../graphql/mutations";
import { GET_BOARD } from "../graphql/queries";
import { IoCloseSharp } from "react-icons/io5";

interface CreateNoteFormProps {
  boardId: string;
  onSuccess: () => void; // Callback to close the form/modal on success
  onCancel: () => void; // Callback to close the form/modal on cancel
  initialPosition: { x: number; y: number }; // Where the note should appear
}

const COLORS = ["#ffebee", "#e3f2fd", "#e8f5e9", "#fffde7", "#fbe9e7"]; // Light, pastel colors

const CreateNoteForm: React.FC<CreateNoteFormProps> = ({
  boardId,
  onSuccess,
  onCancel,
  initialPosition,
}) => {
  const [content, setContent] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  // Initialize the Create Mutation Hook
  type NoteMinimal = {
    id: string;
    content?: string;
    positionX?: number;
    positionY?: number;
    [k: string]: unknown;
  };

  const client = useApolloClient();

  const [createNote, { loading }] = useMutation(CREATE_NOTE_MUTATION);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createNote({
      variables: {
        boardId,
        content,
        color,
        // Pass the initial position so the server can save it immediately
        positionX: initialPosition.x,
        positionY: initialPosition.y,
      },
    })
      .then((res) => {
        // update cache manually so the new note appears immediately
        const data = (res as FetchResult<unknown>).data as
          | { createNote?: NoteMinimal }
          | undefined;
        const newNote = data?.createNote;
        if (newNote) {
          const existingBoard = client.cache.readQuery<{
            board?: { id: string; notes: NoteMinimal[] };
          } | null>({
            query: GET_BOARD,
            variables: { boardId },
          });
          if (existingBoard && existingBoard.board) {
            const newNotes = [newNote, ...existingBoard.board.notes];
            client.cache.writeQuery({
              query: GET_BOARD,
              variables: { boardId },
              data: { board: { ...existingBoard.board, notes: newNotes } },
            });
          }
        }
        setContent("");
        onSuccess(); // Close the form
      })
      .catch((err) => {
        console.error("Error creating note:", err);
        alert(`Failed to create note: ${err.message}`);
      });
  };
  return (
    <form
      onSubmit={handleSubmit}
      className="relative p-4 rounded-lg shadow-xl w-full sm:w-80 z-50 border border-gray-200"
      style={{ backgroundColor: color }}
      aria-label="Create note"
    >
      {/* Top-right close button (cancel) */}
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        aria-label="Close"
        title="Cancel"
        className="absolute top-0 right-2 p-1 rounded-md cursor-pointer text-slate-800 hover:bg-slate-300/30 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <span aria-hidden>
          <IoCloseSharp size={18} />
        </span>
      </button>
      <label htmlFor="new-note-content" className="sr-only">
        New note content
      </label>
      <textarea
        id="new-note-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type new note content..."
        maxLength={200}
        rows={6}
        className="w-full p-3 border border-transparent focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none rounded-md mb-3  mt-1 bg-transparent placeholder-gray-600 text-gray-900 leading-relaxed"
        required
        disabled={loading}
      />

      {/* Color Picker and Action Buttons */}
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-2">
          <span className="sr-only">Choose color</span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-pressed={color === c}
              aria-label={`Choose color ${c}`}
              title={c}
              className={`w-6 h-6 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-200 border-2 ${
                color === c ? "border-indigo-600" : "border-gray-300"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className=" cursor-pointer bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition duration-150 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            disabled={!content.trim() || loading}
          >
            {loading ? "Posting..." : "Post Note"}
          </button>
        </div>
      </div>
    </form>
  );
};
export default CreateNoteForm;
