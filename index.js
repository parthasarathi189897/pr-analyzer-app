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
    const { payload, octokit, issue } = context;
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

    app.log.info(diff.data.files);

    const issueComment = issue({
      body: "Thanks for opening this pull request!",
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
