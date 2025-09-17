import { Room, RoomEvent, DataPacket_Kind, ConnectionState } from 'livekit-client';

export class LiveKitChatClient {
  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: false,
      publishDefaults: { video: false, audio: false },
    });
    this.username = '';
    this.messageCallbacks = [];
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('[LiveKit] Connection state:', ConnectionState[state] || state);
    });
    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.warn('[LiveKit] Disconnected. Reason:', reason);
    });
    this.room.on(RoomEvent.Reconnecting, () => console.warn('[LiveKit] Reconnecting...'));
    this.room.on(RoomEvent.Reconnected, () => console.warn('[LiveKit] Reconnected'));
    this.room.on(RoomEvent.SignalConnected, () => console.log('[LiveKit] Signal connected'));
    this.room.on(RoomEvent.ConnectionQualityChanged, (participant, quality) => {
      console.log('[LiveKit] Quality', participant?.identity, quality);
    });
    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('Participant disconnected:', participant.identity);
    });

    this.room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'chat_message') {
          this.messageCallbacks.forEach(callback => {
            callback({
              sender: participant?.identity || 'unknown',
              message: data.message,
              timestamp: new Date(),
              isLocal: false
            });
          });
        }
      } catch (e) {
        console.error('Error parsing data packet:', e);
      }
    });
  }

  async connect(url, token, username) {
    this.username = username;
    try {
      await this.room.connect(url, token, {
        autoSubscribe: false,
      });
      console.log('Connected to room');
      return true;
    } catch (err) {
      console.error('[LiveKit] connect error:', err);
      return false;
    }
  }

  disconnect() {
    this.room.disconnect();
  }

  onMessage(callback) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  sendMessage(message) {
    const data = JSON.stringify({
      type: 'chat_message',
      message: message,
      username: this.username
    });
    
    this.room.localParticipant.publishData(
      new TextEncoder().encode(data),
      DataPacket_Kind.RELIABLE
    );

    // Also add to local callbacks for immediate display
    this.messageCallbacks.forEach(callback => {
      callback({
        sender: this.username,
        message: message,
        timestamp: new Date(),
        isLocal: true
      });
    });
  }
}