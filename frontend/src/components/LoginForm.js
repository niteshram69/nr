import React, { useState } from 'react';

const LoginForm = ({ onJoin }) => {
  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !username.trim()) return;
    
    setIsLoading(true);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const endpoint = backendUrl ? `${backendUrl.replace(/\/$/, '')}/token` : '/api/token';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          username,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get token');
      }
      
      const { url, token } = await response.json();
      onJoin(url, token, username);
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="brand">
        <span className="logo">nr inc</span>
        <h1>Nr inc chat support</h1>
      </div>
      <p className="subtitle">Real‑time support powered by OpenRouter</p>
      
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="roomName">Room Name</label>
          <input
            id="roomName"
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name"
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="username">Your Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            disabled={isLoading}
          />
        </div>
        
        <button type="submit" className="join-button" disabled={isLoading}>
          {isLoading ? 'Joining...' : 'Join Room'}
        </button>
      </form>
      
      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: radial-gradient(1200px 600px at 50% -20%, #0f3b2e 0%, rgba(0,0,0,0) 60%), #0b0b0b;
          color: #eaeaea;
        }
        .brand { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
        .logo { font-weight: 800; background:#00a67d; color:#111; padding:4px 8px; border-radius:6px; text-transform: lowercase; }
        h1 { margin:0; font-size: 28px; }
        .subtitle { margin: 6px 0 24px; color:#b5b5b5; }
        
        .login-form {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 440px;
          padding: 24px;
          border: 1px solid #2a2a2a;
          border-radius: 14px;
          background: #121212;
          box-shadow: 0 10px 40px rgba(0,0,0,0.35);
        }
        
        .form-group {
          margin-bottom: 16px;
        }
        
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #cfcfcf;
        }
        
        input {
          width: 100%;
          padding: 12px;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          font-size: 16px;
          background:#1b1b1b; color:#fff;
        }
        
        .join-button {
          padding: 14px;
          background-color: #00a67d;
          color: #111;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 8px;
        }
        
        .join-button:hover {
          filter: brightness(1.05);
        }
        
        .join-button:disabled {
          background-color: #2f2f2f;
          color: #8a8a8a;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default LoginForm;