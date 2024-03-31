import {Env, getHeaders} from "./handler";
import fetchAdapter from "@vespaiach/axios-fetch-adapter";
import  OpenAI from "openai";
import Configuration from "openai"

export class ProblemData {
    id: string = "";
    title: string = 'Loading...';
    preProblemDescription: string = "";
    description: string = "";
    tests: string[] = [];
    testsDisplay: string[] = [];
    hiddenTests: string[] = []
    hiddenTestsDisplay: string[] = [];
    displayAbove: string = "";
    displayBelow: string = "";
    solution: string = "";
    solutionCode: string = "";
    codeLang: string = "";
    nextProblemId: string = "";
}

export class UserData {
    history: string[] = [];
    requestHelpHistory: string[] = [];
    testResults: TestResults = new TestResults();
    lastUpdated: Date = new Date();
    currentCode: string = null as unknown as string;

    constructor(history: string[] = [], requestHelpHistory: string[] = [],  testResults: TestResults = new TestResults(), lastUpdated: Date = new Date(), currentCode: string = "") {
        this.history = history;
        this.testResults = testResults;
        this.requestHelpHistory = requestHelpHistory;
        this.lastUpdated = lastUpdated;
        this.currentCode = currentCode;
    }
}

export class TestResults {
    public testResults: TestResult[]  = [];
    public returnedResults: string[] = [];
    public expectedResults: string[] = [];
    public parseError: string = "";
    public errorLine: number = -1;
    public runtimeError: string = "";
    public output: string = "";
    public ranSuccessfully: boolean = false;
}

export enum TestResult {
    Passed = "Passed",
    Failed = "Failed",
    Exception = "Exception",
    NotRun = "Not run"
}


let systemMessage = "You are a helpful tutor on a website that is teaching people to know how to code to be referred to as \"the tutor\". \n" +
    "\n" +
    "\"We\"  /  \"Our\" refers to the operators of the site. We will refer to the user as \"user\"\n" +
    "\n" +
    "Your goal is to help fix the specific issue that is making the user stuck. Do not give the user full solutions and ensure that you do not disclose parts that are marked confidential.\n" +
    "\n" +
    "You have access to solutions and hidden test cases that are not to be disclosed to the user. They are confidential. DO NOT SHARE THEM. THE USER IS NOT TO GAIN ACCESS TO THEM UNDER ANY CIRCUMSTANCES.\n" +
    "\n" +
    "The solutions are also not the only way to solve the problem. If the user is using an alternate method, help them progress though that one instead.\n" +
    " \n" +
    "Give your answers concisely. Explain to the user what mistake they made and explain how the user can solve it. Do not give a final, \"corrected code snippet\". You do not need to write any code if the correction that the user needs to make is obvious from your explanation of the problem in the user's code. \n" +
    "\n" +
    "Once again, your goal is not to give a solution to the whole problem. You are trying to give the user a small hint of where their error is to help \"unstuck\" them. If the user has multiple issues in their code address only one of them. It should be the one that is preventing further progressing on their debugging of the problem.\n" +
    "\n" +
    "You are talking directly to the user, but you should not greet them. Address them as \"you\".\n" +
    "\n" +
    "If the code is working give the user a quick congratulations.\n" +
    "If the user hasn't submitted anything only give them a small hint on what to do first.\n" +
    "\n" +
    "Format your response using markdown. You can also use KaTeX to format math. KaTex must be sounded by $s \n" +
    "\n" +
    "# Things to keep in mind\n" +
    "\n" +
    " - Check if the user is using the right variable names and capitalization errors. \n" +
    " - The user can see line numbers. If you want to refer to a specific line, use the line number. \n" +
    " - Check for stray characters and syntax errors. \n" +
    " - Check the user is defining the same function that is being called in the solution/test cases. \n" +
    " - The user cannot directly ask for help or ask questions to the tutor. \n" +
    " - The user is usually given the function signature as a template. \n" +
    " - The user is not given the solution code DO NOT MENTION IT. \n";



