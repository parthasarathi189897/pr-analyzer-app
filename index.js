const { Configuration, OpenAIApi } = require("openai");
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    return context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.opened", async (context) => {
    const { payload, octokit } = context;
    const { owner, repo } = context.repo();
    const pullNumber = payload.number;

    const pullRequest = await octokit.pulls.get({
      owner: owner,
      repo: repo,
      pull_number: pullNumber,
    });

    // Get the SHA of the base and head commits
    const pullRequestData = pullRequest.data;
    const baseSha = pullRequestData.base.sha;
    const headSha = pullRequestData.head.sha;

    // Get the diff between the base and head commits
    const diff = await context.octokit.rest.repos.compareCommits({
      owner: owner,
      repo: repo,
      base: baseSha,
      head: headSha,
    });

    //app.log.info(diff.data.files[0].patch);
    // Send the diff to the ChatGPT API
    const configuration = new Configuration({
      organization: "org-EgEMfXFi82cjEHyUnXCDxS0k",
      apiKey: "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",
    });
    const openai = new OpenAIApi(configuration);
    const messages = [];
    messages.push({
      role: "user",
      content: `Please review the following PR written using javascript, reactJS and provide feedback.`,
    });
    const completion1 = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [...messages],
    });
    messages.push({
      role: "assistant",
      content: completion1.data.choices[0].message.content,
    });
    for (let fileCount = 0; fileCount <  diff.data.files.length; fileCount++) {
      messages.push({
        role: "user",
        content: `The code diff for file number ${fileCount+1}:\n\n${diff.data.files[fileCount].patch}`,
      });
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [...messages],
      });
      const completion_text = completion.data.choices[0].message.content;
      messages.push({
        role: "assistant",
        content: completion_text,
      });
    }
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        ...messages,
        {
          role: "user",
          content: `Thank you for the review. Please share detailed review of all the files.`,
        }
      ],
    });
    const completion_text = completion.data.choices[0].message.content;
    app.log.info(completion_text);

    // const gptResponse = await openai.createChatCompletion({
    //   engine: 'davinci-codex',
    //   prompt: `Please review the following code diff and provide feedback:\n\n${diff.data.files}`,
    //   maxTokens: 1024,
    //   temperature: 0.5,
    //   n: 1,
    //   stop: '\n\n'
    // });

    // const review = gptResponse.data.choices[0].text.trim();
    //app.log.info(review);

    const issueComment = context.issue({
      body: `Thanks for opening this pull request!! 
      Here is the review: 
      ${completion_text}`,
    });
    return octokit.issues.createComment(issueComment);
  });
  app.on("pull_request.closed", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for closing this pull request!",
    });
    return context.octokit.issues.createComment(issueComment);
  });

  app.on("push", async (context) => {
    // Code was pushed to the repo, what should we do with it?
    app.log.info(context);
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
