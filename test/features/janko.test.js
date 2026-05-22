'use strict';

const jankoFeature = require('../../features/janko');
const janko = jankoFeature.commands['!jankko'];

describe('!jankko', () => {
    let mockClient;

    beforeEach(() => {
        mockClient = { say: jest.fn() };
    });

    test('greets the sender when no nick is specified', () => {
        janko(mockClient, '#test', 'testuser', '!jankko');
        expect(mockClient.say).toHaveBeenCalledWith('#test', 'Hei testuser! HAISTA PASKA!');
    });

    test('greets the specified nick when given', () => {
        janko(mockClient, '#test', 'testuser', '!jankko SomeNick');
        expect(mockClient.say).toHaveBeenCalledWith('#test', 'Hei SomeNick! HAISTA PASKA!');
    });

    test('sends message to the correct channel', () => {
        janko(mockClient, '#channel2', 'user', '!jankko');
        expect(mockClient.say.mock.calls[0][0]).toBe('#channel2');
    });

    test('calls say exactly once', () => {
        janko(mockClient, '#test', 'user', '!jankko');
        expect(mockClient.say).toHaveBeenCalledTimes(1);
    });
});
