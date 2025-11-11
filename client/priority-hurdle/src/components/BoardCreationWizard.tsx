// client/src/components/BoardCreationWizard.tsx

import React, { useState, useEffect, useRef } from "react";
import { useMutation, useLazyQuery } from "@apollo/client/react";
import { CREATE_BOARD_MUTATION } from "../graphql/mutations";
import { GET_MY_BOARDS, SEARCH_USERS } from "../graphql/queries";
import { useNavigate } from "react-router-dom";
import { IoCloseSharp, IoChevronBack, IoChevronForward } from "react-icons/io5";

interface BoardCreationWizardProps {
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

const BoardCreationWizard: React.FC<BoardCreationWizardProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [error, setError] = useState("");

  // Step 1: Basic Info
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("This Sprint (2 weeks)");
  const [category, setCategory] = useState("");

  // Step 2: Collaboration
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [requireOwnerApprovalForDelete, setRequireOwnerApprovalForDelete] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchUsers, { data: searchData, loading: searching }] = useLazyQuery(SEARCH_USERS, {
    fetchPolicy: "network-only",
  });

  // Step 3: Scoring Configuration
  const [aiWeight, setAiWeight] = useState(0.5); // 50% AI, 50% votes
  const [enableAIScoring, setEnableAIScoring] = useState(true);
  const [enableVoting, setEnableVoting] = useState(true);
  const [allowDownvotes, setAllowDownvotes] = useState(true);

  const [createBoard, { loading }] = useMutation(CREATE_BOARD_MUTATION, {
    onCompleted: (data) => {
      navigate(`/board/${data.createBoard.id}`);
      onClose();
    },
    onError: (err) => {
      setError(err.message.replace("GraphQL error: ", ""));
    },
    update(cache, { data: { createBoard: newBoard } }) {
      const existingBoards = cache.readQuery({ query: GET_MY_BOARDS }) as any;
      if (existingBoards && newBoard) {
        cache.writeQuery({
          query: GET_MY_BOARDS,
          data: { myBoards: [newBoard, ...existingBoards.myBoards] },
        });
      }
    },
  });

  // Debounced search for users
  useEffect(() => {
    const trimmed = collaboratorInput.trim();
    if (trimmed.length >= 1) {
      const timer = setTimeout(() => {
        searchUsers({ variables: { query: trimmed } });
      }, 300); // 300ms debounce
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [collaboratorInput, searchUsers]);

  // Update suggestions when search results change
  useEffect(() => {
    if (searchData?.searchUsers) {
      // Filter out users already added as collaborators
      const filtered = searchData.searchUsers.filter(
        (user: { username: string }) => !collaborators.includes(user.username)
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }
  }, [searchData, collaborators]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const addCollaborator = (username?: string) => {
    const trimmed = username || collaboratorInput.trim();
    if (trimmed && !collaborators.includes(trimmed)) {
      setCollaborators([...collaborators, trimmed]);
      setCollaboratorInput("");
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const selectSuggestion = (user: { username: string }) => {
    addCollaborator(user.username);
  };

  const removeCollaborator = (username: string) => {
    setCollaborators(collaborators.filter((c) => c !== username));
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!title.trim() || !objective.trim()) {
        setError("Please fill in all required fields.");
        return;
      }
    }
    setError("");
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    setError("");
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !objective.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    createBoard({
      variables: {
        input: {
          title: title.trim(),
          objective: objective.trim(),
          timeHorizon: timeHorizon || undefined,
          category: category || undefined,
          collaboratorUsernames: collaborators.length > 0 ? collaborators : undefined,
          aiWeight: enableAIScoring ? aiWeight : undefined,
          enableAIScoring,
          enableVoting,
          allowDownvotes,
          requireOwnerApprovalForDelete,
        },
      },
    });
  };

  const getAiWeightLabel = () => {
    const voteWeight = 1 - aiWeight;
    return `${Math.round(aiWeight * 100)}% AI / ${Math.round(voteWeight * 100)}% Votes`;
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold">Create New Board</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
          aria-label="Close wizard"
        >
          <IoCloseSharp size={24} />
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full mx-1 ${
                step <= currentStep ? "bg-indigo-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <div className="text-xs text-gray-500 text-center">
          Step {currentStep} of 4
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="mb-6 min-h-[400px]">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold mb-4">Basic Information</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Board Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Q4 Planning"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Objective / Goal <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Improve customer onboarding experience"
                rows={3}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                This gives the AI context and sets shared understanding among team members.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Horizon
              </label>
              <select
                value={timeHorizon}
                onChange={(e) => setTimeHorizon(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
              >
                <option value="This Week">This Week</option>
                <option value="This Sprint (2 weeks)">This Sprint (2 weeks)</option>
                <option value="This Quarter">This Quarter</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category / Template (Optional)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
              >
                <option value="">Select a category...</option>
                <option value="Brainstorm">Brainstorm</option>
                <option value="Sprint Prioritization">Sprint Prioritization</option>
                <option value="Product Feedback">Product Feedback</option>
                <option value="Project Planning">Project Planning</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Collaboration */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold mb-4">Configure Collaboration</h4>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Collaborators
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={collaboratorInput}
                    onChange={(e) => {
                      setCollaboratorInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (suggestions.length > 0) {
                          selectSuggestion(suggestions[0]);
                        } else {
                          addCollaborator();
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search by username or email"
                    disabled={loading}
                  />
                  {/* Suggestions Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                    >
                      {suggestions.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => selectSuggestion(user)}
                          className="w-full px-4 py-2 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{user.username}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searching && (
                    <div className="absolute right-3 top-2.5 text-gray-400 text-sm">
                      Searching...
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addCollaborator()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
                  disabled={loading || !collaboratorInput.trim()}
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Inviting collaborators early helps engagement and avoids boards staying empty.
              </p>
            </div>
            {collaborators.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collaborators ({collaborators.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {collaborators.map((username) => (
                    <span
                      key={username}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
                    >
                      {username}
                      <button
                        type="button"
                        onClick={() => removeCollaborator(username)}
                        className="text-indigo-700 hover:text-indigo-900"
                        disabled={loading}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-4 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireOwnerApprovalForDelete}
                  onChange={(e) => setRequireOwnerApprovalForDelete(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">
                  Owner approval required for deleting notes
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Scoring Configuration */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h4 className="text-lg font-semibold mb-4">Scoring Configuration</h4>
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
                  className="w-full"
                  disabled={loading || !enableAIScoring}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0% AI</span>
                  <span>100% AI</span>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Enable AI scoring?</span>
                <input
                  type="checkbox"
                  checked={enableAIScoring}
                  onChange={(e) => setEnableAIScoring(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={loading}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Enable voting?</span>
                <input
                  type="checkbox"
                  checked={enableVoting}
                  onChange={(e) => setEnableVoting(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={loading}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Allow downvotes?</span>
                <input
                  type="checkbox"
                  checked={allowDownvotes}
                  onChange={(e) => setAllowDownvotes(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={loading}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Some teams want pure human prioritization, others prefer AI-assisted. This
              flexibility makes your app adaptable to different workflows.
            </p>
          </div>
        )}

        {/* Step 4: Summary */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold mb-4">Summary</h4>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Board Name:</span>
                <p className="text-gray-900">{title}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Objective:</span>
                <p className="text-gray-900">{objective}</p>
              </div>
              {timeHorizon && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Time Horizon:</span>
                  <p className="text-gray-900">{timeHorizon}</p>
                </div>
              )}
              {category && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Category:</span>
                  <p className="text-gray-900">{category}</p>
                </div>
              )}
              {collaborators.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Collaborators:</span>
                  <p className="text-gray-900">{collaborators.join(", ")}</p>
                </div>
              )}
              {enableAIScoring && (
                <div>
                  <span className="text-sm font-medium text-gray-700">AI Weight:</span>
                  <p className="text-gray-900">{getAiWeightLabel()}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <button
          type="button"
          onClick={currentStep === 1 ? onClose : handleBack}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-100 transition"
          disabled={loading}
        >
          {currentStep > 1 && <IoChevronBack />}
          {currentStep === 1 ? "Cancel" : "Back"}
        </button>
        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            disabled={loading}
          >
            Next
            <IoChevronForward />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !objective.trim()}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create & Open Board"}
          </button>
        )}
      </div>
    </div>
  );
};

export default BoardCreationWizard;

