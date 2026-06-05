import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, PlayerState, Card as CardType } from '../engine';
import { User } from '../types';
import { ArrowLeft, MessageSquare, Play, Info } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

function Card({ card, className }: { card: CardType, className?: string }) {
  if (!card || card === '??') {
    return (
      <div className={cn("w-14 h-20 rounded-md border-2 border-[#1A1A1C] bg-slate-800 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]", className)}>
        <div className="w-8 h-12 border border-white/5 rounded-sm" />
      </div>
    );
  }
  const rank = card[0];
  const suit = card[1];
  const isRed = suit === 'h' || suit === 'd';
  const suitSymbol = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' }[suit];

  return (
    <div className={cn("w-14 h-20 bg-white rounded-lg shadow-xl flex flex-col justify-between p-1", className)}>
      <span className={cn("font-bold self-start leading-none", isRed ? 'text-red-600' : 'text-slate-900')}>{rank}</span>
      <span className={cn("text-2xl self-center", isRed ? 'text-red-600' : 'text-slate-900')}>{suitSymbol}</span>
      <span className={cn("font-bold self-end leading-none rotate-180", isRed ? 'text-red-600' : 'text-slate-900')}>{rank}</span>
    </div>
  );
}

export default function GameRoom({ socket, user, state, onLeave }: { socket: Socket, user: User, state: GameState | null, onLeave: ()=>void }) {
  const [emotes, setEmotes] = useState<{id:string, text:string, time:number}[]>([]);

  useEffect(() => {
    socket.on('emote', (data: {userId:string, text:string}) => {
       setEmotes(prev => [...prev, { id: data.userId, text: data.text, time: Date.now() }]);
       setTimeout(() => {
         setEmotes(prev => prev.filter(e => Date.now() - e.time < 3000));
       }, 3000);
    });
    return () => { socket.off('emote'); };
  }, []);

  if (!state) return <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-emerald-400 tracking-widest font-bold animate-pulse">正在进入牌局...</div>;

  const myPlayer = state.players.find(p => p.id === user.id);
  const myPos = state.players.findIndex(p => p.id === user.id);
  const isMyTurn = state.stage !== 'waiting' && state.stage !== 'showdown' && state.turnPos === myPos;

  const handleAction = (action: string, amount?: number) => {
    socket.emit('action', { roomId: state.id, action, amount });
  };

  const sendEmote = (text: string) => {
    socket.emit('emote', { roomId: state.id, text });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-100 flex flex-col font-sans overflow-hidden">
      <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-black/40 z-10 relative">
        <button onClick={onLeave} className="flex items-center gap-2 hover:text-emerald-300 transition text-sm"><ArrowLeft className="w-5 h-5"/> 离开</button>
        <div className="flex items-center gap-6">
           <div className="flex flex-col text-center md:text-left">
             <span className="text-[10px] uppercase tracking-widest text-slate-500">房间号 Room ID</span>
             <h2 className="text-lg font-bold text-amber-500 flex items-center justify-center gap-2">
               #{state.id}
               <button 
                  onClick={() => {
                     const url = new URL(window.location.href);
                     url.searchParams.set('room', state.id);
                     navigator.clipboard.writeText(url.toString());
                     alert('邀请链接已复制！');
                  }}
                  className="text-slate-500 hover:text-slate-100"
                  title="复制邀请链接"
               >
                 <Info className="w-4 h-4" />
               </button>
             </h2>
           </div>
           <div className="hidden md:block h-8 w-[1px] bg-white/10"></div>
           <div className="hidden md:flex flex-col">
             <span className="text-[10px] uppercase tracking-widest text-slate-500">盲注 Blinds</span>
             <span className="text-lg font-medium">{state.smallBlind} / {state.bigBlind}</span>
           </div>
        </div>
        <button onClick={()=>socket.emit('start_game', state.id)} className="bg-emerald-600 px-4 py-2 rounded font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-1 text-sm" disabled={state.stage !== 'waiting' && state.stage !== 'showdown'}>
          <Play className="w-4 h-4"/> 开始
        </button>
      </header>

      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Table Felt */}
        <div className="absolute w-[90%] max-w-4xl aspect-[2/1] rounded-[200px] border-[12px] border-[#1A1A1C] bg-gradient-to-b from-[#064E3B] to-[#022C22] shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] flex items-center justify-center">
            {/* Board */}
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-col items-center">
                 <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/50">总底池 Total Pot</span>
                 <span className="text-3xl font-bold text-white tracking-tighter">{state.pot}</span>
              </div>
              <div className="flex gap-2 min-h-[5rem]">
                 {state.board.map((c, i) => <Card key={i} card={c} />)}
                 {state.board.length === 0 && state.stage !== 'waiting' && <div className="w-14 h-20 bg-emerald-900/30 border-2 border-dashed border-emerald-500/30 rounded-lg flex items-center justify-center"><span className="text-[10px] text-emerald-500/50 uppercase font-bold text-center">Waiting</span></div>}
              </div>
            </div>
        </div>

        {/* Players */}
        {state.players.map((p, i) => {
           // simple circular positioning for up to 9 players
           const total = state.players.length || 1;
           const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
           const rx = 40; // x radius %
           const ry = 35; // y radius %
           
           const isActiveTurn = state.stage !== 'waiting' && state.turnPos === i;
           const isDealer = state.dealerPos === i;
           const emote = emotes.find(e => e.id === p.id);

           return (
             <div 
               key={p.id} 
               className={cn("absolute flex flex-col items-center gap-2 transition-all duration-500", p.folded && "opacity-50")}
               style={{ 
                 left: `calc(50% + ${Math.cos(angle) * rx}%)`, 
                 top: `calc(50% + ${Math.sin(angle) * ry}%)`, 
                 transform: 'translate(-50%, -50%)' 
               }}
             >
                {/* Emote Bubble */}
                {emote && (
                  <div className="absolute -top-10 bg-white text-black px-3 py-1 rounded-full text-sm font-bold shadow-lg animate-bounce z-50 whitespace-nowrap">
                    {emote.text}
                    {/* triangle */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-black/0 border-t-white" />
                  </div>
                )}

                {/* Dealer Button */}
                {isDealer && <div className="absolute -left-6 top-6 w-6 h-6 bg-white shrink-0 text-black rounded-full flex items-center justify-center text-[10px] shadow-md border shadow-black/50 z-20 font-bold">D</div>}

                {/* Cards */}
                <div className="flex -space-x-4 mb-[-1rem] z-10 relative">
                   {p.cards.map((c, ci) => (
                     <Card 
                       key={ci} 
                       card={c} 
                       className={cn("transition-transform", ci === 1 && "rotate-6 translate-y-1")} 
                     />
                   ))}
                </div>

                {/* Main Avatar Box */}
                <div className={cn(
                  "bg-slate-800 rounded-lg p-2 min-w-[100px] flex flex-col items-center relative z-20 border-2 shadow-xl", 
                  isActiveTurn ? "border-amber-500 shadow-amber-500/50" : "border-white/10"
                )}>
                   <div className="truncate w-20 text-center text-sm font-bold">{p.name}</div>
                   <div className="font-mono text-amber-400 font-bold text-xs">{p.chips}</div>
                   {isActiveTurn && <div className="absolute -bottom-1 left-0 right-0 h-1 bg-amber-500 animate-pulse rounded-full" />}
                </div>

                {/* Bet */}
                {p.bet > 0 && (
                  <div className="absolute -bottom-8 bg-black/60 px-2 py-0.5 rounded text-sm text-amber-400 font-mono italic">
                    {p.bet}
                  </div>
                )}
                {p.isAllIn && <div className="absolute -right-4 -bottom-4 bg-red-600 text-white text-[10px] px-1 rounded font-bold uppercase rotate-12">All-in</div>}
                
             </div>
           );
        })}
      </div>

      {/* Action Bar */}
      <footer className="bg-black/80 border-t border-white/5 p-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
         <div className="max-w-4xl mx-auto flex items-center justify-between">
            {myPlayer && isMyTurn ? (
              <div className="flex flex-1 gap-3">
                 <button onClick={()=>handleAction('fold')} className="w-24 md:w-28 h-14 md:h-16 bg-slate-900 border border-slate-700 rounded-xl font-bold text-slate-400 hover:text-white transition-all text-xs md:text-sm">弃牌 FOLD</button>
                 {myPlayer.bet === state.currentBet ? (
                   <button onClick={()=>handleAction('check')} className="w-24 md:w-28 h-14 md:h-16 bg-slate-900 border border-slate-700 rounded-xl font-bold text-slate-400 hover:text-white transition-all text-xs md:text-sm">看牌 CHECK</button>
                 ) : (
                   <button onClick={()=>handleAction('call')} className="w-28 md:w-36 h-14 md:h-16 bg-emerald-600 rounded-xl font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500 transition-all text-xs md:text-sm">跟注 CALL {state.currentBet - myPlayer.bet}</button>
                 )}
                 <button onClick={()=>handleAction('raise', state.bigBlind * 2)} className="flex-1 max-w-36 h-14 md:h-16 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold text-white transition-all text-xs md:text-sm">加注 RAISE</button>
                 <button onClick={()=>handleAction('allin')} className="w-20 md:w-24 h-14 md:h-16 bg-red-600 rounded-xl font-black text-white hover:bg-red-500 transition-all italic tracking-tighter text-xs md:text-sm">ALL IN</button>
              </div>
            ) : (
              <div className="flex flex-1 gap-4 items-center justify-between">
                 <div className="flex gap-2">
                    <button onClick={()=>sendEmote('👍')} className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center hover:bg-slate-700 transition-colors text-xl">👍</button>
                    <button onClick={()=>sendEmote('好牌!')} className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center hover:bg-slate-700 transition-colors text-sm font-bold">好牌</button>
                    <button onClick={()=>sendEmote('All in!')} className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center hover:bg-slate-700 transition-colors text-sm font-bold text-red-500 italic">All In</button>
                 </div>
                 <div className="flex-1 flex justify-end">
                   <div className="bg-[#1A1A1C] border border-white/5 py-3 px-6 rounded-xl text-sm text-slate-500 uppercase tracking-widest font-bold">
                     等待其他玩家行动...
                   </div>
                 </div>
              </div>
            )}
         </div>
      </footer>
    </div>
  );
}
