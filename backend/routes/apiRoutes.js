/**
 * apiRoutes.js
 * -----------------------------------------------------------------------------
 * This module defines API endpoints for backend features.
 *
 * For Step 5, we add:
 * - POST /debate : accepts a PDF + topic, then triggers the AI debate pipeline.
 * -----------------------------------------------------------------------------
 */

import express from 'express';
import multer from 'multer';
import { handleDebateUpload } from '../controllers/documentCtrl.js';

// Create isolated router so server.js can mount all API routes under /api.
const router = express.Router();

/**
 * Multer in-memory storage configuration.
 *
 * Why memoryStorage here?
 * - We immediately parse PDF bytes in backend/services/ai/rag.js.
 * - No temporary file write is needed for this initial architecture step.
 *
 * Security controls:
 * - limits.fileSize: reject uploads larger than 10 MB to prevent DoS via large files.
 * - fileFilter: only accept PDF files based on MIME type to prevent malicious uploads.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted.'));
    }
  },
});

/**
 * POST /debate
 *
 * Middleware order:
 * 1) upload.single('document') parses multipart/form-data and exposes req.file.
 * 2) handleDebateUpload controller executes AI pipeline and returns transcript.
 */
router.post('/debate', (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      // Handle multer-specific errors (file too large, wrong type)
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum allowed size is 10 MB.'
        : err.message || 'File upload error.';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}, handleDebateUpload);

export default router;