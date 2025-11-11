// client/src/components/Note.tsx
import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { RiDraggable } from "react-icons/ri";
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
  BROADCAST_PRESENCE_MUTATION,
  UPDATE_NOTE_SIZE,
} from "../graphql/mutations";
import Draggable from "react-draggable";
import type { DraggableEvent, DraggableData } from "react-draggable";
import { useMutation } from "@apollo/client/react";
import type { NoteType as NoteProps, PresenceUser } from "../types/NoteTypes";
import { debounce } from "../utils/debounce";
import { getContrastColor } from "../utils/avatarGenerator";
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
  focusedUsers = {},
  currentUserId,
  width: initialWidth = 256,
  height: initialHeight = 150,
  aiPriorityScore,
  aiContentScore,
  aiRationale,
}) => {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);

  const [noteContent, setNoteContent] = useState(content);
  const [position, setPosition] = useState({ x: positionX, y: positionY });
  const [size, setSize] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [zIndex, setZIndex] = useState<number>(1000);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);

  // Cap z-index to ensure modals always appear above notes
  const MAX_NOTE_Z_INDEX = 9999;

  const [updatePosition] = useMutation(UPDATE_NOTE_POSITION);
  const [updateNote] = useMutation(UPDATE_NOTE_MUTATION);
  const [voteNote] = useMutation(VOTE_NOTE_MUTATION);
  const [broadcastPresence] = useMutation(BROADCAST_PRESENCE_MUTATION);
  const [updateSize] = useMutation(UPDATE_NOTE_SIZE);

  // Get all users editing this note (excluding current user)
  const editingUsers = (focusedUsers[id] || []).filter(
    (u) => u.userId !== currentUserId
  );
  const isFocusedByAnotherUser = editingUsers.length > 0;
  const primaryEditor = editingUsers[0]; // Use first editor for highlight color

  // Sync incoming props (from subscriptions) into local state
  useEffect(() => {
    setNoteContent(content);
  }, [content]);

  // Only update position from props if we're not currently dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setPosition({ x: positionX, y: positionY });
    }
  }, [positionX, positionY]);

  // Only update size from props if we're not currently resizing
  useEffect(() => {
    if (
      !isResizingRef.current &&
      (initialWidth !== size.width || initialHeight !== size.height)
    ) {
      setSize({ width: initialWidth, height: initialHeight });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWidth, initialHeight]);

  const handleFocus = () => {
    // 1. Start editing (local state)
    setIsEditing(true);

    // 2. Set window editing note ID
    try {
      window.__editingNoteId = id;
    } catch {
      /* ignore */
    }

    // 3. Broadcast presence
    broadcastPresence({ variables: { noteId: id, status: "FOCUS" } });
  };

  const handleBlur = () => {
    // 1. Stop editing (local state)
    setIsEditing(false);

    // 2. Clear window editing note ID
    try {
      if (window.__editingNoteId === id) window.__editingNoteId = null;
    } catch {
      /* ignore */
    }

    // 3. Broadcast blur
    broadcastPresence({ variables: { noteId: id, status: "BLUR" } });
  };

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
    isDraggingRef.current = true;
    try {
      window.__noteZIndex = Math.min(
        (window.__noteZIndex || 1000) + 1,
        MAX_NOTE_Z_INDEX
      );
      setZIndex(window.__noteZIndex);
      document.body.style.userSelect = "none";
    } catch {
      /* ignore */
    }
  };

  // Show ghost while dragging and update position
  const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
    // Update position during drag so react-draggable can move the note
    setPosition({ x: data.x, y: data.y });
    setGhostPos({ x: data.x, y: data.y });
  };

  // Calculate bounds for the draggable note to keep it within the board canvas
  const getBounds = useCallback(() => {
    const board = document.getElementById("board-canvas");
    if (!board || !nodeRef.current) {
      // Return safe defaults if board or note ref not available
      return { left: 0, top: 0, right: 1000, bottom: 1000 };
    }

    // Get board dimensions and padding
    const padding = 24; // p-6 = 24px padding
    const noteWidth = size.width; // Use dynamic width
    const noteHeight = size.height; // Use dynamic height

    // Use the board's actual scroll dimensions to allow dragging in the full scrollable area
    // Ensure the note can't be dragged outside the board boundaries
    const maxRight = board.scrollWidth - noteWidth - padding;
    const maxBottom = board.scrollHeight - noteHeight - padding;

    return {
      left: padding,
      top: padding,
      right: Math.max(padding, maxRight), // Ensure right is at least padding
      bottom: Math.max(padding, maxBottom), // Ensure bottom is at least padding
    };
  }, [size.width, size.height]);

  // Helper: perform collision nudging and return final coords
  const computeCollisionNudgedPosition = useCallback(
    (rawX: number, rawY: number) => {
      const final = { x: rawX, y: rawY };
      const board = document.getElementById("board-canvas");
      if (!board || !nodeRef.current) return final;

      const boardRect = board.getBoundingClientRect();

      // Use the provided rawX/rawY which are already relative to the board
      const myRect = {
        left: rawX,
        top: rawY,
        right: rawX + nodeRef.current.offsetWidth,
        bottom: rawY + nodeRef.current.offsetHeight,
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
        for (const other of others) {
          if (other.dataset?.noteId === id) continue;

          // Get the other note's position from its style (react-draggable sets transform)
          const otherRect = other.getBoundingClientRect();
          const otherBoardLeft =
            otherRect.left - boardRect.left + board.scrollLeft;
          const otherBoardTop = otherRect.top - boardRect.top + board.scrollTop;

          const or = {
            left: otherBoardLeft,
            top: otherBoardTop,
            right: otherBoardLeft + otherRect.width,
            bottom: otherBoardTop + otherRect.height,
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
    isDraggingRef.current = false;
    setGhostPos(null);

    // Get bounds to ensure note stays within canvas
    const bounds = getBounds();

    // Clamp position to bounds to ensure note never goes outside canvas
    const clampedX = Math.max(bounds.left, Math.min(bounds.right, data.x));
    const clampedY = Math.max(bounds.top, Math.min(bounds.bottom, data.y));

    // compute final position with collision nudging
    const final = computeCollisionNudgedPosition(clampedX, clampedY);

    // Final bounds check after collision nudging
    const finalX = Math.max(bounds.left, Math.min(bounds.right, final.x));
    const finalY = Math.max(bounds.top, Math.min(bounds.bottom, final.y));

    // update local state
    setPosition({ x: finalX, y: finalY });

    // send to server (optimistic)
    updatePosition({
      variables: { noteId: id, x: finalX, y: finalY },
      optimisticResponse: {
        updateNotePosition: {
          __typename: "Note",
          id: id,
          positionX: finalX,
          positionY: finalY,
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

  // Debounced resize updater
  const debouncedUpdateSize = useMemo(
    () =>
      debounce((newSize: { width: number; height: number }) => {
        updateSize({
          variables: {
            noteId: id,
            width: newSize.width,
            height: newSize.height,
          },
        });
      }, 300),
    [id, updateSize]
  );

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    isResizingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "nwse-resize";

    // Bring note to front
    try {
      window.__noteZIndex = Math.min(
        (window.__noteZIndex || 1000) + 1,
        MAX_NOTE_Z_INDEX
      );
      setZIndex(window.__noteZIndex);
    } catch {
      /* ignore */
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    let currentSize = { width: startWidth, height: startHeight };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const minWidth = 150;
      const minHeight = 100;
      const newWidth = Math.max(minWidth, startWidth + deltaX);
      const newHeight = Math.max(minHeight, startHeight + deltaY);

      currentSize = { width: newWidth, height: newHeight };
      setSize(currentSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      isResizingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      // Save final size
      debouncedUpdateSize(currentSize);

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Keyboard nudging handler (attached to the handle)
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 16 : 4; // Shift for larger jumps
    let didMove = false;
    const next = { ...position };

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
        window.__noteZIndex = Math.min(
          (window.__noteZIndex || 1000) + 1,
          MAX_NOTE_Z_INDEX
        );
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
    width: `${size.width}px`,
    minHeight: `${size.height}px`,
    height: `${size.height}px`,
    boxShadow: isEditing
      ? "10px 18px 36px rgba(0,0,0,0.34)"
      : isDragging || isResizing
      ? "8px 14px 30px rgba(0,0,0,0.3)"
      : isFocusedByAnotherUser && primaryEditor
      ? `0 0 0 2px ${primaryEditor.colorHex}40, 0 0 8px ${primaryEditor.colorHex}60, 2px 2px 8px rgba(0,0,0,0.12)`
      : "2px 2px 8px rgba(0,0,0,0.12)",
    border: isFocusedByAnotherUser && primaryEditor
      ? `1px dashed ${primaryEditor.colorHex}`
      : undefined,
    cursor: isDragging ? "grabbing" : undefined,
    zIndex: zIndex,
    transition:
      isDragging || isResizing
        ? "box-shadow 120ms"
        : "transform 200ms ease, box-shadow 200ms, border 200ms",
  };

  // Calculate highlight style if being edited by another user
  const highlightStyle = isFocusedByAnotherUser && primaryEditor
    ? {
        boxShadow: `0 0 0 2px ${primaryEditor.colorHex}40, 0 0 8px ${primaryEditor.colorHex}60`,
        border: `1px dashed ${primaryEditor.colorHex}`,
      }
    : {};

  return (
    <div className="relative">
      {/* Editing indicator badge */}
      {isFocusedByAnotherUser && primaryEditor && (
        <div
          className="absolute top-[-10px] right-0 text-xs px-2 py-1 rounded-full shadow-md z-50 flex items-center gap-1"
          style={{
            backgroundColor: primaryEditor.colorHex,
            color: primaryEditor.textColor || getContrastColor(primaryEditor.colorHex),
          }}
        >
          <span className="font-semibold">{primaryEditor.initials}</span>
          <span>{primaryEditor.displayName} is editing...</span>
        </div>
      )}
      <Draggable
        disabled={isEditing || isResizing}
        nodeRef={nodeRef}
        position={position}
        onStart={handleStart}
        onDrag={handleDrag}
        onStop={handleStop}
        handle=".note-drag-handle"
        bounds={getBounds()}
        cancel="textarea, .resize-handle"
      >
        <div
          ref={nodeRef}
          data-note-id={id}
          className={`note group absolute pt-8 pb-4 px-4 rounded-lg flex flex-col justify-between transition-all select-none relative`}
          style={noteStyle}
        >
          {/* Hover tooltip for editing users */}
          {isFocusedByAnotherUser && primaryEditor && (
            <div
              className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-3 py-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap"
              role="tooltip"
              aria-label={`${primaryEditor.displayName} is editing this note`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{
                    backgroundColor: primaryEditor.colorHex,
                    color: primaryEditor.textColor || getContrastColor(primaryEditor.colorHex),
                  }}
                >
                  {primaryEditor.initials}
                </div>
                <span>{primaryEditor.displayName} is editing this note</span>
              </div>
              {/* Tooltip arrow */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black" />
              </div>
            </div>
          )}
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
                window.__noteZIndex = Math.min(
                  (window.__noteZIndex || 1000) + 1,
                  MAX_NOTE_Z_INDEX
                );
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
            onBlur={handleBlur}
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
                disabled={votes === 0}
                onClick={() => handleVote("DOWN")}
                className="cursor-pointer p-1 rounded hover:bg-red-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Downvote"
              >
                <BiSolidDownvote className="text-red-600 text-base" />
              </button>
            </div>

            {/* Creator */}
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-gray-800 text-xs">
                {creator.username}
              </span>
            </div>

            {/* Delete Button */}
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

          {/* Resize handle - bottom right corner */}
          <div
            ref={resizeHandleRef}
            onMouseDown={handleResizeStart}
            className="resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 flex items-center justify-center"
            title="Resize note"
            role="button"
            aria-label="Resize note"
            style={{ pointerEvents: isEditing ? "none" : "auto" }}
          >
            <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-gray-500 rounded-br-lg" />
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
    </div>
  );
};

export default Note;
