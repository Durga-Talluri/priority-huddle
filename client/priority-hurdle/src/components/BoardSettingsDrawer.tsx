// client/src/components/BoardSettingsDrawer.tsx

import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { IoCloseSharp, IoChevronDown, IoChevronUp } from "react-icons/io5";
import { HiCog, HiUsers, HiSparkles, HiColorSwatch, HiDownload, HiTrash } from "react-icons/hi";
import { UPDATE_BOARD_SETTINGS_MUTATION, ARCHIVE_BOARD_MUTATION, DELETE_BOARD_MUTATION } from "../graphql/mutations";
import { GET_BOARD } from "../graphql/queries";

interface BoardSettingsDrawerProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  isOwner: boolean;
}

type Section = "general" | "collaboration" | "scoring" | "appearance" | "export" | "danger";

const BoardSettingsDrawer: React.FC<BoardSettingsDrawerProps> = ({
  boardId,
  isOpen,
  onClose,
  currentUserId,
  isOwner,
}) => {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [expandedSections, setExpandedSections] = useState<Set<Section>>(new Set(["general"]));
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, loading, refetch } = useQuery(GET_BOARD, {
    variables: { boardId },
    skip: !isOpen || !boardId,
  });

  const board = data?.board;

  // Form state
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [category, setCategory] = useState("");
  const [aiWeight, setAiWeight] = useState(0.7);
  const [enableAIScoring, setEnableAIScoring] = useState(true);
  const [enableVoting, setEnableVoting] = useState(true);
  const [allowDownvotes, setAllowDownvotes] = useState(true);
  const [requireOwnerApprovalForDelete, setRequireOwnerApprovalForDelete] = useState(false);
  const [defaultNoteColor, setDefaultNoteColor] = useState("#ffebee");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [backgroundTheme, setBackgroundTheme] = useState("light");
  const [showLeaderboardByDefault, setShowLeaderboardByDefault] = useState(false);

  // Initialize form from board data
  useEffect(() => {
    if (board) {
      setTitle(board.title || "");
      setObjective(board.objective || "");
      setTimeHorizon(board.timeHorizon || "");
      setCategory(board.category || "");
      setAiWeight(board.aiWeight ?? 0.7);
      setEnableAIScoring(board.enableAIScoring ?? true);
      setEnableVoting(board.enableVoting ?? true);
      setAllowDownvotes(board.allowDownvotes ?? true);
      setRequireOwnerApprovalForDelete(board.requireOwnerApprovalForDelete ?? false);
      setDefaultNoteColor(board.defaultNoteColor || "#ffebee");
      setSnapToGrid(board.snapToGrid ?? false);
      setBackgroundTheme(board.backgroundTheme || "light");
      setShowLeaderboardByDefault(board.showLeaderboardByDefault ?? false);
    }
  }, [board]);

  const [updateSettings, { loading: saving }] = useMutation(UPDATE_BOARD_SETTINGS_MUTATION, {
    onCompleted: () => {
      refetch();
      // Show success toast (you can add a toast library)
      alert("Settings saved successfully!");
    },
    onError: (err) => {
      alert(`Error: ${err.message}`);
    },
  });

  const [archiveBoard] = useMutation(ARCHIVE_BOARD_MUTATION, {
    onCompleted: () => {
      alert("Board archived successfully!");
      onClose();
      window.location.href = "/home";
    },
  });

  const [deleteBoard] = useMutation(DELETE_BOARD_MUTATION, {
    onCompleted: () => {
      alert("Board deleted successfully!");
      onClose();
      window.location.href = "/home";
    },
  });

  const toggleSection = (section: Section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleSave = () => {
    updateSettings({
      variables: {
        boardId,
        input: {
          title: title.trim(),
          objective: objective.trim(),
          timeHorizon: timeHorizon || undefined,
          category: category || undefined,
          aiWeight: enableAIScoring ? aiWeight : undefined,
          enableAIScoring,
          enableVoting,
          allowDownvotes,
          requireOwnerApprovalForDelete,
          defaultNoteColor,
          snapToGrid,
          backgroundTheme,
          showLeaderboardByDefault,
        },
      },
    });
  };

  const handleArchive = () => {
    if (confirm("Are you sure you want to archive this board? It will be hidden from your boards list.")) {
      archiveBoard({ variables: { boardId } });
    }
  };

  const handleDelete = () => {
    if (deleteConfirmText === "DELETE" && showDeleteConfirm) {
      deleteBoard({ variables: { boardId } });
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const getAiWeightLabel = () => {
    const voteWeight = 1 - aiWeight;
    return `${Math.round(aiWeight * 100)}% AI / ${Math.round(voteWeight * 100)}% Votes`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-[9999] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[10000] transform transition-transform duration-300 ease-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <HiCog className="text-indigo-600" />
            Board Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close settings"
          >
            <IoCloseSharp size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading settings...</div>
          ) : (
            <>
              {/* 1. General */}
              <SectionHeader
                icon={<HiCog />}
                title="General"
                isExpanded={expandedSections.has("general")}
                onToggle={() => toggleSection("general")}
              />
              {expandedSections.has("general") && (
                <div className="space-y-4 pl-8 pb-4 border-l-2 border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Board Name {isOwner && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!isOwner || saving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Objective / Goal {isOwner && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      disabled={!isOwner || saving}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Horizon
                    </label>
                    <select
                      value={timeHorizon}
                      onChange={(e) => setTimeHorizon(e.target.value)}
                      disabled={!isOwner || saving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    >
                      <option value="">Select...</option>
                      <option value="This Week">This Week</option>
                      <option value="This Sprint (2 weeks)">This Sprint (2 weeks)</option>
                      <option value="This Quarter">This Quarter</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={!isOwner || saving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    >
                      <option value="">Select...</option>
                      <option value="Brainstorm">Brainstorm</option>
                      <option value="Sprint Prioritization">Sprint Prioritization</option>
                      <option value="Product Feedback">Product Feedback</option>
                      <option value="Project Planning">Project Planning</option>
                    </select>
                  </div>
                  {board?.createdAt && (
                    <div className="text-sm text-gray-500 pt-2 border-t">
                      <p>Created: {new Date(board.createdAt).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Collaboration */}
              <SectionHeader
                icon={<HiUsers />}
                title="Collaboration"
                isExpanded={expandedSections.has("collaboration")}
                onToggle={() => toggleSection("collaboration")}
              />
              {expandedSections.has("collaboration") && (
                <div className="space-y-4 pl-8 pb-4 border-l-2 border-gray-200">
                  <p className="text-sm text-gray-600">
                    Collaboration features coming soon. Use the "Invite Collaborator" button in the header.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireOwnerApprovalForDelete}
                      onChange={(e) => setRequireOwnerApprovalForDelete(e.target.checked)}
                      disabled={!isOwner || saving}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-700">
                      Require owner approval for deleting notes
                    </span>
                  </label>
                </div>
              )}

              {/* 3. Scoring & AI */}
              <SectionHeader
                icon={<HiSparkles />}
                title="Scoring & AI"
                isExpanded={expandedSections.has("scoring")}
                onToggle={() => toggleSection("scoring")}
              />
              {expandedSections.has("scoring") && (
                <div className="space-y-4 pl-8 pb-4 border-l-2 border-gray-200">
                  {enableAIScoring && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Weight vs Team Votes: {getAiWeightLabel()}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={aiWeight}
                        onChange={(e) => setAiWeight(parseFloat(e.target.value))}
                        disabled={!isOwner || saving || !enableAIScoring}
                        className="w-full disabled:opacity-50"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0% AI</span>
                        <span>100% AI</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Enable AI Scoring</span>
                        <p className="text-xs text-gray-500">AI will automatically score new notes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableAIScoring}
                        onChange={(e) => setEnableAIScoring(e.target.checked)}
                        disabled={!isOwner || saving}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Enable Team Voting</span>
                        <p className="text-xs text-gray-500">Allow users to upvote/downvote notes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableVoting}
                        onChange={(e) => setEnableVoting(e.target.checked)}
                        disabled={!isOwner || saving}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Allow Downvotes</span>
                        <p className="text-xs text-gray-500">Users can downvote notes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowDownvotes}
                        onChange={(e) => setAllowDownvotes(e.target.checked)}
                        disabled={!isOwner || saving}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </label>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => alert("Re-scoring all notes...")}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
                      disabled={saving}
                    >
                      Re-score All Notes Now
                    </button>
                  )}
                </div>
              )}

              {/* 4. Appearance & Behavior */}
              <SectionHeader
                icon={<HiColorSwatch />}
                title="Appearance & Behavior"
                isExpanded={expandedSections.has("appearance")}
                onToggle={() => toggleSection("appearance")}
              />
              {expandedSections.has("appearance") && (
                <div className="space-y-4 pl-8 pb-4 border-l-2 border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Note Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={defaultNoteColor}
                        onChange={(e) => setDefaultNoteColor(e.target.value)}
                        disabled={saving}
                        className="w-16 h-10 border border-gray-300 rounded cursor-pointer disabled:opacity-50"
                      />
                      <input
                        type="text"
                        value={defaultNoteColor}
                        onChange={(e) => setDefaultNoteColor(e.target.value)}
                        disabled={saving}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-gray-700">Snap notes to grid</span>
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                      disabled={saving}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Board Background
                    </label>
                    <select
                      value={backgroundTheme}
                      onChange={(e) => setBackgroundTheme(e.target.value)}
                      disabled={saving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-gray-700">Show leaderboard by default</span>
                    <input
                      type="checkbox"
                      checked={showLeaderboardByDefault}
                      onChange={(e) => setShowLeaderboardByDefault(e.target.checked)}
                      disabled={saving}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              )}

              {/* 5. Export & Integrations */}
              <SectionHeader
                icon={<HiDownload />}
                title="Export & Integrations"
                isExpanded={expandedSections.has("export")}
                onToggle={() => toggleSection("export")}
              />
              {expandedSections.has("export") && (
                <div className="space-y-3 pl-8 pb-4 border-l-2 border-gray-200">
                  <button
                    onClick={() => alert("Exporting as CSV...")}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
                  >
                    Export Board as CSV
                  </button>
                  <button
                    onClick={() => alert("Exporting as JSON...")}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => alert("Generating AI summary...")}
                    className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition"
                  >
                    Generate AI Summary of Top Priorities
                  </button>
                </div>
              )}

              {/* 6. Danger Zone */}
              {isOwner && (
                <>
                  <SectionHeader
                    icon={<HiTrash />}
                    title="Danger Zone"
                    isExpanded={expandedSections.has("danger")}
                    onToggle={() => toggleSection("danger")}
                    isDanger
                  />
                  {expandedSections.has("danger") && (
                    <div className="space-y-4 pl-8 pb-4 border-l-2 border-red-200">
                      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-800 mb-4">
                          These actions are permanent and cannot be undone.
                        </p>
                        <button
                          onClick={handleArchive}
                          className="w-full mb-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition"
                        >
                          Archive Board
                        </button>
                        {showDeleteConfirm ? (
                          <div className="space-y-2">
                            <p className="text-sm text-red-800 font-medium">
                              Type "DELETE" to confirm permanent deletion:
                            </p>
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder="Type DELETE"
                              className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleDelete}
                                disabled={deleteConfirmText !== "DELETE"}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Delete Permanently
                              </button>
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(false);
                                  setDeleteConfirmText("");
                                }}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                          >
                            Delete Board Permanently
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !objective.trim()}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
};

// Helper component for section headers
interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  isDanger?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  isExpanded,
  onToggle,
  isDanger = false,
}) => {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-3 rounded-lg transition ${
        isDanger
          ? "bg-red-50 border border-red-200 hover:bg-red-100"
          : "bg-gray-50 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={isDanger ? "text-red-600" : "text-indigo-600"}>{icon}</span>
        <span className={`font-medium ${isDanger ? "text-red-800" : "text-gray-900"}`}>
          {title}
        </span>
      </div>
      {isExpanded ? (
        <IoChevronUp className="text-gray-500" />
      ) : (
        <IoChevronDown className="text-gray-500" />
      )}
    </button>
  );
};

export default BoardSettingsDrawer;

