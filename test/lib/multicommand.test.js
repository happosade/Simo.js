'use strict';

// request is used both as a callable (urltitle) and as request.post (multicommand)
const mockRequestFn = jest.fn();
mockRequestFn.post = jest.fn();
jest.mock('request', () => mockRequestFn);

const request = require('request');
const { MultiCommand } = require('../../lib/multicommand');

// Helper: wrap mc.exec in a Promise for cleaner async tests
function execPromise(mc, to, from, message) {
    return new Promise((resolve) => {
        mc.exec(to, from, message, resolve);
    });
}

describe('MultiCommand', () => {
    let mockClient;

    beforeEach(() => {
        request.mockReset();
        request.post.mockReset();
    });

    describe('basic command dispatch', () => {
        test('executes a single command and returns its output', (done) => {
            const commands = {
                '!hello': [(client, channel, from, msg) => {
                    client.say(channel, 'Hello, world!');
                }],
            };
            const mc = new MultiCommand(commands, 10);
            mc.exec('#chan', 'user', '!hello', (result) => {
                expect(result).toBe('Hello, world!');
                done();
            });
        });

        test('passes channel, from, and full message to the command handler', (done) => {
            const handler = jest.fn((client, channel, from, msg) => {
                client.say(channel, `${channel}:${from}:${msg}`);
            });
            const commands = { '!echo': [handler] };
            const mc = new MultiCommand(commands, 10);
            mc.exec('#mychan', 'myuser', '!echo some args', (result) => {
                expect(handler).toHaveBeenCalledWith(
                    expect.any(Object),
                    '#mychan',
                    'myuser',
                    '!echo some args'
                );
                done();
            });
        });

        test('calls all handlers when a command has multiple registrations', async () => {
            const handler1 = jest.fn((client, channel, from, msg) => {
                client.say(channel, 'response1');
            });
            const handler2 = jest.fn();
            const commands = { '!multi': [handler1, handler2] };
            const mc = new MultiCommand(commands, 10);

            // async.whilst in v1.x calls the iteratee callback synchronously.
            // handler1 fires the exec callback (via myClient.say → callback → finalCb),
            // but handler2 is still called synchronously by forEach AFTER that.
            // Using await ensures we're past the synchronous flush of the event loop,
            // so both handlers have been called by the time we assert.
            await execPromise(mc, '#chan', 'user', '!multi');

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        test('returns undefined result (via empty callback) for non-command messages', (done) => {
            const commands = { '!hello': [(c, ch, f, m) => c.say(ch, 'hi')] };
            const mc = new MultiCommand(commands, 10);
            mc.exec('#chan', 'user', 'this is not a command', (result) => {
                // Non-command messages: msgArr.length > 1 → callback() called with no arg
                expect(result).toBeUndefined();
                done();
            });
        });
    });

    describe('python fallback', () => {
        test('falls back to pythonsimo HTTP request for unknown commands', (done) => {
            request.post.mockImplementation((opts, cb) => {
                cb(null, { statusCode: 200 }, 'python result');
            });
            const commands = {};
            const mc = new MultiCommand(commands, 10);
            mc.exec('#chan', 'user', '!unknowncmd arg', (result) => {
                expect(request.post).toHaveBeenCalledTimes(1);
                const callOpts = request.post.mock.calls[0][0];
                expect(callOpts.url).toBe('http://pythonsimo:8888');
                done();
            });
        });

        test('handles python fallback returning empty body gracefully', () => {
            // When body is empty, multicommand doesn't call myClient.say,
            // so the exec callback never fires. Just verify no exception is thrown.
            request.post.mockImplementation((opts, cb) => {
                cb(null, { statusCode: 200 }, '');
            });
            const commands = {};
            const mc = new MultiCommand(commands, 10);
            expect(() => mc.exec('#chan', 'user', '!unknowncmd', () => {})).not.toThrow();
            expect(request.post).toHaveBeenCalledTimes(1);
        });

        test('handles python fallback network error gracefully', () => {
            // On network error, multicommand logs and returns without calling myClient.say,
            // so the exec callback never fires. Just verify no exception is thrown.
            request.post.mockImplementation((opts, cb) => {
                const err = new Error('ECONNREFUSED');
                err.code = 'ECONNREFUSED';
                cb(err, null, null);
            });
            const commands = {};
            const mc = new MultiCommand(commands, 10);
            expect(() => mc.exec('#chan', 'user', '!unknowncmd', () => {})).not.toThrow();
            expect(request.post).toHaveBeenCalledTimes(1);
        });
    });

    describe('depth limit', () => {
        test('stops executing when maxDepth is reached', (done) => {
            let callCount = 0;
            const commands = {
                '!loop': [(client, channel, from, msg) => {
                    callCount++;
                    // Always return another command → infinite loop without depth limit
                    client.say(channel, '!loop');
                }],
            };
            const mc = new MultiCommand(commands, 5);
            mc.exec('#chan', 'user', '!loop', () => {
                expect(callCount).toBeLessThanOrEqual(6); // maxDepth=5 plus initial
                done();
            });
        });
    });
});
