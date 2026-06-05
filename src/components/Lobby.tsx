import React, { useState } from 'react';
import { User, Room } from '../types';
import { PlusCircle, Search, Play, Users } from 'lucide-react';

export default function Lobby({ user, rooms, rankings, onCreate, onJoin }: { user: User, rooms: Room[], rankings: User[], onCreate: (d: any)=>void, onJoin: (id: string)=>void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [joinId, setJoinId] = useState('');

  if (showCreate) {
     return <CreateRoom onCreate={d => { onCreate(d); setShowCreate(false); }} onCancel={()=>setShowCreate(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-amber-500">朋友局大厅</h1>
            <p className="text-sm text-slate-400 mt-1">欢迎, {user.name}</p>
          </div>
          <div className="bg-[#1A1A1C] border border-white/5 px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500" />
            <span className="font-mono text-sm">{user.chips.toLocaleString()}</span>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
           <button 
             onClick={() => setShowCreate(true)}
             className="bg-emerald-600 hover:bg-emerald-500 transition-colors p-6 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
           >
              <PlusCircle className="w-8 h-8" />
              <span className="font-medium text-lg">创建私人房间</span>
           </button>

           <div className="bg-[#1A1A1C] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-4">
              <span className="font-medium text-slate-300">加入朋友的牌桌</span>
              <div className="flex w-full max-w-xs gap-2">
                 <input 
                   placeholder="输入6位房间号" 
                   value={joinId}
                   onChange={e => setJoinId(e.target.value.toUpperCase())}
                   className="flex-1 bg-black/40 px-4 py-2 border border-white/10 rounded-lg text-center tracking-widest font-mono uppercase text-slate-100 outline-none focus:border-amber-500"
                 />
                 <button 
                   disabled={joinId.length !== 6}
                   onClick={() => onJoin(joinId)}
                   className="bg-emerald-600 disabled:opacity-30 disabled:bg-neutral-600 px-4 rounded-lg flex items-center justify-center hover:bg-emerald-500"
                 >
                   <Play className="w-5 h-5 fill-current" />
                 </button>
              </div>
           </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-slate-300 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> 进行中的朋友牌局
          </h2>
          {rooms.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1A1C]/50 border border-white/5 rounded-2xl text-slate-500">
               还没有正在进行的牌局，快去建一个吧！
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map(r => (
                <div key={r.id} className="bg-[#1A1A1C] border border-white/5 p-4 rounded-xl flex justify-between items-center hover:bg-slate-800 transition cursor-pointer" onClick={() => onJoin(r.id)}>
                   <div>
                     <div className="font-medium flex items-center gap-2">
                        {r.name}
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-white/10 uppercase">{r.mode === 'cash' ? '现金桌' : '锦标赛'}</span>
                     </div>
                     <div className="text-sm text-slate-400 mt-1">盲注 {r.bigBlind/2}/{r.bigBlind} - {r.status === 'waiting' ? '等待中' : '游戏中'}</div>
                   </div>
                   <div className="text-right">
                     <span className="font-mono text-amber-500">{r.id}</span>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateRoom({ onCreate, onCancel }: { onCreate: (d: any)=>void, onCancel: ()=>void }) {
  const [mode, setMode] = useState<'cash'|'tournament'>('cash');
  const [max, setMax] = useState(6);
  const [chips, setChips] = useState(10000);
  const [bb, setBb] = useState(100);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-100 p-4 md:p-8">
      <div className="max-w-xl mx-auto bg-[#1A1A1C] border border-white/5 p-6 rounded-2xl shadow-xl">
        <h2 className="text-xl font-bold mb-6 text-amber-500">创建新房间</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">玩法</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={mode==='cash'} onChange={()=>setMode('cash')} className="text-emerald-500 focus:ring-emerald-500" />
                <span>现金桌 (随时坐下离开)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={mode==='tournament'} onChange={()=>setMode('tournament')} className="text-emerald-500 focus:ring-emerald-500" />
                <span>锦标赛 (淘汰制)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">桌位</label>
            <div className="flex gap-2">
               {[2,6,9].map(n => (
                 <button key={n} onClick={()=>setMax(n)} className={`px-4 py-2 rounded-lg border transition-colors ${max===n ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50' : 'bg-black/40 border-white/10 hover:bg-white/5'}`}>{n} 人桌</button>
               ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">初始筹码</label>
              <input type="number" value={chips} onChange={e=>setChips(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 px-4 py-2 rounded-lg outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">大盲注</label>
              <input type="number" value={bb} onChange={e=>setBb(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 px-4 py-2 rounded-lg outline-none focus:border-amber-500" />
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button onClick={onCancel} className="flex-1 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">取消</button>
            <button onClick={() => onCreate({ name:`${mode==='cash'?'现金':'锦标'} ${max}人桌`, mode, max, chips, bb })} className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">创建</button>
          </div>
        </div>
      </div>
    </div>
  );
}
