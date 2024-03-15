// use secrets
import {corsHeaders, Env, getHeaders} from "./handler";

export async function handleAuth(request: Request, env: Env): Promise<Response> {
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
      `https://github.com/login/oauth/authorize?client_id=${env.CLIENT_ID}`,
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
        body: JSON.stringify({"client_id": env.CLIENT_ID, "client_secret": env.CLIENT_SECRET, "code": code }),
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
