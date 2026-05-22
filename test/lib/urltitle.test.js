'use strict';

// Mock the 'request' module used by urltitle
jest.mock('request', () => jest.fn());

const request = require('request');
const { UrlTitle } = require('../../lib/urltitle');

describe('UrlTitle.getTitle', () => {
    let urlTitle;

    beforeEach(() => {
        urlTitle = new UrlTitle();
        request.mockReset();
    });

    test('does nothing when the message contains no URL', () => {
        const callback = jest.fn();
        urlTitle.getTitle('hello world no url here', callback);
        expect(callback).not.toHaveBeenCalled();
        expect(request).not.toHaveBeenCalled();
    });

    test('extracts and returns the page title from an HTTP URL', () => {
        request.mockImplementation((opts, cb) => {
            cb(null, { statusCode: 200 }, '<html><head><title>Test Page Title</title></head></html>');
        });
        const callback = jest.fn();
        urlTitle.getTitle('check out https://example.com for more', callback);
        expect(request).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('Test Page Title');
    });

    test('trims whitespace from the title', () => {
        request.mockImplementation((opts, cb) => {
            cb(null, { statusCode: 200 }, '<html><head><title>  Padded Title  </title></head></html>');
        });
        const callback = jest.fn();
        urlTitle.getTitle('https://example.com', callback);
        expect(callback).toHaveBeenCalledWith('Padded Title');
    });

    test('truncates titles longer than 500 characters', () => {
        const longTitle = 'A'.repeat(600);
        request.mockImplementation((opts, cb) => {
            cb(null, { statusCode: 200 }, `<html><head><title>${longTitle}</title></head></html>`);
        });
        const callback = jest.fn();
        urlTitle.getTitle('https://example.com', callback);
        const result = callback.mock.calls[0][0];
        expect(result.length).toBeLessThanOrEqual(503); // 500 chars + '...'
        expect(result).toMatch(/\.\.\.$/);
    });

    test('replaces newlines in title with " \\ "', () => {
        request.mockImplementation((opts, cb) => {
            cb(null, { statusCode: 200 }, '<html><head><title>Line1\nLine2</title></head></html>');
        });
        const callback = jest.fn();
        urlTitle.getTitle('https://example.com', callback);
        expect(callback).toHaveBeenCalledWith(expect.stringContaining('\\'));
    });

    test('does not invoke callback when request returns an error', () => {
        request.mockImplementation((opts, cb) => {
            cb(new Error('Network error'), null, null);
        });
        const callback = jest.fn();
        urlTitle.getTitle('https://example.com', callback);
        expect(callback).not.toHaveBeenCalled();
    });

    test('does not invoke callback when page has no title element', () => {
        request.mockImplementation((opts, cb) => {
            cb(null, { statusCode: 200 }, '<html><body>No title here</body></html>');
        });
        const callback = jest.fn();
        urlTitle.getTitle('https://example.com', callback);
        expect(callback).not.toHaveBeenCalled();
    });

    test('strips imgur image extension from URL before requesting', () => {
        request.mockImplementation((opts, cb) => {
            cb(null, { statusCode: 200 }, '<html><head><title>Imgur Gallery</title></head></html>');
        });
        const callback = jest.fn();
        urlTitle.getTitle('https://imgur.com/gallery/abc123.jpg', callback);
        // The URL passed to request should have .jpg stripped
        const requestedUrl = request.mock.calls[0][0].url;
        expect(requestedUrl).not.toMatch(/\.jpg$/);
    });
});
