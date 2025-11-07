export interface Creator {
  username: string;
}
export interface NoteType {
  id: string;
  content: string;
  color: string;
  creator: Creator;
  positionX: number; // Initial X from DB
  positionY: number; // Initial Y from DB
  upvotes: number;
  aiPriorityScore: number;
  width?: number;
  height?: number;
  onDelete: (noteId: string) => void;
  focusedUsers?: Record<string, { username: string; userId: string }>;
  currentUserId?: string;
}