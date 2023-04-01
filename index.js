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

  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      const { payload, octokit } = context;
      const { owner, repo } = context.repo();
      const pullNumber = payload.number;

      // Get the pull request
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
      const { data: diffData } =
        await context.octokit.rest.repos.compareCommits({
          owner: owner,
          repo: repo,
          base: baseSha,
          head: headSha,
        });
      //app.log.info(diffData);
      const { files, commits } = diffData;

      //configuring openai
      const configuration = new Configuration({
        organization: "org-EgEMfXFi82cjEHyUnXCDxS0k",
        apiKey: "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",
      });
      const openai = new OpenAIApi(configuration);

      //Declare messages array to store the conversation
      const conversations = [];

      //Start the conversation
      conversations.push({
        role: "user",
        content: `Please review the following PR written using javascript, reactJS and provide feedback.`,
      });
      const conversationStart = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: conversations,
      });

      //update the conversation with the openAI response
      conversations.push({
        role: "assistant",
        content: conversationStart.data.choices[0].message.content,
      });

      //Loop through the files and create a review comment for each file
      for (let fileCount = 0; fileCount < files.length; fileCount++) {
        const { patch, filename, status } = files[fileCount];

        if ((status !== "modified" && status !== "added") || !patch) {
          continue;
        }
        //create a review comment for each file
        conversations.push({
          role: "user",
          content: `Bellow is the code patch, please help me do a brief code review. Please respond only if you find any bug risk or have improvement suggestions 
        ${patch}`,
        });
        const conversation = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: conversations,
        });

        const botResponse = conversation.data.choices[0].message.content;

        //check if the file already have review comments from the bot
        const fileReviews = await context.octokit.pulls.listReviews({
          owner,
          repo,
          pull_number: context.pullRequest().pull_number,
          path: filename,
        });
        const isAlreadyReviewed = fileReviews.data.some((review) => {
          return (
            review.user.login === "pr-analyzer-app[bot]" && review.body !== ""
          );
        });

        //create a review comment for each file if bot response is not empty
        if (!!botResponse && !isAlreadyReviewed) {
          await context.octokit.pulls.createReviewComment({
            repo,
            owner,
            pull_number: context.pullRequest().pull_number,
            commit_id: commits[commits.length - 1].sha,
            path: filename,
            body: botResponse,
            position: patch.split("\n").length - 1,
          });
        }

        //update the conversation with the openAI response
        conversations.push({
          role: "assistant",
          content: botResponse,
        });
      }

      const conversationEnd = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          ...conversations,
          {
            role: "user",
            content: `Thank you for the review. Please share summary of the review.`,
          },
        ],
      });
      const botResponse = conversationEnd.data.choices[0].message.content;

      //Add the summary to the PR
      const issueComment = context.issue({
        body: `Thanks for opening this pull request!! 
      ${botResponse}`,
      });
      return octokit.issues.createComment(issueComment);
    }
  );

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
