// client/src/components/PriorityLeaderboard.tsx

import React, { useState, useMemo, useEffect, useRef } from "react";
import type { NoteType } from "../types/NoteTypes";
import { BiSolidUpvote } from "react-icons/bi";
import { HiSparkles } from "react-icons/hi";

type SortMode = "aiPriority" | "aiContent" | "upvotes";

interface PriorityLeaderboardProps {
  notes: NoteType[];
  onNoteClick?: (noteId: string) => void;
  boardObjective?: string;
}

const PriorityLeaderboard: React.FC<PriorityLeaderboardProps> = ({
  notes,
  onNoteClick,
  boardObjective = "Reduce customer churn by improving onboarding conversion and decreasing time-to-value for new customers.",
}) => {
  const [sortMode, setSortMode] = useState<SortMode>("aiPriority");
  const prevScoresRef = useRef<Record<string, number>>({});
  const [pulsingNotes, setPulsingNotes] = useState<Set<string>>(new Set());

  // Track score changes for animations
  useEffect(() => {
    const newPulsing = new Set<string>();
    notes.forEach((note) => {
      const noteId = note.id;
      const currentScore = note.aiPriorityScore ?? 0;
      const prevScore = prevScoresRef.current[noteId];

      if (prevScore !== undefined && prevScore !== currentScore) {
        newPulsing.add(noteId);
        setTimeout(() => {
          setPulsingNotes((prev) => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
          });
        }, 700);
      }
    });

    if (newPulsing.size > 0) {
      setPulsingNotes(newPulsing);
    }

    // Update previous scores in ref (doesn't trigger re-render)
    const newPrevScores: Record<string, number> = {};
    notes.forEach((note) => {
      newPrevScores[note.id] = note.aiPriorityScore ?? 0;
    });
    prevScoresRef.current = newPrevScores;
  }, [notes]);

  // Sort notes based on current sort mode
  const sortedNotes = useMemo(() => {
    const sorted = [...notes];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case "aiPriority":
          return (b.aiPriorityScore ?? 0) - (a.aiPriorityScore ?? 0);
        case "aiContent":
          return (b.aiContentScore ?? 0) - (a.aiContentScore ?? 0);
        case "upvotes":
          return b.upvotes - a.upvotes;
        default:
          return 0;
      }
    });
    return sorted;
  }, [notes, sortMode]);

  const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "—";
    return score.toFixed(2);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HiSparkles className="text-indigo-600" />
            Priority Leaderboard
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSortMode("aiPriority")}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  sortMode === "aiPriority"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="Sort by combined AI priority score"
              >
                Combined
              </button>
              <button
                onClick={() => setSortMode("aiContent")}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  sortMode === "aiContent"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="Sort by AI content score"
              >
                AI Only
              </button>
              <button
                onClick={() => setSortMode("upvotes")}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  sortMode === "upvotes"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="Sort by upvotes"
              >
                Votes
              </button>
            </div>
          </div>
        </div>

        {/* Board Objective Chip */}
        {boardObjective && (
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200">
            <span className="text-xs font-medium text-indigo-800">
              Objective: {boardObjective}
            </span>
          </div>
        )}
      </div>

      {/* Leaderboard List */}
      <div
        className="space-y-2"
        role="list"
        aria-label="Priority leaderboard"
        aria-live="polite"
      >
        {sortedNotes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No notes yet. Create your first note to see the leaderboard!
          </div>
        ) : (
          sortedNotes.map((note, index) => {
            const combinedScore = note.aiPriorityScore ?? 0;
            const aiScore = note.aiContentScore ?? 0;
            const isPulsing = pulsingNotes.has(note.id);

            return (
              <div
                key={note.id}
                role="listitem"
                onClick={() => onNoteClick?.(note.id)}
                className={`p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer ${
                  isPulsing
                    ? "ring-2 ring-indigo-300/50 animate-[pulse_700ms_linear]"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Rank and Title */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-indigo-700">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {note.content.split("\n")[0] || "Untitled"}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {note.content.split("\n").slice(1).join(" ") || note.content}
                      </p>
                    </div>
                  </div>

                  {/* Scores and Metrics */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Combined Score Badge */}
                    <div className="flex flex-col items-end gap-1">
                      <div
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white ${
                          isPulsing ? "animate-pulse" : ""
                        }`}
                        aria-label={`Combined priority score ${formatScore(
                          combinedScore
                        )} of 1.00`}
                      >
                        {formatScore(combinedScore)}
                      </div>
                      {/* Progress Bar */}
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-300"
                          style={{ width: `${combinedScore * 100}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {/* AI Score Chip */}
                    <div className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-300">
                      AI: {formatScore(aiScore)}
                    </div>

                    {/* Upvotes */}
                    <div className="flex items-center gap-1 text-gray-600">
                      <BiSolidUpvote className="text-green-600" />
                      <span className="text-sm font-medium">{note.upvotes}</span>
                    </div>

                    {/* Creator */}
                    <div className="text-xs text-gray-500">
                      {note.creator.username}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PriorityLeaderboard;

