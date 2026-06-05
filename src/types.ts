export interface User {
  id: string;
  name: string;
  avatar: string;
  chips: number;
}

export interface Room {
  id: string;
  name: string;
  mode: 'cash' | 'tournament';
  maxPlayers: number;
  initialChips: number;
  bigBlind: number;
  players: string[]; // user ids
  status: 'waiting' | 'playing' | 'finished';
}

export interface HandReplay {
  id: string;
  roomId: string;
  history: string; // JSON string of the hand events
  createdAt: number;
}
