'use strict';

// rockPaperScissors.js uses module-level mutable state.
// Reset modules before each test group to ensure isolation.

describe('rockPaperScissors feature', () => {
    let play, rock, paper, scissors;
    let mockClient;

    beforeEach(() => {
        jest.resetModules();
        const rpsFeature = require('../../features/rockPaperScissors');
        play = rpsFeature.commands['!rps'];
        rock = rpsFeature.commands['!rock'];
        paper = rpsFeature.commands['!paper'];
        scissors = rpsFeature.commands['!scissors'];
        mockClient = { say: jest.fn() };
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('solo mode (no game in progress)', () => {
        test('!rock vs Simo: result is announced', () => {
            // Override Math.random so Simo always picks a known choice
            jest.spyOn(Math, 'random').mockReturnValue(0); // floor(0*3) = 0 = rock → tie
            rock(mockClient, '#test', 'player1', '!rock');
            expect(mockClient.say).toHaveBeenCalledTimes(1);
            expect(mockClient.say.mock.calls[0][1]).toMatch(/rock.*tie|tie.*rock/i);
        });

        test('!rock beats scissors (Simo picks scissors)', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.99); // floor(0.99*3) = 2 = scissors
            rock(mockClient, '#test', 'player1', '!rock');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('player1'));
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('wins'));
        });

        test('!paper loses to scissors (Simo picks scissors)', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.99); // floor(0.99*3) = 2 = scissors
            paper(mockClient, '#test', 'player1', '!paper');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Simo'));
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('wins'));
        });

        test('!scissors beats paper (Simo picks paper)', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.45); // floor(0.45*3) = 1 = paper
            scissors(mockClient, '#test', 'player1', '!scissors');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('player1'));
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('wins'));
        });

        test('tie is announced when both choose same', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0); // Simo picks rock (0)
            rock(mockClient, '#test', 'player1', '!rock');
            const msg = mockClient.say.mock.calls[0][1];
            expect(msg).toMatch(/tie/i);
        });
    });

    describe('two-player game flow', () => {
        test('!rps with no opponent shows usage hint', () => {
            play(mockClient, '#test', 'player1', '!rps');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('!rock'));
        });

        test('!rps starts a game and challenges the named opponent', () => {
            play(mockClient, '#test', 'player1', '!rps player2');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('player2'));
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('player1'));
        });

        test('blocks starting a new game when one is already in progress', () => {
            play(mockClient, '#test', 'player1', '!rps player2');
            mockClient.say.mockClear();
            play(mockClient, '#test', 'player3', '!rps player4');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('Wait'));
        });

        test('player1 wins when rock beats scissors', () => {
            play(mockClient, '#test', 'player1', '!rps player2');
            rock(mockClient, '#test', 'player1', '!rock');
            scissors(mockClient, '#test', 'player2', '!scissors');
            jest.runAllTimers(); // trigger the 10-second end timer
            const calls = mockClient.say.mock.calls.map(c => c[1]);
            const resultMsg = calls.find(m => m && m.includes('wins'));
            expect(resultMsg).toBeTruthy();
            expect(resultMsg).toMatch(/player1/);
        });

        test('player2 wins when paper beats rock', () => {
            play(mockClient, '#test', 'player1', '!rps player2');
            rock(mockClient, '#test', 'player1', '!rock');
            paper(mockClient, '#test', 'player2', '!paper');
            jest.runAllTimers();
            const calls = mockClient.say.mock.calls.map(c => c[1]);
            const resultMsg = calls.find(m => m && m.includes('wins'));
            expect(resultMsg).toBeTruthy();
            expect(resultMsg).toMatch(/player2/);
        });

        test('tie is announced when both pick rock', () => {
            play(mockClient, '#test', 'player1', '!rps player2');
            rock(mockClient, '#test', 'player1', '!rock');
            rock(mockClient, '#test', 'player2', '!rock');
            jest.runAllTimers();
            const calls = mockClient.say.mock.calls.map(c => c[1]);
            const resultMsg = calls.find(m => m && m.includes('tie'));
            expect(resultMsg).toBeTruthy();
        });

        test('player1 loses if they fail to pick in time', () => {
            play(mockClient, '#test', 'player1', '!rps player2');
            // player1 does NOT pick; player2 picks paper
            paper(mockClient, '#test', 'player2', '!paper');
            jest.runAllTimers(); // 10-second timeout fires
            const calls = mockClient.say.mock.calls.map(c => c[1]);
            const failMsg = calls.find(m => m && m.includes('failed'));
            expect(failMsg).toBeTruthy();
            expect(failMsg).toMatch(/player1/);
        });

        test('third-party player choice is ignored', () => {
            play(mockClient, '#test', 'player1', '!rps player2');
            // A third player tries to inject a choice
            const sayCount = mockClient.say.mock.calls.length;
            rock(mockClient, '#test', 'spectator', '!rock');
            // No new message should be sent (spectator is not part of the game)
            expect(mockClient.say).toHaveBeenCalledTimes(sayCount);
        });
    });
});
