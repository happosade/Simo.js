'use strict';

const randomFeature = require('../../features/random');
const random = randomFeature.commands['!random'];
const coinflip = randomFeature.commands['!coinflip'];

describe('!random', () => {
    let mockClient;

    beforeEach(() => {
        mockClient = { say: jest.fn() };
    });

    test('returns a number between 0 and 100 with no args', () => {
        random(mockClient, '#test', 'user', '!random');
        expect(mockClient.say).toHaveBeenCalledTimes(1);
        const result = parseInt(mockClient.say.mock.calls[0][1]);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
    });

    test('returns a number between 0 and N with single numeric arg', () => {
        random(mockClient, '#test', 'user', '!random 50');
        const result = parseInt(mockClient.say.mock.calls[0][1]);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(50);
    });

    test('returns a number between X and Y with two numeric args', () => {
        random(mockClient, '#test', 'user', '!random 10 20');
        const result = parseInt(mockClient.say.mock.calls[0][1]);
        expect(result).toBeGreaterThanOrEqual(10);
        expect(result).toBeLessThanOrEqual(20);
    });

    test('handles reversed range (higher number first)', () => {
        random(mockClient, '#test', 'user', '!random 20 10');
        const result = parseInt(mockClient.say.mock.calls[0][1]);
        expect(result).toBeGreaterThanOrEqual(10);
        expect(result).toBeLessThanOrEqual(20);
    });

    test('shows help message when a non-numeric arg is given', () => {
        random(mockClient, '#test', 'user', '!random abc');
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Supported formats'));
    });

    test('parses dash-separated range', () => {
        random(mockClient, '#test', 'user', '!random 5-10');
        const result = parseInt(mockClient.say.mock.calls[0][1]);
        expect(result).toBeGreaterThanOrEqual(5);
        expect(result).toBeLessThanOrEqual(10);
    });

    test('parses comma-separated range', () => {
        random(mockClient, '#test', 'user', '!random 3, 7');
        const result = parseInt(mockClient.say.mock.calls[0][1]);
        expect(result).toBeGreaterThanOrEqual(3);
        expect(result).toBeLessThanOrEqual(7);
    });

    test('returns deterministic result when Math.random is mocked to 0', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        random(mockClient, '#test', 'user', '!random 10 20');
        // floor(0 * (20-10+1) + 10) = floor(10) = 10
        expect(mockClient.say).toHaveBeenCalledWith('#test', '10');
    });

    test('returns deterministic result when Math.random is mocked to just-under-1', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.9999);
        random(mockClient, '#test', 'user', '!random 10 20');
        // floor(0.9999 * 11 + 10) = floor(20.9989) = 20
        expect(mockClient.say).toHaveBeenCalledWith('#test', '20');
    });
});

describe('!coinflip', () => {
    let mockClient;

    beforeEach(() => {
        mockClient = { say: jest.fn() };
    });

    test('returns either Heads or Tails', () => {
        coinflip(mockClient, '#test', 'user', '!coinflip');
        const result = mockClient.say.mock.calls[0][1];
        expect(['Heads', 'Tails']).toContain(result);
    });

    test('returns Heads when Math.random returns 0', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        coinflip(mockClient, '#test', 'user', '!coinflip');
        // floor(0 * 2) === 0 → "Heads"
        expect(mockClient.say).toHaveBeenCalledWith('#test', 'Heads');
    });

    test('returns Tails when Math.random returns 0.9', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.9);
        coinflip(mockClient, '#test', 'user', '!coinflip');
        // floor(0.9 * 2) = floor(1.8) = 1 → "Tails"
        expect(mockClient.say).toHaveBeenCalledWith('#test', 'Tails');
    });

    test('calls say exactly once', () => {
        coinflip(mockClient, '#test', 'user', '!coinflip');
        expect(mockClient.say).toHaveBeenCalledTimes(1);
    });
});
