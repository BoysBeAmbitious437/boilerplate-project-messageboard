'use strict';
const Thread = require('../models/Thread');

module.exports = function (app) {

  // POST /api/threads/{board}
  app.route('/api/threads/:board')
    .post(async (req, res) => {
      try {
        const board = req.params.board;
        const { text, delete_password } = req.body;
        
        console.log('POST /api/threads/:board', { board, text, delete_password });
        
        if (!text || !delete_password) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // FIX: Use the same timestamp for created_on and bumped_on
        const now = new Date();
        
        const newThread = new Thread({
          board,
          text,
          delete_password,
          created_on: now,
          bumped_on: now, // SAME as created_on for new threads
          reported: false,
          replies: []
        });

        const saved = await newThread.save();
        console.log('Thread saved:', saved._id);
        
        // Verify created_on and bumped_on are equal
        console.log('Created_on:', saved.created_on);
        console.log('Bumped_on:', saved.bumped_on);
        console.log('Are they equal?', saved.created_on.getTime() === saved.bumped_on.getTime());
        
        res.json(saved);
      } catch (error) {
        console.error('Error creating thread:', error);
        res.status(500).json({ error: error.message });
      }
    })

    // GET /api/threads/{board}
    .get(async (req, res) => {
      try {
        const board = req.params.board;
        console.log('GET /api/threads/:board', board);
        
        const threads = await Thread.find({ board })
          .sort({ bumped_on: -1 })
          .limit(10)
          .select('-reported -delete_password -replies.reported -replies.delete_password')
          .lean();

        // Process to show only 3 most recent replies per thread
        const processedThreads = threads.map(thread => {
          // Sort replies by date (newest first) and take latest 3
          const sortedReplies = thread.replies
            .sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
            .slice(0, 3)
            .map(reply => ({
              _id: reply._id,
              text: reply.text,
              created_on: reply.created_on
            }));

          return {
            _id: thread._id,
            text: thread.text,
            created_on: thread.created_on,
            bumped_on: thread.bumped_on,
            replycount: thread.replies.length,
            replies: sortedReplies
          };
        });

        console.log(`Found ${processedThreads.length} threads for board: ${board}`);
        res.json(processedThreads);
      } catch (error) {
        console.error('Error getting threads:', error);
        res.status(500).json({ error: error.message });
      }
    })

    // DELETE /api/threads/{board}
    .delete(async (req, res) => {
      try {
        const { thread_id, delete_password } = req.body;
        console.log('DELETE /api/threads/:board', { thread_id, delete_password });
        
        const thread = await Thread.findById(thread_id);
        if (!thread) {
          return res.status(404).json({ error: 'Thread not found' });
        }

        if (thread.delete_password !== delete_password) {
          return res.send('incorrect password');
        }

        await Thread.findByIdAndDelete(thread_id);
        res.send('success');
      } catch (error) {
        console.error('Error deleting thread:', error);
        res.status(500).json({ error: error.message });
      }
    })

    // PUT /api/threads/{board} - Report thread
    .put(async (req, res) => {
      try {
        const { thread_id } = req.body;
        console.log('PUT /api/threads/:board - report', { thread_id });
        
        const result = await Thread.findByIdAndUpdate(
          thread_id, 
          { reported: true },
          { new: true }
        );
        
        if (!result) {
          return res.status(404).json({ error: 'Thread not found' });
        }
        
        res.send('reported');
      } catch (error) {
        console.error('Error reporting thread:', error);
        res.status(500).json({ error: error.message });
      }
    });

  // POST /api/replies/{board}
  app.route('/api/replies/:board')
    .post(async (req, res) => {
      try {
        const board = req.params.board;
        const { thread_id, text, delete_password } = req.body;
        
        console.log('POST /api/replies/:board', { board, thread_id, text, delete_password });
        
        if (!thread_id || !text || !delete_password) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const newReply = {
          text,
          delete_password,
          created_on: new Date(),
          reported: false
        };

        const updatedThread = await Thread.findByIdAndUpdate(
          thread_id,
          { 
            $push: { replies: newReply },
            bumped_on: new Date() // Update bumped_on when new reply is added
          },
          { new: true }
        );

        if (!updatedThread) {
          return res.status(404).json({ error: 'Thread not found' });
        }

        console.log('Reply added to thread:', thread_id);
        console.log('New bumped_on:', updatedThread.bumped_on);
        res.json(updatedThread);
      } catch (error) {
        console.error('Error creating reply:', error);
        res.status(500).json({ error: error.message });
      }
    })

    // GET /api/replies/{board}
    .get(async (req, res) => {
      try {
        const { thread_id } = req.query;
        console.log('GET /api/replies/:board', { thread_id });
        
        if (!thread_id) {
          return res.status(400).json({ error: 'thread_id is required' });
        }

        const thread = await Thread.findById(thread_id)
          .select('-reported -delete_password -replies.reported -replies.delete_password')
          .lean();

        if (!thread) {
          return res.status(404).json({ error: 'Thread not found' });
        }

        console.log('Found thread with', thread.replies.length, 'replies');
        res.json(thread);
      } catch (error) {
        console.error('Error getting thread:', error);
        res.status(500).json({ error: error.message });
      }
    })

    // DELETE /api/replies/{board}
    .delete(async (req, res) => {
      try {
        const { thread_id, reply_id, delete_password } = req.body;
        console.log('DELETE /api/replies/:board', { thread_id, reply_id, delete_password });
        
        if (!thread_id || !reply_id || !delete_password) {
          return res.status(400).json({ error: 'thread_id, reply_id and delete_password are required' });
        }

        const thread = await Thread.findById(thread_id);
        if (!thread) {
          return res.status(404).json({ error: 'Thread not found' });
        }

        const reply = thread.replies.id(reply_id);
        if (!reply) {
          return res.status(404).json({ error: 'Reply not found' });
        }

        if (reply.delete_password !== delete_password) {
          return res.send('incorrect password');
        }

        // Change text to '[deleted]' instead of deleting the reply
        reply.text = '[deleted]';
        await thread.save();

        console.log('Reply marked as deleted:', reply_id);
        res.send('success');
      } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({ error: error.message });
      }
    })

    // PUT /api/replies/{board} - Report reply
    .put(async (req, res) => {
      try {
        const { thread_id, reply_id } = req.body;
        console.log('PUT /api/replies/:board - report', { thread_id, reply_id });
        
        if (!thread_id || !reply_id) {
          return res.status(400).json({ error: 'thread_id and reply_id are required' });
        }

        const thread = await Thread.findById(thread_id);
        if (!thread) {
          return res.status(404).json({ error: 'Thread not found' });
        }

        const reply = thread.replies.id(reply_id);
        if (!reply) {
          return res.status(404).json({ error: 'Reply not found' });
        }

        reply.reported = true;
        await thread.save();

        console.log('Reply reported:', reply_id);
        res.send('reported');
      } catch (error) {
        console.error('Error reporting reply:', error);
        res.status(500).json({ error: error.message });
      }
    });

};