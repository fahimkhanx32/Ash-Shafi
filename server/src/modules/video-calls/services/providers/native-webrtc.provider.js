import env from '../../../../config/env.js';

/**
 * BET-14.2 — The default, always-available video provider (master
 * prompt §32). Patient and doctor browsers connect to each other
 * directly over peer-to-peer WebRTC; this server's only role is
 * relaying SDP offers/answers and ICE candidates over the already-
 * authenticated Socket.IO connection (`socket/index.js`'s
 * `video:signal` handler) so the two sides can find each other.
 * Media (audio/video) never touches this server or any third party —
 * the strongest privacy posture available without standing up
 * dedicated media-relay (TURN/SFU) infrastructure, and exactly what
 * master prompt §32 asks for ("do not make video consultation
 * dependent on an arbitrary free service that compromises privacy").
 *
 * Always reports itself configured — there is no external account or
 * credential required for pure signaling relay.
 *
 * `iceServers` is sourced from `env.video.iceServers` (STUN-only by
 * default; see `.env.example`). STUN only helps two peers discover
 * their public network address for NAT traversal — it never sees or
 * relays call *content*, unlike a TURN relay or a hosted media
 * gateway would. A TURN server can be added later via the same env
 * var (for callers behind restrictive/symmetric NATs that can't
 * complete a direct peer connection) without any code change here;
 * until then, that is a known, documented limitation rather than a
 * silently-fake capability (master prompt §79 — no placeholder
 * behavior presented as complete).
 *
 * @type {import('./video-provider.interface.js').VideoProvider}
 */
export const nativeWebrtcProvider = {
  name: 'native',

  isConfigured: () => true,

  createRoom: ({ roomId }) => ({
    roomId,
    iceServers: env.video.iceServers,
  }),
};
