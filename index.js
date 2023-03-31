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
     const { github, payload } = context;
    //  const repo = context.repo();
    //  const pullNumber = context.payload.number;
    app.log.info("github>>>>>>>>>>>>>>>>>>>>");
    app.log.info(github);
    app.log.info("github>>>>>>>>>>>>>>>>>>>>");
    //  // Get information about the pull request
    //  const pullRequest = await (context.github).pullRequests.get({
    //    owner: repo.owner,
    //    repo: repo.repo,
    //    pull_number: pullNumber
    //  });
 
    //  // Get the SHA of the base and head commits
    //  const baseSha = pullRequest.data.base.sha;
    //  const headSha = pullRequest.data.head.sha;
 
    //  // Get the diff between the base and head commits
    //  const diff = await context.github.repos.compareCommits({
    //    owner: repo.owner,
    //    repo: repo.repo,
    //    base: baseSha,
    //    head: headSha
    //  });
 
    //  console.log(diff.data.files);
     const issueComment = context.issue({
       body: "Thanks for opening this pull request!",
     });
     return context.octokit.issues.createComment(issueComment);
   });
   app.on("pull_request.closed", async (context) => {
    const { github, payload } = context;
    //  const repo = context.repo();
    //  const pullNumber = context.payload.number;
    app.log.info("github>>>>>>>>>>>>>>>>>>>>");
     app.log.info(github);
     app.log.info("github>>>>>>>>>>>>>>>>>>>>");
    //  app.log.info(context);
    //  const owner = context.payload.repository.owner.login;
    //  const repo = context.payload.repository.name;
    //  const number = context.payload.number;
    //  console.log({
    //    owner,
    //    repo,
    //    number});
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
