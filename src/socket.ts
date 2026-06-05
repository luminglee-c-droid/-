import { Server, Socket } from 'socket.io';
import { PokerEngine } from './engine';
import { getUser, saveUser, getRooms, saveRoom, getUsersRanked, saveHandReplay } from './db';

const ACTIVE_GAMES = new Map<string, PokerEngine>();

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    
    socket.on('login', (data: { id: string, name: string, avatar: string }) => {
      let user = getUser(data.id);
      if (!user) {
        user = { id: data.id, name: data.name, avatar: data.avatar, chips: 100000 };
        saveUser(user);
      }
      socket.join(`user:${user.id}`);
      socket.data.userId = user.id;
      socket.emit('login_success', user);
      socket.emit('rooms_list', getRooms());
      socket.emit('rankings_list', getUsersRanked());
    });

    socket.on('create_room', (data: { name: string, mode: 'cash'|'tournament', max: number, chips: number, bb: number }) => {
      if (!socket.data.userId) return;
      
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room = {
        id: roomId,
        name: data.name,
        mode: data.mode,
        maxPlayers: data.max,
        initialChips: data.chips,
        bigBlind: data.bb,
        players: [],
        status: 'waiting' as const
      };
      saveRoom(room);
      
      const engine = new PokerEngine(roomId, data.mode, data.bb / 2, data.bb, (state) => {
         // Persist chips delta 
         for (const p of state.players) {
             const u = getUser(p.id);
             if (u) {
                 u.chips = p.chips;
                 saveUser(u);
             }
         }
         io.emit('rankings_list', getUsersRanked());
         syncRoom(io, engine);
      });
      ACTIVE_GAMES.set(roomId, engine);
      
      io.emit('rooms_list', getRooms());
      socket.emit('room_created', roomId);
    });

    socket.on('join_room', (roomId: string) => {
      if (!socket.data.userId) return;
      
      const engine = ACTIVE_GAMES.get(roomId);
      if (!engine) {
          socket.emit('error', 'Room not found');
          return;
      }
      
      const user = getUser(socket.data.userId)!;
      engine.join(user.id, user.name, user.avatar, engine.state.mode === 'cash' ? user.chips : engine.state.smallBlind * 100);
      
      socket.join(`room:${roomId}`);
      io.to(`room:${roomId}`).emit('game_update', engine.state); // everyone sees something, but Wait, we need to send masked state individually.
      
      // Need individual sync 
      syncRoom(io, engine);
    });

    socket.on('action', (data: { roomId: string, action: 'fold'|'check'|'call'|'raise'|'allin', amount?: number }) => {
       if (!socket.data.userId) return;
       const engine = ACTIVE_GAMES.get(data.roomId);
       if (!engine) return;
       
       const success = engine.handleAction(socket.data.userId, data.action, data.amount);
       if (success) {
           syncRoom(io, engine);
       }
    });

    socket.on('start_game', (roomId: string) => {
        const engine = ACTIVE_GAMES.get(roomId);
        if (!engine) return;
        engine.startHand();
        syncRoom(io, engine);
        
        const room = getRooms().find(r => r.id === roomId);
        if(room) {
           room.status = 'playing';
           saveRoom(room);
           io.emit('rooms_list', getRooms());
        }
    });

    socket.on('leave_room', (roomId: string) => {
       if (!socket.data.userId) return;
       const engine = ACTIVE_GAMES.get(roomId);
       if (engine) {
          engine.leave(socket.data.userId);
          syncRoom(io, engine);
       }
       socket.leave(`room:${roomId}`);
    });

  });
}

function syncRoom(io: Server, engine: PokerEngine) {
    // instead of io.to(roomId).emit(), we need to send individual state because hole cards are secret
    const roomSockets = io.sockets.adapter.rooms.get(`room:${engine.state.id}`);
    if(roomSockets) {
        for(const socketId of roomSockets) {
            const socket = io.sockets.sockets.get(socketId);
            if(socket && socket.data.userId) {
                socket.emit('game_update', engine.getClientState(socket.data.userId));
            }
        }
    }
}
