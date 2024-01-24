import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// This configures a request mocking server with the given request handlers.

export type Post = {
  id: number;
  title: string;
  body: string;
};

export const posts: Record<string, Post> = {
  1: { id: 1, title: 'hello', body: 'extra body!' },
};

export const server = setupServer(
  http.get('https://example.com/echo', ({ request }) => HttpResponse.json({ ...request, headers: request.headers })),
  http.post('https://example.com/echo', ({ request }) => HttpResponse.json({ ...request, headers: request.headers })),
  http.get('https://example.com/success', () => HttpResponse.json({ value: 'success' })),
  http.post('https://example.com/success', () => HttpResponse.json({ value: 'success' })),
  http.get('https://example.com/empty', () => HttpResponse.text('')),
  http.get('https://example.com/error', () => HttpResponse.json({ value: 'error' }, { status: 500 })),
  http.post('https://example.com/error', () => HttpResponse.json({ value: 'error' }, { status: 500 })),
  http.get('https://example.com/nonstandard-error', () =>
    HttpResponse.json({
      success: false,
      message: 'This returns a 200 but is really an error',
    })
  ),
  http.get('https://example.com/mirror', (req) => HttpResponse.json(req.params)),
  http.post('https://example.com/mirror', (req) => HttpResponse.json(req.params)),
  http.get('https://example.com/posts/random', () => {
    // just simulate an api that returned a random ID
    const { id } = posts[1];
    return HttpResponse.json({ id });
  }),
  http.get('https://example.com/post/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json(posts[id as string]);
  })
);
