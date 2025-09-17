import { AccessToken } from 'livekit-server-sdk';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Manually parse body to avoid Next 400 Invalid JSON pre-parsing
  let raw = '';
  try {
    raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  } catch (_) {
    // ignore and continue
  }
  let roomName = '';
  let username = '';
  try {
    if (raw) {
      const asJson = JSON.parse(raw);
      roomName = asJson.roomName || '';
      username = asJson.username || '';
    }
  } catch (_) {
    // Try urlencoded
    try {
      const params = new URLSearchParams(raw);
      roomName = params.get('roomName') || '';
      username = params.get('username') || '';
    } catch (_) {}
  }

  if (!roomName || !username) {
    return res.status(400).json({ error: 'Missing room name or username' });
  }

  try {
    // Load environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitHost = process.env.LIVEKIT_HOST || 'wss://your-livekit-server';

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LiveKit credentials not configured' });
    }

    // Create a new access token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: username,
      ttl: '15m', // Token expires in 15 minutes
    });

    // Add grants for the token
    token.addGrant({
      room: roomName,
      roomJoin: true,
      roomCreate: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Generate the JWT token
    const jwtToken = await token.toJwt();

    return res.status(200).json({ url: livekitHost, token: jwtToken });
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
}