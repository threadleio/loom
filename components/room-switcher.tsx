"use client";

import { useState } from "react";

interface Room {
  id: string;
  name: string;
}

interface RoomSwitcherProps {
  rooms: Room[];
  activeRoomId: string;
  onRoomChange: (roomId: string) => void;
  eventId: string;
  canCreate?: boolean;
  onRoomCreated?: (room: Room) => void;
}

export function RoomSwitcher({
  rooms,
  activeRoomId,
  onRoomChange,
  eventId,
  canCreate = false,
  onRoomCreated,
}: RoomSwitcherProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const room: Room = await res.json();
        onRoomCreated?.(room);
        onRoomChange(room.id);
        setNewName("");
        setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      style={{ padding: "8px 0" }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          marginRight: 4,
        }}
      >
        Room
      </span>

      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onRoomChange(room.id)}
          className="cursor-pointer transition-all"
          style={{
            fontFamily: "var(--mono)",
            fontWeight: activeRoomId === room.id ? 700 : 500,
            fontSize: 12,
            padding: "5px 12px",
            borderRadius: 999,
            border:
              activeRoomId === room.id
                ? "1.5px solid var(--accent)"
                : "1.5px solid var(--line)",
            background:
              activeRoomId === room.id ? "var(--accent)" : "var(--surface)",
            color:
              activeRoomId === room.id ? "var(--on-accent)" : "var(--ink)",
            letterSpacing: ".02em",
          }}
        >
          {room.name}
        </button>
      ))}

      {canCreate && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="cursor-pointer transition-opacity hover:opacity-80"
          style={{
            fontFamily: "var(--mono)",
            fontWeight: 600,
            fontSize: 12,
            padding: "5px 10px",
            borderRadius: 999,
            border: "1.5px dashed var(--line)",
            background: "none",
            color: "var(--muted)",
            letterSpacing: ".02em",
          }}
        >
          + Room
        </button>
      )}

      {canCreate && showCreate && (
        <form onSubmit={handleCreate} className="flex items-center gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Room name"
            autoFocus
            maxLength={40}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 999,
              border: "1.5px solid var(--accent)",
              background: "var(--bg)",
              color: "var(--ink)",
              outline: "none",
              width: 120,
            }}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="cursor-pointer"
            style={{
              fontFamily: "var(--mono)",
              fontWeight: 700,
              fontSize: 11,
              padding: "5px 8px",
              borderRadius: 999,
              border: "none",
              background: "var(--accent)",
              color: "var(--on-accent)",
            }}
          >
            {creating ? "..." : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewName("");
            }}
            className="cursor-pointer"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              padding: "5px 6px",
              borderRadius: 999,
              border: "none",
              background: "none",
              color: "var(--muted)",
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
