import express from 'express';

import {
  createSessionController,
  executeToolController,
  listToolsController,
} from '../controllers/voice.controller.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';

/**
 * ElevenLabs Voice Agent routes.
 *
 * `POST /session` — called by the frontend when the doctor opens the
 * voice assistant; returns an ElevenLabs signed URL + dynamic
 * variables (`services/voice-session.service.js`).
 *
 * `GET /tools` — introspection only (tool names/permissions/risk
 * tiers, never handler internals); useful for the settings/testing
 * UI and for verifying the registry without needing a live ElevenLabs
 * agent.
 *
 * `POST /tools/:toolName` — the one webhook URL every server tool in
 * the ElevenLabs agent's own configuration points at
 * (`docs/elevenlabs-voice-agent.md` documents the exact agent-side
 * setup). Deliberately a single generic route rather than one route
 * per tool — the tool registry (`tools/tool-registry.js`) is the
 * single source of truth for what tools exist, not Express's routing
 * table, so adding a new tool never requires touching this file.
 */
const router = express.Router();

router.use(authenticate);

router.post('/session', createSessionController);
router.get('/tools', listToolsController);
router.post('/tools/:toolName', executeToolController);

export default router;
