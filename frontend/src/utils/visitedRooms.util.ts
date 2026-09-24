import { Room } from "../types/room.type";

export type VisitedRoom = {
  hasPasscode?: boolean;
  lastVisitedAt: string;
  name?: string;
  roomId: string;
};

const visitedRoomsKey = "room.visitedRooms";
const maxVisitedRooms = 12;

export const readVisitedRooms = (): VisitedRoom[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(visitedRoomsKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const rooms = Array.isArray(parsed)
      ? parsed.filter((room) => room?.roomId)
      : [];
    window.localStorage.setItem(visitedRoomsKey, JSON.stringify(rooms));
    return rooms;
  } catch {
    return [];
  }
};

export const rememberVisitedRoom = (room: Room) => {
  if (typeof window === "undefined" || !room.roomId) return;

  const nextRoom: VisitedRoom = {
    roomId: room.roomId,
    name: room.name || undefined,
    hasPasscode: room.hasPasscode,
    lastVisitedAt: new Date().toISOString(),
  };
  const nextRooms = [
    nextRoom,
    ...readVisitedRooms().filter((item) => item.roomId !== room.roomId),
  ].slice(0, maxVisitedRooms);

  window.localStorage.setItem(visitedRoomsKey, JSON.stringify(nextRooms));
};
