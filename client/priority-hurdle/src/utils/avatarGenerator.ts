// client/src/utils/avatarGenerator.ts

/**
 * Generates deterministic avatar data from a username
 * - Initials: First 1-2 grapheme clusters (prefer first name + last initial)
 * - Color: Deterministic color from username hash
 * - Display Name: Username or email local-part
 */

// Curated palette of accessible colors (good contrast with white/black text)
const AVATAR_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#A855F7", // Violet
  "#22C55E", // Emerald
  "#EAB308", // Yellow
  "#F43F5E", // Rose
  "#0EA5E9", // Sky
];

/**
 * Simple hash function to convert string to number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Extracts initials from username
 * Rules:
 * - If username contains space: "First Last" -> "FL"
 * - If username contains dot/underscore: "first.last" -> "FL"
 * - If username is single word: "username" -> "U" (first letter)
 * - If username is camelCase: "userName" -> "UN" (first two capitals or first + last)
 */
export function generateInitials(username: string): string {
  if (!username || username.trim().length === 0) {
    return "?";
  }

  const trimmed = username.trim();

  // Check for space-separated names (e.g., "John Doe")
  const spaceParts = trimmed.split(/\s+/);
  if (spaceParts.length >= 2) {
    const first = spaceParts[0];
    const last = spaceParts[spaceParts.length - 1];
    return (first[0] + last[0]).toUpperCase().slice(0, 2);
  }

  // Check for dot/underscore separated (e.g., "john.doe" or "john_doe")
  const dotParts = trimmed.split(/[._-]+/);
  if (dotParts.length >= 2) {
    const first = dotParts[0];
    const last = dotParts[dotParts.length - 1];
    return (first[0] + last[0]).toUpperCase().slice(0, 2);
  }

  // Single word: try to detect camelCase
  const camelCaseMatch = trimmed.match(/^([a-z])([A-Z])/);
  if (camelCaseMatch) {
    return (camelCaseMatch[1] + camelCaseMatch[2]).toUpperCase();
  }

  // Fallback: first letter, or first two if very short
  if (trimmed.length <= 2) {
    return trimmed.toUpperCase();
  }
  return trimmed[0].toUpperCase();
}

/**
 * Generates a deterministic color from username
 * Uses hash to select from curated palette
 */
export function generateColor(username: string): string {
  if (!username || username.trim().length === 0) {
    return "#9CA3AF"; // Neutral gray for fallback
  }

  const hash = hashString(username.trim().toLowerCase());
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Determines if text should be white or black for contrast
 * Uses WCAG contrast ratio calculation
 */
export function getContrastColor(backgroundColor: string): "white" | "black" {
  // Convert hex to RGB
  const hex = backgroundColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light
  return luminance > 0.5 ? "black" : "white";
}

/**
 * Generates complete avatar data from username
 */
export interface AvatarData {
  initials: string;
  colorHex: string;
  displayName: string;
  textColor: "white" | "black";
}

export function generateAvatar(username: string, email?: string): AvatarData {
  // Use email local-part if username is empty
  const displayName = username?.trim() || email?.split("@")[0] || "User";
  const initials = generateInitials(displayName);
  const colorHex = generateColor(displayName);
  const textColor = getContrastColor(colorHex);

  return {
    initials,
    colorHex,
    displayName,
    textColor,
  };
}

