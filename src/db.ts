import Database from 'better-sqlite3';
import { User, Room, HandReplay } from './types';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'development.db');
const db = new Database(dbPath);

export function initDb() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      chips INTEGER NOT NULL DEFAULT 100000
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      maxPlayers INTEGER NOT NULL,
      initialChips INTEGER NOT NULL,
      bigBlind INTEGER NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hand_replays (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      history TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
}

export function getUser(id: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function saveUser(user: User) {
  const stmt = db.prepare(`
    INSERT INTO users (id, name, avatar, chips) 
    VALUES (@id, @name, @avatar, @chips)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      avatar = excluded.avatar, 
      chips = excluded.chips
  `);
  stmt.run(user);
}

export function getRooms(): Room[] {
  return db.prepare('SELECT * FROM rooms').all() as Room[];
}

export function getUsersRanked(): User[] {
  return db.prepare('SELECT * FROM users ORDER BY chips DESC LIMIT 20').all() as User[];
}

export function saveRoom(room: Room) {
  const stmt = db.prepare(`
    INSERT INTO rooms (id, name, mode, maxPlayers, initialChips, bigBlind, status)
    VALUES (@id, @name, @mode, @maxPlayers, @initialChips, @bigBlind, @status)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      status = excluded.status
  `);
  stmt.run(room);
}

export function saveHandReplay(replay: HandReplay) {
  const stmt = db.prepare(`
    INSERT INTO hand_replays (id, roomId, history, createdAt)
    VALUES (@id, @roomId, @history, @createdAt)
  `);
  stmt.run(replay);
}

export function getReplays(roomId: string): HandReplay[] {
  return db.prepare('SELECT * FROM hand_replays WHERE roomId = ? ORDER BY createdAt DESC').all(roomId) as HandReplay[];
}
