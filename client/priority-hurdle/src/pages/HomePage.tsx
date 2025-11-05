// client/src/pages/HomePage.tsx (Updated)

import React, { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { GET_ME, GET_MY_BOARDS } from "../graphql/queries";
import { useNavigate } from "react-router-dom";
import CreateBoardForm from "../components/CreateBoardForm";

// Define the required data types for clarity
interface UserData {
  me: {
    id: string;
    username: string;
    email: string;
  };
}

interface BoardListItem {
  id: string;
  title: string;
  // REMOVED creatorId: We rely on the creator object instead
  creator: {
    id: string; // <-- CRITICAL: Fetching the creator's ID from the object
    username: string;
  };
}

interface MyBoardsData {
  myBoards: BoardListItem[];
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 1. Fetch the current user details
  const {
    data: userData,
    loading: userLoading,
    error: userError,
  } = useQuery<UserData>(GET_ME);

  // 2. Fetch the list of boards
  const {
    data: boardsData,
    loading: boardsLoading,
    error: boardsError,
  } = useQuery<MyBoardsData>(GET_MY_BOARDS);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
    window.location.reload();
  };

  // --- Conditional Rendering ---
  if (userLoading || boardsLoading)
    return (
      <p className="p-8 text-xl text-gray-600">Loading your workspace...</p>
    );

  // Handle authentication errors
  if (userError || boardsError) {
    console.error("Auth/Board Load Error:", userError || boardsError);
    localStorage.removeItem("token");
    navigate("/login");
    return null;
  }

  const user = userData?.me;
  const boards = boardsData?.myBoards || [];

  // FIX: Flag to check if the user is the board's creator
  // We now use board.creator.id instead of board.creatorId
  const isCreator = (board: BoardListItem) => user?.id === board.creator.id; // <-- FIXED

  return (
    <div className="container mx-auto p-8">
      <header className="flex justify-between items-center pb-4 border-b mb-8">
        <h1 className="text-3xl font-bold">
          Welcome back, {user?.username || "Guest"}!
        </h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          Logout
        </button>
      </header>

      <h2 className="text-2xl font-semibold mb-6">
        Your Boards ({boards.length})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boards.map((board) => (
          <div
            key={board.id}
            className="p-6 border rounded-xl shadow-md transition hover:shadow-lg cursor-pointer bg-white"
            onClick={() => navigate(`/board/${board.id}`)}
          >
            <h3 className="text-xl font-bold text-indigo-700 truncate">
              {board.title}
            </h3>

            <div className="mt-3 text-sm text-gray-600">
              <p>
                {isCreator(board) ? (
                  <span className="font-semibold text-green-600">
                    You are the Owner
                  </span>
                ) : (
                  <span>Collaborating with: {board.creator.username}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-400">ID: {board.id}</p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/board/${board.id}`);
              }}
              className="mt-4 w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Open Board
            </button>
          </div>
        ))}

        <div
          className="p-6 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center min-h-[150px] opacity-70 hover:opacity-100 cursor-pointer transition"
          onClick={() => setIsModalOpen(true)} // Open modal on click
        >
          <span className="text-lg text-gray-500">+ Create New Board</span>
        </div>
      </div>

      {/* 2. Modal Overlay and Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <CreateBoardForm onClose={() => setIsModalOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default HomePage;