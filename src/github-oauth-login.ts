/*
This file is licensed separately from the project it is used in. The following is the license for this file:

ISC License (ISC)

Copyright 2019 Gregor Martynus

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted,
provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER
IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
 */
import {corsHeaders, Env, getHeaders, isRefererLocalhost} from "./handler";

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  // use CLIENT_ID_DEV if we're calling from localhost
  let client_id = isRefererLocalhost(request) ? env.CLIENT_ID_DEV : env.CLIENT_ID;
  let client_secret = isRefererLocalhost(request) ? env.CLIENT_SECRET_DEV : env.CLIENT_SECRET;

  // handle CORS pre-flight request
  if (request.method === "OPTIONS") {
    return new Response(null, {
        status: 204,
        ...corsHeaders
    });
  }

  // redirect GET requests to the OAuth login page on github.com
  if (request.method === "GET") {
    return Response.redirect(
      `https://github.com/login/oauth/authorize?client_id=${client_id}`,
      302,
    );
  }

  try {
    let code;
    try {
      ({ code } = await request.json());
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return new Response("Invalid JSON in request body", {
        status: 400,
        headers: getHeaders(request),
      });
    }

    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "cloudflare-worker-ai-tutor-login",
          accept: "application/json",
        },
        body: JSON.stringify({"client_id": client_id, "client_secret": client_secret, "code": code }),
      }
    );
    const result : {
        error?: string,
        access_token?: string
    } = await response.json();

    if (result.error) {
      return new Response(JSON.stringify(result), { status: 401, headers: getHeaders(request),
      });
    }

    return new Response(JSON.stringify({ token: result.access_token }), {
      status: 201,
      headers: getHeaders(request),
    });
  } catch (error) {
    console.error(error);
    return new Response(error.message, {
      status: 500,
      headers: getHeaders(request),
    });
  }
}
