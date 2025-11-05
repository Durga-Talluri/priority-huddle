// client/src/components/Note.tsx
import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { RiDraggable } from "react-icons/ri";
import { FaDeleteLeft } from "react-icons/fa6";
import { BiSolidUpvote, BiSolidDownvote } from "react-icons/bi";
// Extend Window with our app-specific fields used for z-index and editing lock
declare global {
  interface Window {
    __noteZIndex?: number;
    __editingNoteId?: string | null;
  }
}
import {
  UPDATE_NOTE_POSITION,
  UPDATE_NOTE_MUTATION,
  VOTE_NOTE_MUTATION,
} from "../graphql/mutations";
import Draggable from "react-draggable";
import type { DraggableEvent, DraggableData } from "react-draggable";
import { useMutation } from "@apollo/client/react";
import type { NoteType as NoteProps } from "../types/NoteTypes";
import { debounce } from "../utils/debounce";
import { IoCloseSharp } from "react-icons/io5";
const Note: React.FC<NoteProps> = ({
  id,
  content,
  color,
  creator,
  positionX,
  positionY,
  upvotes: votes,
  onDelete,
}) => {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const [noteContent, setNoteContent] = useState(content);
  const [position, setPosition] = useState({ x: positionX, y: positionY });
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [zIndex, setZIndex] = useState<number>(1000);

  const [updatePosition] = useMutation(UPDATE_NOTE_POSITION);
  const [updateNote] = useMutation(UPDATE_NOTE_MUTATION);
  const [voteNote] = useMutation(VOTE_NOTE_MUTATION);

  // Sync incoming props (from subscriptions) into local state
  useEffect(() => {
    setNoteContent(content);
  }, [content]);

  useEffect(() => {
    setPosition({ x: positionX, y: positionY });
  }, [positionX, positionY]);

  // Debounced save for content edits
  const debouncedSave = useMemo(
    () =>
      debounce((newContent: string) => {
        updateNote({
          variables: { noteId: id, content: newContent },
        });
      }, 1500),
    [id, updateNote]
  );

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setNoteContent(newContent);
    debouncedSave(newContent);
  };

  const handleFocus = () => {
    setIsEditing(true);
    try {
      window.__editingNoteId = id;
    } catch {
      /* ignore */
    }
  };
  const handleBlurEdit = () => {
    setIsEditing(false);
    try {
      if (window.__editingNoteId === id) window.__editingNoteId = null;
    } catch {
      /* ignore */
    }
  };

  // Voting handler (optimistic)
  const handleVote = (type: "UP" | "DOWN") => {
    voteNote({
      variables: { noteId: id, type },
      optimisticResponse: {
        voteNote: {
          __typename: "Note",
          id: id,
          votes: votes + (type === "UP" ? 1 : -1),
        },
      },
    });
  };

  // When drag starts (mouse handle or keyboard handled by Draggable)
  const handleStart = () => {
    // Defensive: if someone else is editing, we still allow interaction here but you might disable in stricter apps
    setIsDragging(true);
    try {
      window.__noteZIndex = (window.__noteZIndex || 1000) + 1;
      setZIndex(window.__noteZIndex);
      document.body.style.userSelect = "none";
    } catch {
      /* ignore */
    }
  };

  // Show ghost while dragging
  const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
    setGhostPos({ x: data.x, y: data.y });
  };

  // Helper: perform collision nudging and return final coords
  const computeCollisionNudgedPosition = useCallback(
    (rawX: number, rawY: number) => {
      const final = { x: rawX, y: rawY };
      const board = document.getElementById("board-canvas");
      if (!board || !nodeRef.current) return final;

      const myRect = {
        left: final.x,
        top: final.y,
        right: final.x + nodeRef.current.offsetWidth,
        bottom: final.y + nodeRef.current.offsetHeight,
      };

      const others = Array.from(
        board.querySelectorAll(".note")
      ) as HTMLElement[];
      const nudgeStep = 12;
      let attempts = 0;

      const isOverlapping = (
        r1: { left: number; top: number; right: number; bottom: number },
        r2: { left: number; top: number; right: number; bottom: number }
      ) =>
        !(
          r1.left >= r2.right ||
          r1.right <= r2.left ||
          r1.top >= r2.bottom ||
          r1.bottom <= r2.top
        );

      while (attempts < 8) {
        let collided = false;
        const boardRect = board.getBoundingClientRect();
        for (const other of others) {
          if (other.dataset?.noteId === id) continue;
          const rect = other.getBoundingClientRect();
          const or = {
            left: rect.left - boardRect.left,
            top: rect.top - boardRect.top,
            right: rect.right - boardRect.left,
            bottom: rect.bottom - boardRect.top,
          };
          if (isOverlapping(myRect, or)) {
            final.x += nudgeStep;
            final.y += nudgeStep;
            myRect.left = final.x;
            myRect.top = final.y;
            myRect.right = final.x + nodeRef.current.offsetWidth;
            myRect.bottom = final.y + nodeRef.current.offsetHeight;
            collided = true;
            break;
          }
        }
        if (!collided) break;
        attempts++;
      }
      return final;
    },
    [id]
  );

  // On drag stop, finalize position and send to server
  const handleStop = (_e: DraggableEvent, data: DraggableData) => {
    document.body.style.userSelect = "";
    setIsDragging(false);
    setGhostPos(null);

    // compute final position with collision nudging
    const rawX = data.x;
    const rawY = data.y;
    const final = computeCollisionNudgedPosition(rawX, rawY);

    // update local state
    setPosition(final);

    // send to server (optimistic)
    updatePosition({
      variables: { noteId: id, x: final.x, y: final.y },
      optimisticResponse: {
        updateNotePosition: {
          __typename: "Note",
          id: id,
          positionX: final.x,
          positionY: final.y,
        },
      },
    });
  };

  // Debounced position updater used for keyboard nudging (so rapid arrow presses don't spam server)
  const debouncedUpdatePosition = useMemo(
    () =>
      debounce((pos: { x: number; y: number }) => {
        updatePosition({
          variables: { noteId: id, x: pos.x, y: pos.y },
          optimisticResponse: {
            updateNotePosition: {
              __typename: "Note",
              id: id,
              positionX: pos.x,
              positionY: pos.y,
            },
          },
        });
      }, 250),
    [id, updatePosition]
  );

  // Keyboard nudging handler (attached to the handle)
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 16 : 4; // Shift for larger jumps
    let didMove = false;
    let next = { ...position };

    switch (e.key) {
      case "ArrowUp":
        next.y = position.y - step;
        didMove = true;
        break;
      case "ArrowDown":
        next.y = position.y + step;
        didMove = true;
        break;
      case "ArrowLeft":
        next.x = position.x - step;
        didMove = true;
        break;
      case "ArrowRight":
        next.x = position.x + step;
        didMove = true;
        break;
      default:
        break;
    }

    if (didMove) {
      e.preventDefault();
      // compute collision-aware position
      const final = computeCollisionNudgedPosition(next.x, next.y);
      // bump z-index visually
      try {
        window.__noteZIndex = (window.__noteZIndex || 1000) + 1;
        setZIndex(window.__noteZIndex);
      } catch {
        /* ignore */
      }
      setPosition(final);
      debouncedUpdatePosition(final);
    }
  };

  const noteStyle: React.CSSProperties = {
    backgroundColor: color,
    minHeight: "150px",
    boxShadow: isEditing
      ? "10px 18px 36px rgba(0,0,0,0.34)"
      : isDragging
      ? "8px 14px 30px rgba(0,0,0,0.3)"
      : "2px 2px 8px rgba(0,0,0,0.12)",
    cursor: isDragging ? "grabbing" : undefined,
    transform: isDragging ? "scale(1.03)" : undefined,
    zIndex: 20,
    transition: isDragging
      ? "transform 120ms ease, box-shadow 120ms"
      : "transform 200ms ease, box-shadow 200ms",
  };

  return (
    <>
      <Draggable
        disabled={isEditing}
        nodeRef={nodeRef}
        position={position}
        onStart={handleStart}
        onDrag={handleDrag}
        onStop={handleStop}
        bounds="parent"
        handle=".note-drag-handle"
        distance={6} // small threshold to avoid accidental drags
      >
        <div
          ref={nodeRef}
          data-note-id={id}
          className={`note group absolute pt-8 pb-4 px-4 rounded-lg flex flex-col justify-between w-64 transition-all select-none`}
          style={noteStyle}
        >
          {/* Grip / drag handle (hidden until hover or focus) */}
          <div
            ref={handleRef}
            className="note-drag-handle absolute top-2 left-2 z-20 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity cursor-grab active:cursor-grabbing select-none text-gray-500 hover:text-gray-700"
            title="Drag to move"
            role="button"
            aria-label="Drag note"
            tabIndex={0}
            onKeyDown={onHandleKeyDown}
            onMouseDown={() => {
              // ensure this note is visually brought forward on mousedown as well
              try {
                window.__noteZIndex = (window.__noteZIndex || 1000) + 1;
                setZIndex(window.__noteZIndex);
              } catch {
                /* ignore */
              }
            }}
          >
            <RiDraggable />
          </div>

          {/* Editable Content */}
          <textarea
            value={noteContent}
            onChange={handleContentChange}
            onFocus={handleFocus}
            onBlur={handleBlurEdit}
            placeholder="Start typing..."
            rows={4}
            className="w-full font-serif bg-transparent border-none focus:outline-none resize-none text-gray-900 grow mb-4 pt-2 select-text"
          />

          {/* Footer */}
          <div className="pt-2 border-t border-gray-700 border-opacity-30 text-xs flex justify-between items-center">
            {/* Voting Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleVote("UP")}
                className="cursor-pointer p-1 rounded hover:bg-green-50 active:scale-95"
                title="Upvote"
              >
                <BiSolidUpvote className=" text-green-600 text-base" />
              </button>
              <span className="font-bold text-sm text-gray-900">{votes}</span>
              <button
                onClick={() => handleVote("DOWN")}
                className="cursor-pointer p-1 rounded hover:bg-red-50 active:scale-95"
                title="Downvote"
              >
                <BiSolidDownvote className="text-red-600 text-base" />
              </button>
            </div>

            {/* Creator and Delete */}
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-800">
                  {creator.username}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(id);
                }}
                aria-label="Delete note"
                title="Delete note"
                className="absolute top-2 right-2 z-3"
              >
                <IoCloseSharp className="cursor-pointer size-5 text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-300" />
              </button>
            </div>
          </div>
        </div>
      </Draggable>

      {/* Ghost placeholder */}
      {ghostPos && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: ghostPos.x,
            top: ghostPos.y,
            width: nodeRef.current?.offsetWidth || 256,
            height: nodeRef.current?.offsetHeight || 160,
            backgroundColor: "rgba(0,0,0,0.06)",
            borderRadius: 8,
            border: "1px dashed rgba(0,0,0,0.08)",
            zIndex: 900,
            transition: "left 80ms linear, top 80ms linear",
          }}
        />
      )}
    </>
  );
};

export default Note;
