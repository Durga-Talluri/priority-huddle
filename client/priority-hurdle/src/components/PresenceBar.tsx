// client/src/components/PresenceBar.tsx

import React, { useState } from "react";
import type { PresenceUser } from "../types/NoteTypes";
import { getContrastColor } from "../utils/avatarGenerator";

interface PresenceBarProps {
  activeEditors: PresenceUser[];
  currentUserId?: string;
}

const PresenceBar: React.FC<PresenceBarProps> = ({
  activeEditors,
  currentUserId,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Filter out current user from display
  const otherEditors = activeEditors.filter(
    (editor) => editor.userId !== currentUserId
  );

  // Show up to 5 avatars, then "+N"
  const maxVisible = 5;
  const visibleEditors = otherEditors.slice(0, maxVisible);
  const overflowCount = Math.max(0, otherEditors.length - maxVisible);

  if (otherEditors.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Global editing chip */}
      {otherEditors.length > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-sm"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="flex items-center gap-1">
            {otherEditors.slice(0, 3).map((editor, idx) => (
              <div
                key={editor.userId}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white"
                style={{
                  backgroundColor: editor.colorHex,
                  color: editor.textColor || "white",
                  marginLeft: idx > 0 ? "-8px" : "0",
                }}
                title={editor.displayName}
              >
                {editor.initials}
              </div>
            ))}
          </div>
          <span className="text-indigo-700 font-medium">
            {otherEditors.length === 1
              ? `${otherEditors[0].displayName} is editing...`
              : `${otherEditors.length} editing...`}
          </span>
        </div>
      )}

      {/* Presence avatars */}
      <div className="flex items-center gap-1">
        {visibleEditors.map((editor) => (
          <div
            key={editor.userId}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
            style={{
              backgroundColor: editor.colorHex,
              color: editor.textColor || "white",
            }}
            title={editor.displayName}
          >
            {editor.initials}
          </div>
        ))}
        {overflowCount > 0 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 border-2 border-white">
            +{overflowCount}
          </div>
        )}
      </div>

      {/* Tooltip showing all editors */}
      {showTooltip && otherEditors.length > 0 && (
        <div className="absolute top-full mt-2 right-0 bg-black text-white text-xs px-3 py-2 rounded shadow-lg z-50">
          <div className="font-semibold mb-1">Active Editors:</div>
          {otherEditors.map((editor) => (
            <div key={editor.userId} className="flex items-center gap-2 py-1">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{
                  backgroundColor: editor.colorHex,
                  color: editor.textColor || getContrastColor(editor.colorHex),
                }}
              >
                {editor.initials}
              </div>
              <span>{editor.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PresenceBar;

