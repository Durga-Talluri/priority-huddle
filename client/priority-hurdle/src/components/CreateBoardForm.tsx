// client/src/components/CreateBoardForm.tsx

import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { CREATE_BOARD_MUTATION } from '../graphql/mutations'; // Ensure this is imported
import { GET_MY_BOARDS } from '../graphql/queries'; // Needed for cache update
import { useNavigate } from 'react-router-dom';

interface CreateBoardFormProps {
  onClose: () => void; // Function to close the form/modal
}

const CreateBoardForm: React.FC<CreateBoardFormProps> = ({ onClose }) => {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [createBoard, { loading }] = useMutation(CREATE_BOARD_MUTATION, {
    onCompleted: (data) => {
      // 1. Navigate to the newly created board
      navigate(`/board/${data.createBoard.id}`);
      onClose();
    },
    onError: (err) => {
      setError(err.message.replace('GraphQL error: ', ''));
    },
    // 2. CRUCIAL: Manually update the cache to instantly show the new board on the homepage list
    update(cache, { data: { createBoard: newBoard } }) {
      // Read the current list of boards
      const existingBoards = cache.readQuery({ query: GET_MY_BOARDS }) as any;

      if (existingBoards && newBoard) {
        // Add the new board to the beginning of the list
        cache.writeQuery({
          query: GET_MY_BOARDS,
          data: { myBoards: [newBoard, ...existingBoards.myBoards] },
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (title.trim()) {
      createBoard({ variables: { title: title.trim() } });
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-2xl w-full max-w-md">
      <h3 className="text-2xl font-bold mb-4">Create New Board</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Board Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g., Q4 Planning"
            disabled={loading}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

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
            disabled={loading || !title.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Board'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateBoardForm;