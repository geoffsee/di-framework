import application from 'virtual:di-framework-application';
import {
  Fields,
  IncomingBody,
  OutgoingBody,
  OutgoingResponse,
  ResponseOutparam,
} from 'wasi:http/types@0.2.12';

type Application =
  | ((request: Request) => Response | Promise<Response>)
  | { fetch(request: Request): Response | Promise<Response> };

function methodName(method: { tag: string; val?: string }): string {
  return method.tag === 'other' ? (method.val ?? 'GET') : method.tag.toUpperCase();
}

async function toWebRequest(incoming: any): Promise<Request> {
  const method = methodName(incoming.method());
  const schemeValue = incoming.scheme();
  const scheme = schemeValue?.tag === 'HTTPS' ? 'https' : 'http';
  const authority = incoming.authority() ?? 'localhost';
  const path = incoming.pathWithQuery() ?? '/';
  const decoder = new TextDecoder();
  const headers = new Headers();

  for (const [name, value] of incoming.headers().entries()) {
    headers.append(name, decoder.decode(value));
  }

  if (method === 'GET' || method === 'HEAD') {
    return new Request(`${scheme}://${authority}${path}`, { method, headers });
  }

  const incomingBody = incoming.consume();
  const input = incomingBody.stream();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      try {
        const chunk = input.blockingRead(64n * 1024n);
        if (chunk.length === 0) break;
        chunks.push(chunk);
      } catch (error) {
        const payload = (error as { payload?: { tag?: string } })?.payload;
        if (payload?.tag === 'closed') break;
        throw error;
      }
    }
  } finally {
    input[Symbol.dispose]();
    IncomingBody.finish(incomingBody);
  }

  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  return new Request(`${scheme}://${authority}${path}`, {
    method,
    headers,
    body,
  });
}

async function dispatch(request: Request): Promise<Response> {
  const handler = application as Application;
  const response =
    typeof handler === 'function' ? await handler(request) : await handler.fetch(request);

  if (!(response instanceof Response)) {
    throw new TypeError('The default application export must return a Web Response object');
  }

  return response;
}

async function writeResponse(response: Response, outparam: any): Promise<void> {
  const encoder = new TextEncoder();
  const fields = Fields.fromList(
    [...response.headers.entries()].map(([name, value]) => [name, encoder.encode(value)]),
  );
  const outgoing = new OutgoingResponse(fields);
  outgoing.setStatusCode(response.status);
  const body = outgoing.body();
  const output = body.write();

  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    output.blockingWriteAndFlush(bytes);
  } finally {
    output[Symbol.dispose]();
  }

  OutgoingBody.finish(body, undefined);
  ResponseOutparam.set(outparam, { tag: 'ok', val: outgoing });
}

export const incomingHandler = {
  async handle(incoming: any, outparam: any): Promise<void> {
    try {
      const request = await toWebRequest(incoming);
      await writeResponse(await dispatch(request), outparam);
    } catch (error) {
      console.error('Unhandled DI Framework request error', error);
      await writeResponse(
        new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
        outparam,
      );
    }
  },
};
