import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { chatService } from '../services/chat-service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

router.use(authMiddleware);

interface AuthRequest extends Request {
  userId?: string;
}

router.get('/conversations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const conversations = await chatService.getConversations(userId);
    res.json({ conversations });
  } catch (error) {
    console.error('[ChatRoutes] Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

router.get('/conversations/archived', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const conversations = await chatService.getArchivedConversations(userId);
    res.json({ conversations });
  } catch (error) {
    console.error('[ChatRoutes] Error getting archived conversations:', error);
    res.status(500).json({ error: 'Failed to get archived conversations' });
  }
});

router.get('/messages/:partnerId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const partnerId = String(req.params.partnerId);
    const { limit, before } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const messages = await chatService.getMessages(
      userId,
      partnerId,
      limit ? parseInt(limit as string, 10) : 50,
      before as string | undefined
    );
    res.json({ messages });
  } catch (error) {
    console.error('[ChatRoutes] Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.post('/messages/:partnerId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const partnerId = String(req.params.partnerId);
    const { message } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const result = await chatService.sendMessage(userId, partnerId, message.trim());
    res.json({ message: result });
  } catch (error) {
    console.error('[ChatRoutes] Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post(
  '/messages/:partnerId/attachment',
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const partnerId = String(req.params.partnerId);
      const file = req.file;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const validation = chatService.validateAttachment(file as unknown as Express.Multer.File);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const message = req.body.message || '';

      const result = await chatService.sendMessage(userId, partnerId, message, {
        file: file.buffer,
        file_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size
      });

      res.json({ message: result });
    } catch (error) {
      console.error('[ChatRoutes] Error uploading attachment:', error);
      res.status(500).json({ error: 'Failed to upload attachment' });
    }
  }
);

router.patch('/messages/:messageId/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const messageId = String(req.params.messageId);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await chatService.markAsRead(userId, messageId);
    res.json({ success: true });
  } catch (error) {
    console.error('[ChatRoutes] Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

router.delete('/messages/:messageId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const messageId = String(req.params.messageId);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await chatService.deleteMessage(messageId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('[ChatRoutes] Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

router.post('/conversations/:partnerId/archive', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const partnerId = String(req.params.partnerId);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await chatService.archiveConversation(userId, partnerId);
    res.json({ success: true });
  } catch (error) {
    console.error('[ChatRoutes] Error archiving conversation:', error);
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
});

router.delete('/conversations/:partnerId/archive', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const partnerId = String(req.params.partnerId);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await chatService.unarchiveConversation(userId, partnerId);
    res.json({ success: true });
  } catch (error) {
    console.error('[ChatRoutes] Error unarchiving conversation:', error);
    res.status(500).json({ error: 'Failed to unarchive conversation' });
  }
});

router.get('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { q } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!q || !(q as string).trim()) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const messages = await chatService.searchMessages(userId, q as string);
    res.json({ messages });
  } catch (error) {
    console.error('[ChatRoutes] Error searching messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

router.get('/unread-count', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const count = await chatService.getTotalUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    console.error('[ChatRoutes] Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.post('/presence', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { isOnline } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await chatService.updatePresence(userId, isOnline);
    res.json({ success: true });
  } catch (error) {
    console.error('[ChatRoutes] Error updating presence:', error);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

export default router;