export interface Creator {
  username: string;
}
export interface PresenceUser {
  userId: string;
  username: string;
  initials: string;
  colorHex: string;
  displayName: string;
  textColor?: "white" | "black"; // Computed client-side for contrast
}

export interface NoteType {
  id: string;
  content: string;
  color: string;
  creator: Creator;
  positionX: number; // Initial X from DB
  positionY: number; // Initial Y from DB
  upvotes: number;
  aiPriorityScore?: number | null;
  aiContentScore?: number | null;
  aiRationale?: string | null;
  width?: number;
  height?: number;
  onDelete: (noteId: string) => void;
  focusedUsers?: Record<string, PresenceUser[]>; // Key: Note ID, Value: Array of users
  currentUserId?: string;
}