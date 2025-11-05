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
  onDelete: (noteId: string) => void;
}