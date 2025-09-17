import React, { useState, useEffect, useRef } from 'react';
import { LiveKitChatClient } from '../utils/livekit';
import { RoomEvent, ConnectionState } from 'livekit-client';

const ChatRoom = ({ url, token, username, onLeave }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [model, setModel] = useState('openrouter/auto');
  const [isThinking, setIsThinking] = useState(false);
  const [bgUrl, setBgUrl] = useState('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2560&q=90&dpr=2');
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [connectError, setConnectError] = useState('');

  const chooseBackground = (text) => {
    const t = (text || '').toLowerCase();
    const picks = [
      { test: /(ocean|sea|beach|wave|island)/, url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(finance|invoice|billing|payment|money|bank|stocks|market)/, url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(code|bug|deploy|api|developer|program|software|ai)/, url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(shopping|order|cart|product|delivery|ecommerce|store)/, url: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(support|help|question|issue|problem|chat|customer)/, url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(travel|flight|hotel|trip|vacation|holiday|tour)/, url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(health|fitness|wellness|med|doctor|care)/, url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(city|night|urban|neon|lights)/, url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2560&q=90&dpr=2' },
      { test: /(mountain|forest|nature|landscape)/, url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2560&q=90&dpr=2' },
    ];
    const found = picks.find(p => p.test.test(t));
    if (found) {
      setBgUrl(found.url);
      return;
    }
    const curated = [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2560&q=90&dpr=2',
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2560&q=90&dpr=2',
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=2560&q=90&dpr=2',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2560&q=90&dpr=2',
    ];
    const idx = new Date().getHours() % curated.length;
    setBgUrl(curated[idx]);
  };
  const messagesEndRef = useRef(null);
  const clientRef = useRef(null);

  // Local storage helpers for conversation history
  const storageKey = `nrinc_conversations_${username}`;
  const loadConversations = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  };
  const persistConversations = (list) => {
    try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) {}
  };
  const getActiveConversation = (list, id) => list.find(c => c.id === id);
  const createNewConversation = () => ({
    id: `${Date.now()}`,
    title: 'New chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  });

  useEffect(() => {
    let didCancel = false;
    // Initialize history from localStorage but start a fresh conversation by default
    const initial = loadConversations();
    const fresh = createNewConversation();
    const merged = [fresh, ...(initial || [])];
    setConversations(merged);
    setActiveConversationId(fresh.id);
    setMessages([]); // do not auto-load previous messages into current view
    persistConversations(merged);

    const initializeChat = async () => {
      try {
        if (!clientRef.current) {
          clientRef.current = new LiveKitChatClient();
        }
        
        // Reflect connection state
        clientRef.current.room.on(RoomEvent.ConnectionStateChanged, (state) => {
          setIsConnected(state === ConnectionState.Connected);
          if (state === ConnectionState.Disconnected) {
            setConnectError('Disconnected from room. Please try rejoining.');
          }
        });
        clientRef.current.room.on(RoomEvent.Disconnected, (reason) => {
          setConnectError(`Disconnected: ${reason || 'unknown reason'}`);
        });
        
        // Set up message listener
        clientRef.current.onMessage((msg) => {
          setMessages(prev => {
            const next = [...prev, msg];
            // Reflect in conversations
            setConversations(curr => {
              const list = [...curr];
              const active = getActiveConversation(list, activeConversationId) || list[0];
              if (active) {
                active.messages = [...(active.messages || []), msg];
                active.updatedAt = new Date().toISOString();
                // Update title from first user prompt if still default
                if (active.title === 'New chat') {
                  const firstUser = next.find(m => m.isLocal) || next[0];
                  if (firstUser && firstUser.message) active.title = (firstUser.message || '').slice(0, 40);
                }
              }
              persistConversations(list);
              return list;
            });
            return next;
          });
        });
        
        // Connect to the room
        if (didCancel) return;
        const ok = await clientRef.current.connect(url, token, username);
        if (ok) {
          setIsConnected(true);
          setConnectError('');
        } else {
          setIsConnected(false);
          setConnectError('Failed to connect to LiveKit. Please verify token/URL and try again.');
          return;
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setIsConnected(false);
        setConnectError(String(error?.message || error || 'Failed to connect'));
      }
    };

    initializeChat();

    return () => {
      didCancel = true;
      try {
        if (clientRef.current) {
          clientRef.current.disconnect();
          clientRef.current = null;
        }
      } catch (_) {}
    };
  }, [url, token, username]);

  useEffect(() => {
    // Scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const callBackendForReply = async (userMessage) => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) return;

    try {
      setIsThinking(true);
      const res = await fetch(`${backendUrl.replace(/\/$/, '')}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, message: userMessage, provider: 'openrouter', model }),
      });
      if (!res.ok) throw new Error('chat endpoint failed');
      const data = await res.json();
      const aiReply = data.reply || '';
      if (!aiReply) return;
      setMessages(prev => [...prev, {
        sender: 'AI',
        message: aiReply,
        timestamp: new Date(),
        isLocal: false,
      }]);
    } catch (err) {
      console.error('AI reply failed:', err);
      setMessages(prev => [...prev, {
        sender: 'System',
        message: 'Sorry, I had trouble replying. Please try again.',
        timestamp: new Date(),
        isLocal: false,
        isSystem: true,
      }]);
    }
    finally { setIsThinking(false); }
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;
    if (!isConnected) {
      alert('Still connecting to the room. Please wait a moment...');
      return;
    }
    const msg = inputValue;
    clientRef.current.sendMessage(msg);
    chooseBackground(msg);
    setInputValue('');
    // Ask backend for AI reply if configured
    callBackendForReply(msg);
  };

  const handleNewChat = () => {
    // Save current is implicit in conversations state; just open a new one
    const fresh = createNewConversation();
    setConversations(prev => {
      const list = [fresh, ...prev];
      persistConversations(list);
      return list;
    });
    setActiveConversationId(fresh.id);
    setMessages([]);
  };

  const openConversation = (id) => {
    setActiveConversationId(id);
    const conv = conversations.find(c => c.id === id);
    const convMessages = (conv?.messages || []).map(m => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
    setMessages(convMessages);
  };

  const deleteConversation = (id) => {
    setConversations(prev => {
      const list = prev.filter(c => c.id !== id);
      persistConversations(list);
      if (id === activeConversationId) {
        if (list.length) {
          setActiveConversationId(list[0].id);
          const convMessages = (list[0].messages || []).map(m => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }));
          setMessages(convMessages);
        } else {
          const fresh = createNewConversation();
          persistConversations([fresh]);
          setActiveConversationId(fresh.id);
          setMessages([]);
          return [fresh];
        }
      }
      return list;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="brand">
          <span className="logo">nr inc</span>
          <h2>Nr inc support</h2>
        </div>
        <div className="controls">
          <button className="icon-button" title="History" onClick={() => setShowHistory(v => !v)}>
            ☰
          </button>
          <input
            type="text"
            className="model-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model (e.g., openrouter/auto)"
          />
          <div className="user-info">User: {username}</div>
          <button onClick={onLeave} className="leave-button">Leave</button>
        </div>
      </div>
      {connectError && (
        <div className="banner error">{connectError}</div>
      )}
      
      <div className={`layout ${showHistory ? 'with-sidebar' : ''}`}>
        {showHistory && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <span>History</span>
              <div style={{display:'flex', gap:'6px'}}>
                <button className="new-chat" onClick={handleNewChat}>+ New</button>
                <button className="clear-chat" onClick={() => { setConversations([]); persistConversations([]); setMessages([]); const n = createNewConversation(); setConversations([n]); setActiveConversationId(n.id); persistConversations([n]); }}>Clear</button>
              </div>
            </div>
            <div className="sidebar-list">
              {conversations.length === 0 && (
                <div className="empty">No conversations yet</div>
              )}
              {conversations.map(c => (
                <div
                  key={c.id}
                  className={`conv-item ${c.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => openConversation(c.id)}
                >
                  <div className="conv-title">{c.title || 'Untitled'}</div>
                  <div className="conv-meta">{new Date(c.updatedAt || c.createdAt).toLocaleString()}</div>
                  <button className="delete" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>×</button>
                </div>
              ))}
            </div>
          </aside>
        )}

        <div className="messages-container" style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundAttachment: 'fixed',
        }}>
          <div className="backdrop"/>
          <div className="vignette"/>
        {messages.length === 0 ? (
          <div className="no-messages">
            <div className="mascot">💬</div>
            <div className="hint-title">Welcome to Nr inc support</div>
            <div className="hint-sub">Ask anything about your account, orders, or features.</div>
            <ul className="quick-prompts">
              <li onClick={() => setInputValue('Help me with my order status.')}>Help me with my order status.</li>
              <li onClick={() => setInputValue('Summarize our last conversation.')}>Summarize our last conversation.</li>
              <li onClick={() => setInputValue('What’s new in the latest release?')}>What’s new in the latest release?</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`row ${msg.isLocal ? 'right' : 'left'}`}>
              {!msg.isLocal && (
                <div className="avatar ai">AI</div>
              )}
              <div className={`bubble ${msg.isLocal ? 'me' : (msg.isSystem ? 'system' : 'ai')}`}>
                {!msg.isLocal && !msg.isSystem && <div className="sender">AI</div>}
                {msg.isSystem && <div className="sender">System</div>}
                <div className="content">{msg.message}</div>
                <div className="time">{msg.timestamp.toLocaleTimeString()}</div>
              </div>
              {msg.isLocal && (
                <div className="avatar me">{username.slice(0,2).toUpperCase()}</div>
              )}
            </div>
          ))
        )}
        {isThinking && (
          <div className="row left">
            <div className="avatar ai">AI</div>
            <div className="bubble ai typing">
              <span className="dot"/>
              <span className="dot"/>
              <span className="dot"/>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="input-container">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="message-input"
        />
        <button 
          onClick={handleSendMessage} 
          className="send-button"
          disabled={inputValue.trim() === ''}
        >
          Send
        </button>
      </div>
      
      <style jsx>{`
        .chat-container {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          margin: 0;
          border: none;
          border-radius: 0;
          overflow: hidden;
          background: #0b0b0b;
        }
        
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          background: linear-gradient(90deg, #0f0f10 0%, #1a1a1d 100%);
          color: #fff;
          border-bottom: 1px solid #2a2a2a;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .logo { font-weight: 800; background:#00a67d; color:#111; padding:2px 6px; border-radius:4px; text-transform: lowercase; letter-spacing:0.3px; }
        .controls { display: flex; align-items: center; gap: 8px; }
        .icon-button { background:#151515; color:#eaeaea; border:1px solid #2a2a2a; border-radius:6px; padding:6px 10px; cursor:pointer; }
        .icon-button:hover { border-color:#00a67d; }
        .selector, .model-input, .key-input { padding:6px 8px; border-radius:6px; border:1px solid #444; background:#1b1b1b; color:#fff; }
        
        .user-info {
          font-weight: bold;
        }
        
        .leave-button {
          padding: 5px 10px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .layout { display:flex; min-height: 0; flex:1; }
        .layout.with-sidebar { grid-template-columns: 280px 1fr; }
        .sidebar { width: 280px; background:#0e0e10; border-right:1px solid #2a2a2a; display:flex; flex-direction:column; }
        .sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:10px; color:#ddd; border-bottom:1px solid #2a2a2a; }
        .new-chat { background:#00a67d; color:#111; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; }
        .clear-chat { background:#272727; color:#e3e3e3; border:1px solid #3a3a3a; border-radius:6px; padding:6px 10px; cursor:pointer; }
        .sidebar-list { flex:1; overflow:auto; padding:8px; }
        .empty { color:#7a7a7a; padding:10px; text-align:center; }
        .conv-item { position:relative; border:1px solid #2a2a2a; background:rgba(18,18,20,0.85); color:#e6e6e6; border-radius:10px; padding:12px; margin-bottom:10px; cursor:pointer; transition: border-color .2s ease, transform .15s ease; }
        .conv-item:hover { border-color:#3a3a3a; transform: translateY(-1px); }
        .conv-item.active { border-color:#00a67d; background:rgba(20,22,23,0.9); }
        .conv-title { font-weight:700; font-size:13px; margin-bottom:4px; }
        .conv-meta { font-size:11px; color:#9a9a9a; }
        .conv-item .delete { position:absolute; right:8px; top:8px; background:transparent; color:#7a7a7a; border:none; cursor:pointer; }

        .messages-container {
          position:relative;
          flex-grow: 1;
          overflow-y: auto;
          padding: 15px;
        }
        .backdrop { position:absolute; inset:0; background: linear-gradient(180deg, rgba(10,10,12,0.28) 0%, rgba(10,10,12,0.65) 100%); backdrop-filter: saturate(1.25) blur(0.7px); pointer-events:none; }
        .vignette { position:absolute; inset:0; background: radial-gradient(1200px 400px at 50% -100px, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 55%), radial-gradient(800px 300px at 50% 100%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 60%); pointer-events:none; }
        
        .no-messages { text-align:center; color:#c8c8c8; padding:40px 10px; }
        .mascot { font-size:48px; margin-bottom:10px; }
        .hint-title { font-weight:700; font-size:18px; margin-bottom:4px; }
        .hint-sub { color:#9a9a9a; margin-bottom:14px; }
        .quick-prompts { list-style:none; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; padding:0; }
        .quick-prompts li { background:#151515; border:1px solid #2a2a2a; padding:8px 12px; border-radius:999px; cursor:pointer; }
        .quick-prompts li:hover { border-color:#00a67d; }
        
        .row { display:flex; gap:10px; margin: 10px 0; align-items:flex-end; }
        .row.right { justify-content: flex-end; }
        .avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
        .avatar.ai { background:#0e614b; color:#d8fff4; }
        .avatar.me { background:#2f2f2f; color:#eaeaea; }
        .bubble { max-width: min(80%, 760px); padding:12px 14px; border-radius:16px; position:relative; box-shadow: 0 8px 30px rgba(0,0,0,0.15); }
        .bubble.ai { background:rgba(24,24,26,0.86); border:1px solid rgba(255,255,255,0.06); color:#eaeaea; backdrop-filter: blur(6px) saturate(1.1); }
        .bubble.system { background:rgba(36,36,36,0.88); border:1px dashed #3a3a3a; color:#e6e6e6; }
        .bubble.me { background:rgba(220,248,198,0.92); color:#0b0b0b; }
        .sender { font-size:12px; font-weight:700; margin-bottom:4px; opacity:0.85; }
        .content { white-space:pre-wrap; word-wrap:break-word; }
        .time { font-size:11px; opacity:0.6; margin-top:6px; text-align:right; }
        .typing { display:flex; gap:6px; padding:10px 12px; }
        .dot { width:6px; height:6px; background:#d2fff3; border-radius:50%; display:inline-block; animation: blink 1.2s infinite ease-in-out; }
        .dot:nth-child(2){ animation-delay:0.2s; }
        .dot:nth-child(3){ animation-delay:0.4s; }
        @keyframes blink { 0%,80%,100%{ opacity:0.2 } 40%{ opacity:1 } }
        
        .message-sender {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .message-content {
          word-wrap: break-word;
        }
        
        .message-time {
          font-size: 0.8em;
          color: #888;
          margin-top: 5px;
          text-align: right;
        }
        
        .input-container {
          display: flex;
          padding: 14px 16px;
          border-top: 1px solid #2a2a2a;
          background: linear-gradient(180deg, rgba(15,15,16,0.7) 0%, rgba(17,17,18,0.95) 100%);
          backdrop-filter: blur(8px) saturate(1.1);
        }
        
        .message-input {
          flex-grow: 1;
          padding: 14px 14px;
          border: 1px solid #2b2b2b;
          border-radius: 12px;
          resize: none;
          min-height: 52px;
          background: linear-gradient(180deg, #1a1a1d 0%, #141416 100%);
          color:#fff;
          outline:none;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .message-input:focus { border-color:#00a67d; box-shadow: 0 0 0 3px rgba(0,166,125,0.18); }
        
        .send-button {
          margin-left: 12px;
          padding: 0 22px;
          background: linear-gradient(180deg, #07c399 0%, #00a67d 100%);
          color: #0e1111;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(0,166,125,0.25);
          transition: transform .08s ease, filter .15s ease;
        }
        .send-button:hover { filter: brightness(1.05); }
        .send-button:active { transform: translateY(1px); }
        
        .send-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        .banner.error { background:#3a1212; color:#ffc5c5; border-top:1px solid #5a1a1a; border-bottom:1px solid #5a1a1a; padding:8px 12px; font-size:13px; }
      `}</style>
    </div>
  );
};

export default ChatRoom;