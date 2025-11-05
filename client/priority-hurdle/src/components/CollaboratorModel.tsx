// client/src/components/CollaboratorModal.tsx

import React, { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { ADD_COLLABORATOR_MUTATION } from "../graphql/mutations";
import { GET_BOARD } from "../graphql/queries";

interface CollaboratorModalProps {
  boardId: string;
  onClose: () => void;
}

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
  boardId,
  onClose,
}) => {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  const [addCollaborator, { loading }] = useMutation(
    ADD_COLLABORATOR_MUTATION,
    {
      // Crucial: Refetch the board query to ensure UI state (like collaborator list) updates
      refetchQueries: [{ query: GET_BOARD, variables: { boardId } }],
      onCompleted: () => {
        setMessage(`Successfully invited user "${username}"!`);
        setUsername("");
        setTimeout(onClose, 2000); // Close after showing success message
      },
      onError: (error) => {
        setMessage(`Error: ${error.message.replace("GraphQL error: ", "")}`);
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    addCollaborator({ variables: { boardId, username } });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
        <h3 className="text-xl font-bold mb-4">Invite Collaborator</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Username to Invite
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md"
              placeholder="e.g., user123"
              disabled={loading}
            />
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.startsWith("Error") ? "text-red-500" : "text-green-500"
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-100"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Inviting..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollaboratorModal;
