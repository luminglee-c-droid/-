import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import Auth from './components/Auth';
import type { User, Room } from './types';
import { GameState } from './engine';

const socket: Socket = io({ transports: ['websocket'] });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rankings, setRankings] = useState<User[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    // Check localStorage
    const savedId = localStorage.getItem('poker_user_id');
    const savedName = localStorage.getItem('poker_user_name');
    if (savedId && savedName) {
      socket.emit('login', { id: savedId, name: savedName, avatar: 'default' });
    }

    socket.on('login_success', (u: User) => {
      setUser(u);
      if (roomFromUrl) {
         setCurrentRoom(roomFromUrl.toUpperCase());
         socket.emit('join_room', roomFromUrl.toUpperCase());
         // Clean url
         window.history.replaceState({}, '', window.location.pathname);
      }
    });

    socket.on('rooms_list', (r: Room[]) => {
      setRooms(r);
    });

    socket.on('rankings_list', (u: User[]) => {
      setRankings(u);
    });

    socket.on('room_created', (roomId: string) => {
      setCurrentRoom(roomId);
      socket.emit('join_room', roomId);
    });

    socket.on('game_update', (st: GameState) => {
      setGameState(st);
    });

    return () => {
      socket.off('login_success');
      socket.off('rooms_list');
      socket.off('room_created');
      socket.off('game_update');
    };
  }, []);

  const handleLogin = (name: string) => {
    const newId = Math.random().toString(36).substring(2);
    localStorage.setItem('poker_user_id', newId);
    localStorage.setItem('poker_user_name', name);
    socket.emit('login', { id: newId, name, avatar: 'default' });
  };

  const createRoom = (data: any) => {
    socket.emit('create_room', data);
  };

  const joinRoom = (id: string) => {
    setCurrentRoom(id);
    socket.emit('join_room', id);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} socket={socket} />;
  }

  if (currentRoom) {
    return <GameRoom 
       socket={socket} 
       user={user} 
       state={gameState} 
       onLeave={() => { setCurrentRoom(null); setGameState(null); socket.emit('leave_room', currentRoom); }}
    />;
  }

  return <Lobby user={user} rooms={rooms} rankings={rankings} onCreate={createRoom} onJoin={joinRoom} />;
}

