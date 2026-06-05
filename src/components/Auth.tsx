import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export default function Auth({ onLogin, socket }: { onLogin: (name: string) => void, socket: Socket }) {
  const [name, setName] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      setError('');
    }
    function onDisconnect() {
      setConnected(false);
      setConnecting(false);
    }
    function onConnectError(err: Error) {
      setError(`连接服务器失败: ${err.message}`);
      setConnecting(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  const handleLogin = () => {
    if (!name) return;
    setConnecting(true);
    onLogin(name);
    // If it doesn't respond in 5s, show timeout
    setTimeout(() => {
       setConnecting(false);
       if (!socket.connected) {
          setError('登录超时，请检查网络连接');
       }
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-white">
      <div className="bg-[#1A1A1C] border border-white/5 p-8 rounded-xl shadow-2xl w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-amber-500">朋友局德州扑克</h1>
        
        {error && (
           <div className="mb-4 bg-red-900/50 border border-red-500 text-red-200 p-3 rounded text-sm text-center">
             {error}
           </div>
        )}
        {!connected && !error && (
           <div className="mb-4 bg-amber-900/50 border border-amber-500 text-amber-200 p-3 rounded text-sm text-center animate-pulse">
             正在连接服务器...
           </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">你的昵称</label>
            <input 
              type="text" 
              className="w-full bg-black/40 px-4 py-3 rounded-lg border border-white/10 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-slate-100 disabled:opacity-50"
              placeholder="怎么称呼你？"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name && handleLogin()}
              disabled={!connected || connecting}
            />
          </div>
          <button 
            disabled={!name || !connected || connecting}
            onClick={handleLogin}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex justify-center items-center gap-2"
          >
            {connecting ? '正在进入...' : '进入大厅'}
          </button>
        </div>
      </div>
    </div>
  );
}
