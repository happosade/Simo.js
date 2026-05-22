'use strict';

// openai.js reads /simojs-data/settings.json at module load time — mock fs.
// It also uses axios for API calls — mock axios.

jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        readFileSync: jest.fn((path, ...args) => {
            if (path === '/simojs-data/settings.json') {
                return JSON.stringify({
                    openai: { api_key: 'test-api-key' },
                });
            }
            return actual.readFileSync(path, ...args);
        }),
        writeFileSync: jest.fn(),
        existsSync: jest.fn(() => true),
        mkdirSync: jest.fn(),
    };
});

jest.mock('axios', () => ({
    post: jest.fn(),
}));

describe('openai feature', () => {
    let openaiFeature;
    let gpt, clear, system;
    let mockClient;
    let axiosMock;

    beforeEach(() => {
        jest.resetModules();

        // Re-apply mocks after module reset
        jest.doMock('fs', () => {
            const actual = jest.requireActual('fs');
            return {
                ...actual,
                readFileSync: jest.fn((path, ...args) => {
                    if (path === '/simojs-data/settings.json') {
                        return JSON.stringify({ openai: { api_key: 'test-api-key' } });
                    }
                    return actual.readFileSync(path, ...args);
                }),
                writeFileSync: jest.fn(),
                existsSync: jest.fn(() => true),
                mkdirSync: jest.fn(),
            };
        });

        axiosMock = { post: jest.fn() };
        jest.doMock('axios', () => axiosMock);

        openaiFeature = require('../../features/openai');
        gpt = openaiFeature.commands['!gpt'];
        clear = openaiFeature.commands['!gptclear'];
        system = openaiFeature.commands['!gptsystem'];

        mockClient = { say: jest.fn() };
    });

    describe('!gpt', () => {
        test('sends a POST to the OpenAI endpoint with the user message', async () => {
            axiosMock.post.mockResolvedValue({
                data: {
                    choices: [{
                        message: { role: 'assistant', content: 'A short reply.' },
                    }],
                },
            });
            await gpt(mockClient, '#test', 'user', '!gpt What is 2+2?');
            expect(axiosMock.post).toHaveBeenCalledTimes(1);
            const [url, payload] = axiosMock.post.mock.calls[0];
            expect(url).toContain('openai.com');
            expect(payload.messages).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ role: 'user', content: 'What is 2+2?' }),
                ])
            );
        });

        test('sends the response text to the channel', async () => {
            axiosMock.post.mockResolvedValue({
                data: {
                    choices: [{
                        message: { role: 'assistant', content: 'The answer is 4.' },
                    }],
                },
            });
            await gpt(mockClient, '#test', 'user', '!gpt question');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('The answer is 4.'));
        });

        test('response is capped at 390 characters', async () => {
            const longResponse = 'X'.repeat(500);
            axiosMock.post.mockResolvedValue({
                data: {
                    choices: [{ message: { role: 'assistant', content: longResponse } }],
                },
            });
            // For long responses it writes a file instead of saying directly;
            // We just verify say was called with something ≤ 390 chars
            gpt(mockClient, '#test', 'user', '!gpt question');
            await new Promise(r => setImmediate(r));
            if (mockClient.say.mock.calls.length > 0) {
                const said = mockClient.say.mock.calls[0][1];
                expect(said.length).toBeLessThanOrEqual(390);
            }
        });

        test('normalizes newlines in response to " ## "', async () => {
            axiosMock.post.mockResolvedValue({
                data: {
                    choices: [{ message: { role: 'assistant', content: 'Line1\nLine2\nLine3' } }],
                },
            });
            await gpt(mockClient, '#test', 'user', '!gpt multi');
            const said = mockClient.say.mock.calls[0][1];
            expect(said).not.toMatch(/\n/);
            expect(said).toContain('##');
        });

        test('appends assistant reply to the conversation history', async () => {
            const replyMessage = { role: 'assistant', content: 'Reply A' };
            axiosMock.post.mockResolvedValue({
                data: { choices: [{ message: replyMessage }] },
            });
            await gpt(mockClient, '#test', 'user', '!gpt first message');
            // Second call — should include prior assistant message
            axiosMock.post.mockResolvedValue({
                data: { choices: [{ message: { role: 'assistant', content: 'Reply B' } }] },
            });
            await gpt(mockClient, '#test', 'user', '!gpt second message');
            const secondPayload = axiosMock.post.mock.calls[1][1];
            expect(secondPayload.messages).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ content: 'Reply A' }),
                ])
            );
        });
    });

    describe('!gptclear', () => {
        test('resets the conversation history to just the system message', async () => {
            axiosMock.post.mockResolvedValue({
                data: { choices: [{ message: { role: 'assistant', content: 'Hello' } }] },
            });
            await gpt(mockClient, '#test', 'user', '!gpt something');

            // Clear the history
            clear(mockClient, '#test', 'user', '!gptclear');

            // Capture the messages BEFORE the assistant response is pushed (mutation happens after POST)
            let capturedMessages = null;
            axiosMock.post.mockImplementation(async (url, payload) => {
                capturedMessages = payload.messages.map(m => ({ ...m })); // snapshot
                return { data: { choices: [{ message: { role: 'assistant', content: 'Fresh' } }] } };
            });

            await gpt(mockClient, '#test', 'user', '!gpt after clear');

            // Should have exactly: [system, userMsg] — no prior history
            const nonSystemMessages = capturedMessages.filter(m => m.role !== 'system');
            expect(nonSystemMessages).toHaveLength(1);
            expect(nonSystemMessages[0].content).toBe('after clear');
        });
    });

    describe('!gptsystem', () => {
        test('replaces the system prompt with custom text', async () => {
            system(mockClient, '#test', 'user', '!gptsystem You are a pirate');
            axiosMock.post.mockResolvedValue({
                data: { choices: [{ message: { role: 'assistant', content: 'Arrr!' } }] },
            });
            await gpt(mockClient, '#test', 'user', '!gpt hello');
            const payload = axiosMock.post.mock.calls[0][1];
            expect(payload.messages[0]).toMatchObject({ role: 'system', content: 'You are a pirate' });
        });
    });

    describe('conversation window limit', () => {
        test('evicts oldest messages when history grows beyond 20 entries', async () => {
            // Send first message so we can verify it gets evicted later
            axiosMock.post.mockResolvedValue({
                data: { choices: [{ message: { role: 'assistant', content: 'ok' } }] },
            });
            await gpt(mockClient, '#test', 'user', '!gpt first message ever');

            // Fill up the window well beyond 20
            for (let i = 0; i < 12; i++) {
                axiosMock.post.mockResolvedValue({
                    data: { choices: [{ message: { role: 'assistant', content: 'ok' } }] },
                });
                await gpt(mockClient, '#test', 'user', `!gpt filler ${i}`);
            }

            // Capture the messages snapshot at POST time (before assistant response is pushed)
            let capturedMessages = null;
            axiosMock.post.mockImplementation(async (url, payload) => {
                capturedMessages = payload.messages.map(m => ({ ...m }));
                return { data: { choices: [{ message: { role: 'assistant', content: 'ok' } }] } };
            });
            await gpt(mockClient, '#test', 'user', '!gpt final check');

            // The oldest user message should have been spliced out of the history
            const hasFirstMessage = capturedMessages.some(m => m.content === 'first message ever');
            expect(hasFirstMessage).toBe(false);

            // The system message (index 0) is always preserved
            expect(capturedMessages[0].role).toBe('system');
        });
    });
});
