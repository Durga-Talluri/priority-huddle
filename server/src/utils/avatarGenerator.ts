// server/src/utils/avatarGenerator.ts

/**
 * Server-side avatar generation (same algorithm as client)
 * Ensures consistency across client and server
 */

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

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateInitials(username: string): string {
  if (!username || username.trim().length === 0) {
    return "?";
  }

  const trimmed = username.trim();

  const spaceParts = trimmed.split(/\s+/);
  if (spaceParts.length >= 2) {
    const first = spaceParts[0];
    const last = spaceParts[spaceParts.length - 1];
    return (first[0] + last[0]).toUpperCase().slice(0, 2);
  }

  const dotParts = trimmed.split(/[._-]+/);
  if (dotParts.length >= 2) {
    const first = dotParts[0];
    const last = dotParts[dotParts.length - 1];
    return (first[0] + last[0]).toUpperCase().slice(0, 2);
  }

  const camelCaseMatch = trimmed.match(/^([a-z])([A-Z])/);
  if (camelCaseMatch) {
    return (camelCaseMatch[1] + camelCaseMatch[2]).toUpperCase();
  }

  if (trimmed.length <= 2) {
    return trimmed.toUpperCase();
  }
  return trimmed[0].toUpperCase();
}

export function generateColor(username: string): string {
  if (!username || username.trim().length === 0) {
    return "#9CA3AF";
  }

  const hash = hashString(username.trim().toLowerCase());
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export interface AvatarData {
  initials: string;
  colorHex: string;
  displayName: string;
}

export function generateAvatar(username: string, email?: string): AvatarData {
  const displayName = username?.trim() || email?.split("@")[0] || "User";
  const initials = generateInitials(displayName);
  const colorHex = generateColor(displayName);

  return {
    initials,
    colorHex,
    displayName,
  };
}

