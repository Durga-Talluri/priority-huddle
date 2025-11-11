// client/src/components/NoteDetailPanel.tsx

import React, { useState } from "react";
import type { NoteType } from "../types/NoteTypes";
import { IoCloseSharp } from "react-icons/io5";
import { HiSparkles } from "react-icons/hi";

interface NoteDetailPanelProps {
  note: NoteType | null;
  onClose: () => void;
  onSaveOverride?: (noteId: string, overrideScore: number) => void;
}

const NoteDetailPanel: React.FC<NoteDetailPanelProps> = ({
  note,
  onClose,
  onSaveOverride,
}) => {
  const [overrideScore, setOverrideScore] = useState<string>("");

  if (!note) return null;

  const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "—";
    return score.toFixed(2);
  };

  const handleSaveOverride = () => {
    const score = parseFloat(overrideScore);
    if (!isNaN(score) && score >= 0 && score <= 1 && onSaveOverride) {
      onSaveOverride(note.id, score);
      setOverrideScore("");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[10000]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-detail-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto z-[10001]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2
            id="note-detail-title"
            className="text-lg font-semibold text-gray-900 flex items-center gap-2"
          >
            <HiSparkles className="text-indigo-600" />
            Note Details
          </h2>
          <button
            onClick={onClose}
            aria-label="Close detail panel"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <IoCloseSharp size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Note Content */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Content</h3>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap">{note.content}</p>
            </div>
          </div>

          {/* Scores Section */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Priority Scores</h3>

            {/* AI Content Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-600">AI Content Score</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-indigo-600">
                    {formatScore(note.aiContentScore)}
                  </span>
                  <span className="text-xs text-gray-500">(0.00 - 1.00)</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                  style={{
                    width: `${(note.aiContentScore ?? 0) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Combined Priority Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-600">Combined Priority Score</label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-gray-900">
                    {formatScore(note.aiPriorityScore)}
                  </span>
                  <span className="text-xs text-gray-500">
                    (70% AI + 30% Votes)
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                  style={{
                    width: `${(note.aiPriorityScore ?? 0) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Rationale */}
            {note.aiRationale && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  AI Rationale
                </label>
                <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                  <p>{note.aiRationale}</p>
                </div>
              </div>
            )}

            {/* Override Section */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Override Score (Manager Only)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                  placeholder="0.00 - 1.00"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Override score input"
                />
                <button
                  onClick={handleSaveOverride}
                  disabled={!overrideScore || !onSaveOverride}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Save Override
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Override the combined priority score for this note (0.00 - 1.00)
              </p>
            </div>
          </div>

          {/* Metadata */}
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Upvotes:</span>
                <span className="ml-2 font-medium">{note.upvotes}</span>
              </div>
              <div>
                <span className="text-gray-600">Creator:</span>
                <span className="ml-2 font-medium">{note.creator.username}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetailPanel;

