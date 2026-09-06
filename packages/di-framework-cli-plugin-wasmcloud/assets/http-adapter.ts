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
  const bytes = new Uint8Array(await response.arrayBuffer());
  const encoder = new TextEncoder();
  const fields = Fields.fromList(
    [...response.headers.entries()].map(([name, value]) => [name, encoder.encode(value)]),
  );
  const outgoing = new OutgoingResponse(fields);
  outgoing.setStatusCode(response.status);
  const body = outgoing.body();
  // Hand the response to the host before writing: the host only starts draining
  // the body stream once the outparam is set, so writing the body first
  // deadlocks on payloads larger than the host's stream buffer.
  ResponseOutparam.set(outparam, { tag: 'ok', val: outgoing });
  const output = body.write();

  try {
    // wasi:io permits at most check-write bytes per write (a larger chunk traps
    // the component), so stream the body with the canonical subscribe/poll loop.
    const pollable = output.subscribe();
    try {
      let offset = 0;
      while (offset < bytes.length) {
        pollable.block();
        const permit = Number(output.checkWrite());
        if (permit === 0) continue;
        const end = Math.min(offset + permit, bytes.length);
        output.write(bytes.subarray(offset, end));
        offset = end;
      }
      output.blockingFlush();
    } finally {
      pollable[Symbol.dispose]();
    }
  } finally {
    output[Symbol.dispose]();
  }

  OutgoingBody.finish(body, undefined);
}

export const incomingHandler = {
  async handle(incoming: any, outparam: any): Promise<void> {
    let response: Response;
    try {
      response = await dispatch(await toWebRequest(incoming));
    } catch (error) {
      // Only a response computed before the outparam is set can be replaced;
      // failures while streaming the body have no recovery channel.
      console.error('Unhandled DI Framework request error', error);
      response = new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    await writeResponse(response, outparam);
  },
};
