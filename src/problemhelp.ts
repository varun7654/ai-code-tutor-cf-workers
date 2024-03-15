import {Env, getHeaders} from "./handler";

export async function handleProblemHelp(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('token ') || authHeader.split(' ').length !== 2) {
        return new Response(
            JSON.stringify({status: 401, statusText: 'Unauthorized', expire_logins: false}),
            {status: 401, headers: getHeaders(request)}
        );
    }

    const token = authHeader.split(' ')[1];
    const response = await fetch('https://api.github.com/user', {
        headers: {
            "user-agent": "cloudflare-worker-ai-tutor-auth-check",
            'Authorization': `token ${token}`
        }
    });

    if (!response.ok) {
        return new Response(
            JSON.stringify({
                status: 401,
                statusText: 'Unauthorized',
                expire_logins: true,
                error: await response.text()
            }),
            {status: 401, headers: getHeaders(request)}
        );
    }

    const userData = await response.json();
    const authorizedUsernames = ['varun7654']; // Replace with your list of authorized usernames

    if (!authorizedUsernames.includes(userData.login)) {
        return new Response(
            JSON.stringify({
                status: 401,
                statusText: 'Unauthorized',
                expire_logins: false,
                error: 'User is not authorized to access this resource'
            }),
            {status: 401, headers: getHeaders(request)}
        );
    }

    return new Response(JSON.stringify({
        status: 200,
        prompt: "This is a prompt",
        response: "# Test Response \n - next line \n - line 3"
    }), {status: 200, headers: getHeaders(request)});
}