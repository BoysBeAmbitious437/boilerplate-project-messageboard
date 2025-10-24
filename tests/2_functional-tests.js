'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { suite, test } = require('mocha');

const server = require('../server');

chai.use(chaiHttp);
const assert = chai.assert;
const expect = chai.expect;

let testThreadId;
let testReplyId;
const testBoard = 'testboard';

suite('Functional Tests', function() {
  this.timeout(10000);

  // Test 1: Creating a new thread
  test('Creating a new thread: POST request to /api/threads/{board}', function(done) {
    chai
      .request(server)
      .post(`/api/threads/${testBoard}`)
      .send({
        text: 'This is a test thread',
        delete_password: 'threadpass123'
      })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, '_id');
        assert.property(res.body, 'text');
        assert.property(res.body, 'created_on');
        assert.property(res.body, 'bumped_on');
        assert.property(res.body, 'reported');
        assert.property(res.body, 'delete_password');
        assert.property(res.body, 'replies');
        assert.equal(res.body.text, 'This is a test thread');
        assert.equal(res.body.delete_password, 'threadpass123');
        assert.isArray(res.body.replies);
        assert.isBoolean(res.body.reported);
        assert.equal(res.body.reported, false);
        
        testThreadId = res.body._id; // Save for later tests
        done();
      });
  });

  // Test 2: Viewing the 10 most recent threads with 3 replies each
  test('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', function(done) {
    chai
      .request(server)
      .get(`/api/threads/${testBoard}`)
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        
        if (res.body.length > 0) {
          const thread = res.body[0];
          assert.property(thread, '_id');
          assert.property(thread, 'text');
          assert.property(thread, 'created_on');
          assert.property(thread, 'bumped_on');
          assert.property(thread, 'replycount');
          assert.property(thread, 'replies');
          assert.isArray(thread.replies);
          
          // Check that sensitive fields are not exposed
          assert.notProperty(thread, 'reported');
          assert.notProperty(thread, 'delete_password');
          
          // Check that replies array has max 3 items
          assert.isAtMost(thread.replies.length, 3);
          
          if (thread.replies.length > 0) {
            const reply = thread.replies[0];
            assert.notProperty(reply, 'reported');
            assert.notProperty(reply, 'delete_password');
          }
        }
        done();
      });
  });

  // Test 3: Deleting a thread with the incorrect password
  test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board}', function(done) {
    chai
      .request(server)
      .delete(`/api/threads/${testBoard}`)
      .send({
        thread_id: testThreadId,
        delete_password: 'wrongpassword'
      })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  // Test 4: Deleting a thread with the correct password
  test('Deleting a thread with the correct password: DELETE request to /api/threads/{board}', function(done) {
    // First create a thread to delete
    chai
      .request(server)
      .post(`/api/threads/${testBoard}`)
      .send({
        text: 'Thread to be deleted',
        delete_password: 'correctpass'
      })
      .end(function(err, res) {
        const threadToDeleteId = res.body._id;
        
        chai
          .request(server)
          .delete(`/api/threads/${testBoard}`)
          .send({
            thread_id: threadToDeleteId,
            delete_password: 'correctpass'
          })
          .end(function(err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'success');
            done();
          });
      });
  });

  // Test 5: Reporting a thread
  test('Reporting a thread: PUT request to /api/threads/{board}', function(done) {
    chai
      .request(server)
      .put(`/api/threads/${testBoard}`)
      .send({
        thread_id: testThreadId
      })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'reported');
        done();
      });
  });

  // Test 6: Creating a new reply
  test('Creating a new reply: POST request to /api/replies/{board}', function(done) {
    chai
      .request(server)
      .post(`/api/replies/${testBoard}`)
      .send({
        thread_id: testThreadId,
        text: 'This is a test reply',
        delete_password: 'replypass123'
      })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, '_id');
        assert.property(res.body, 'replies');
        assert.isArray(res.body.replies);
        
        // Find the newly created reply
        const newReply = res.body.replies[res.body.replies.length - 1];
        assert.property(newReply, '_id');
        assert.property(newReply, 'text');
        assert.property(newReply, 'created_on');
        assert.property(newReply, 'delete_password');
        assert.property(newReply, 'reported');
        assert.equal(newReply.text, 'This is a test reply');
        assert.equal(newReply.delete_password, 'replypass123');
        assert.equal(newReply.reported, false);
        
        testReplyId = newReply._id; // Save for later tests
        done();
      });
  });

  // Test 7: Viewing a single thread with all replies
  test('Viewing a single thread with all replies: GET request to /api/replies/{board}', function(done) {
    chai
      .request(server)
      .get(`/api/replies/${testBoard}`)
      .query({ thread_id: testThreadId })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, '_id');
        assert.property(res.body, 'text');
        assert.property(res.body, 'created_on');
        assert.property(res.body, 'bumped_on');
        assert.property(res.body, 'replies');
        assert.isArray(res.body.replies);
        
        // Check that sensitive fields are not exposed
        assert.notProperty(res.body, 'reported');
        assert.notProperty(res.body, 'delete_password');
        
        // Check replies
        if (res.body.replies.length > 0) {
          const reply = res.body.replies[0];
          assert.notProperty(reply, 'reported');
          assert.notProperty(reply, 'delete_password');
        }
        done();
      });
  });

  // Test 8: Deleting a reply with the incorrect password
  test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board}', function(done) {
    chai
      .request(server)
      .delete(`/api/replies/${testBoard}`)
      .send({
        thread_id: testThreadId,
        reply_id: testReplyId,
        delete_password: 'wrongpassword'
      })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  // Test 9: Deleting a reply with the correct password
  test('Deleting a reply with the correct password: DELETE request to /api/replies/{board}', function(done) {
    chai
      .request(server)
      .delete(`/api/replies/${testBoard}`)
      .send({
        thread_id: testThreadId,
        reply_id: testReplyId,
        delete_password: 'replypass123'
      })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'success');
        
        // Verify the reply text was changed to [deleted]
        chai
          .request(server)
          .get(`/api/replies/${testBoard}`)
          .query({ thread_id: testThreadId })
          .end(function(err, res) {
            const deletedReply = res.body.replies.find(reply => reply._id === testReplyId);
            assert.exists(deletedReply);
            assert.equal(deletedReply.text, '[deleted]');
            done();
          });
      });
  });

  // Test 10: Reporting a reply
  test('Reporting a reply: PUT request to /api/replies/{board}', function(done) {
    // First create a new reply to report
    chai
      .request(server)
      .post(`/api/replies/${testBoard}`)
      .send({
        thread_id: testThreadId,
        text: 'Reply to be reported',
        delete_password: 'reportpass'
      })
      .end(function(err, res) {
        const newReply = res.body.replies[res.body.replies.length - 1];
        const replyToReportId = newReply._id;
        
        chai
          .request(server)
          .put(`/api/replies/${testBoard}`)
          .send({
            thread_id: testThreadId,
            reply_id: replyToReportId
          })
          .end(function(err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'reported');
            done();
          });
      });
  });

  // Cleanup after tests
  after(function(done) {
    // Clean up test data
    const Thread = require('../models/Thread');
    Thread.deleteMany({ board: testBoard })
      .then(() => {
        console.log('Test data cleaned up');
        done();
      })
      .catch(err => {
        console.log('Error cleaning up test data:', err);
        done();
      });
  });
});