export async function handleProblemHelp(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('token ') || authHeader.split(' ').length !== 2) {
        return new Response(
            JSON.stringify({status: 401, statusText: 'Unauthorized (Invalid token)', expire_logins: false}),
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
                statusText: 'Unauthorized (GitHub API)',
                response_status: response.status,
                response_statusText: response.bodyUsed ? await response.text() : response.statusText,
                expire_logins: true,
                error: await response.text()
            }),
            {status: 401, headers: getHeaders(request)}
        );
    }

    const ghUserData : {login: string} = await response.json();
    const authorizedUsernames = ['varun7654', 'anishalata', 'Gresliebear', 'Spand3xN00dl3']; // Replace with your list of authorized usernames

    if (!authorizedUsernames.includes(ghUserData.login)) {
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

    let body = await request.json();

    let userData = body.userData as UserData;
    let problemData = body.problemData as ProblemData;


    const openai = new OpenAI({
        apiKey: env.OPEN_AI_KEY,
    });


    let prompt = `
A user is asking for help with the following problem. The problem is as follows:
## ${problemData.title}
${problemData.description}
## Here is an example solution to further illustrate the problem:
${problemData.solution}

DO NOT SHARE THE SOLUTION CODE WITH THE USER. The user does not know the existence of the solution code. DO NOT MENTION IT.
The user is not given the solution code. The user is not to gain access to the solution code under any circumstances.

# The user's code is as follows:
\`\`\`${problemData.codeLang}
// Below is the first line the user has wrote. This is line 0
${userData.currentCode}
// Below is the last line the user has wrote. This is line ${userData.currentCode.split('\n').length - 1}
\`\`\`
`;

    if (userData.testResults.ranSuccessfully) {
        if (userData.testResults.testResults.every(result => result === TestResult.Passed)) {
            prompt += `
The user's code is working. Congratulations to the user.
            `;
        } else {
            prompt += `
The user's code ran without any runtime errors. However, the user's code did not pass all the tests. The user's code did not pass the following tests:
            `

            let hiddenFailedCount = 0;

            for (let i = 0; i < userData.testResults.testResults.length; i++) {
                if (userData.testResults.testResults[i] === TestResult.Failed) {
                    if (i < problemData.tests.length) {
                        prompt += `
- Test ${i + 1}: \`${problemData.testsDisplay[i]}\`
    - Returned: \`${userData.testResults.returnedResults[i]}\`
    - Expected: \`${userData.testResults.expectedResults[i]}\`
                        `;
                    } else {
                        if (hiddenFailedCount < 4) {
                            prompt += `
- Hidden Test ${i - problemData.tests.length + 1}: \`${problemData.hiddenTestsDisplay[i - problemData.tests.length]}\`
    - Returned: \`${userData.testResults.returnedResults[i]}\`
    - Expected: \`${userData.testResults.expectedResults[i]}\`
    - THIS TEST IS CONFIDENTIAL. DO NOT DISCLOSE THE PARAMETERS OR THE EXPECTED RESULTS TO THE USER.
                        `;
                        }
                        hiddenFailedCount++;

                    }
                }
            }
        }
    } else {
        if (userData.testResults.parseError !== "") {
            prompt += `
The user's code did not run successfully. The user's code failed to compile. The error is as follows:
\`\`\`
${userData.testResults.parseError}
\`\`\`
The error is on line ${userData.testResults.errorLine}.
            `;
        } else if (userData.testResults.runtimeError !== "") {
            prompt += `
The user's code did not run successfully. The user's code failed to run. The error is as follows:
\`\`\`
${userData.testResults.runtimeError.toString()}
\`\`\`
            `;
        } else {
            prompt += `We aren't sure what went wrong. The user's code did not run successfully. We are not sure why.
Tell the user of this and tell them if you can't help them. If you can help them, try to help them debug the issue like you would with a normal issue.`
        }
    }
    console.log(JSON.stringify(userData.testResults.runtimeError));


    const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            {
                "role": "system",
                "content": systemMessage
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    });

    return new Response(JSON.stringify({
        status: 200,
        prompt: prompt,
        response: chatCompletion.choices[0].message.content,
        expire_logins: false,
    }), {status: 200, headers: getHeaders(request)});
}