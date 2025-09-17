import React, { useState } from 'react';
import LoginForm from '../components/LoginForm';
import ChatRoom from '../components/ChatRoom';

const Home = () => {
  const [chatInfo, setChatInfo] = useState(null);

  const handleJoin = (url, token, username) => {
    setChatInfo({ url, token, username });
  };

  const handleLeave = () => {
    setChatInfo(null);
  };

  return (
    <div>
      {chatInfo ? (
        <ChatRoom
          url={chatInfo.url}
          token={chatInfo.token}
          username={chatInfo.username}
          onLeave={handleLeave}
        />
      ) : (
        <LoginForm onJoin={handleJoin} />
      )}
    </div>
  );
};

export default Home;