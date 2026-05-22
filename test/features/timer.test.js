'use strict';

// Mock timerdb so timer.js can be tested without SQLite
jest.mock('../../lib/timerdb', () => ({
    TimerDB: jest.fn().mockImplementation(() => ({
        schedule: jest.fn((date, channel, sender, message, callback) => {
            callback(null, date);
        }),
    })),
}));

const { TimerDB } = require('../../lib/timerdb');

describe('timer feature', () => {
    let timer;
    let mockClient;
    let scheduleStub;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();

        // Re-mock after resetModules
        jest.doMock('../../lib/timerdb', () => {
            scheduleStub = jest.fn((date, channel, sender, message, callback) => {
                callback(null, date);
            });
            return {
                TimerDB: jest.fn().mockImplementation(() => ({
                    schedule: scheduleStub,
                })),
            };
        });

        timer = require('../../features/timer').commands['!timer'];
        mockClient = { say: jest.fn() };
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.resetModules();
    });

    test('shows help string when called with no arguments', () => {
        timer(mockClient, '#test', 'user', '!timer');
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Supported formats'));
    });

    test('shows help string when called with only whitespace', () => {
        timer(mockClient, '#test', 'user', '!timer  ');
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Supported formats'));
    });

    test('shows help for invalid (non-date, non-duration) format', () => {
        timer(mockClient, '#test', 'user', '!timer abc');
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Supported formats'));
    });

    test('shows help for bare number without unit', () => {
        timer(mockClient, '#test', 'user', '!timer 30');
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Supported formats'));
    });

    test('refuses a timer in the past', () => {
        // A date in the past: 01.01.2000 would be in the past
        timer(mockClient, '#test', 'user', '!timer 01.01.2000');
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('past'));
    });

    test('schedules a short timer (30s) using setTimeout', () => {
        const saySpy = mockClient.say;
        timer(mockClient, '#test', 'user', '!timer 30s Timer up!');
        // Should confirm the timer was set
        expect(saySpy).toHaveBeenCalledWith('#test', expect.stringContaining('Timer set to'));
        // Advance time by 31 seconds — the message should fire
        jest.advanceTimersByTime(31 * 1000);
        // The reminder message should have been sent
        const allCalls = saySpy.mock.calls.map(c => c[1]);
        expect(allCalls.some(m => m.includes('left by user'))).toBe(true);
    });

    test('stores a long timer (5m) in timerdb', () => {
        timer(mockClient, '#test', 'user', '!timer 5m Remind me');
        expect(scheduleStub).toHaveBeenCalledTimes(1);
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Timer set to'));
    });

    test('stores a 2-hour timer in timerdb', () => {
        timer(mockClient, '#test', 'user', '!timer 2h Long wait');
        expect(scheduleStub).toHaveBeenCalledTimes(1);
        expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Timer set to'));
    });
});
