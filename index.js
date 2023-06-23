const { Configuration, OpenAIApi } = require("openai");
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // Your code here
  app.log.info("App is loaded!!");

  //configure openAI
  const configuration = new Configuration({
    organization: "org-kcT653lZu4KmQYUIsYgaHbde",
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  //get the pull request details
  const getPullRequestDetails = async (context) => {
    const { payload, octokit } = context;
    const { owner, repo } = context.repo();
    const pullNumber = payload.issue.number;

    // Get the pull request
    const pullRequest = await octokit.pulls.get({
      owner: owner,
      repo: repo,
      pull_number: pullNumber,
    });
    return {
      owner,
      pullNumber,
      pullRequest,
      repo,
    };
  };

  const getPullDiff = async (context, { owner, repo, pullRequest }) => {
    // Get the SHA of the base and head commits
    const pullRequestData = pullRequest.data;
    const baseSha = pullRequestData.base.sha;
    const headSha = pullRequestData.head.sha;

    // Get the diff between the base and head commits
    const { data: diffData } = await context.octokit.rest.repos.compareCommits({
      owner: owner,
      repo: repo,
      base: baseSha,
      head: headSha,
    });
    return diffData;
  };

  const addReviewComment = async (
    context,
    { owner, repo, filename, review, commits, patch }
  ) => {
    //check if the file already have review comments from the bot
    const fileReviews = await context.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: context.pullRequest().pull_number,
      path: filename,
    });
    const isAlreadyReviewed = fileReviews.data.some((review) => {
      return review.user.login === "pr-analyzer-app[bot]" && review.body !== "";
    });

    //create a review comment for each file if bot response is not empty
    if (!!review && !isAlreadyReviewed) {
      await context.octokit.pulls.createReviewComment({
        repo,
        owner,
        pull_number: context.pullRequest().pull_number,
        commit_id: commits[commits.length - 1].sha,
        path: filename,
        body: review,
        position: patch.split("\n").length - 1,
      });
    }
  };

  const getConversation = async (context, shouldAddComment = false) => {
    const { owner, repo, pullRequest } = await getPullRequestDetails(context);
    //get the diff data
    const { files, commits } = await getPullDiff(context, { owner, repo, pullRequest });

    //Declare messages array to store the conversation
    const conversations = [];
    const reviews = [];

    //Start the conversation
    conversations.push({
      role: "system",
      //content: `You are a principal software engineer, working on reactjs and javascript application. Your task is to perform pull request reviews. I will provide you the diffs and perform the review on that diff.`,
      content: `Do not introduce yourselves.
      Your task is:
        - Review the code changes and provide improvement feedbacks.
        - Do not comment if there are no issues or bugs with this code change.
        - If there are any bugs, highlight them in review comment.
        - Provide details on missed use of best-practices.
        - Provide suggestions for web vitals improvements.
        - Do not highlight minor issues and nitpicks.
        - Use bullet points if you have multiple comments.
        - Provide security recommendations if there are any.
        - Give code examples if you have any suggestions.
      
      You will be provided with the diff of the code changes. You have to perform the review on that diff.`,
    });
    const conversationStart = await openai.createChatCompletion({
      model: "gpt-4",
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
        //content: `Perform PR review on the following diff:
        content: `Perform the tasks on following diff:
        ${patch}`,
      });
      const conversation = await openai.createChatCompletion({
        model: "gpt-4",
        messages: conversations,
      });

      const botResponse = conversation.data.choices[0].message.content;

      //update the conversation with the openAI response
      conversations.push({
        role: "assistant",
        content: botResponse,
      });
      reviews.push(botResponse);
      if (shouldAddComment && context) {
        addReviewComment(context, {
          owner,
          repo,
          filename,
          review: reviews[fileCount],
          commits,
          patch,
        });
      }
    }
    return { conversations, reviews };
  };

  const addReview = async (context) => {
    const { owner, repo, pullRequest } = await getPullRequestDetails(context);
    //get the diff data
    await getPullDiff(context, { owner, repo, pullRequest });

    await getConversation(context, true);
  };

  const addSummary = async (context) => {
    const { conversations } = await getConversation(context);
    const conversationEnd = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        ...conversations,
        {
          role: "user",
          content: `Please share summary of the review.`,
        },
      ],
    });

    const botResponse = conversationEnd.data.choices[0].message.content;
    //Add the summary to the PR
    const issueComment = context.issue({
      body: `Thanks for opening this pull request!! 
    ${botResponse}`,
    });
    return context.octokit.issues.createComment(issueComment);
  };

  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    return context.octokit.issues.createComment(issueComment);
  });
  app.on("issue_comment.created", async (context) => {
    //get the comment
    const comment = context.payload.comment.body;
    if (comment === "/review") {
      const issueComment = context.issue({
        body: "Thanks for the request! I will perform the action soon...",
      });
      context.octokit.issues.createComment(issueComment);
      await addReview(context);
      const summaryComment = context.issue({
        body: "Please comment /summary to get the summary of the review.",
      });
      return context.octokit.issues.createComment(summaryComment);
    } else if (comment === "/summary") {
      addSummary(context);
      const issueComment = context.issue({
        body: "Thanks for the request! I will perform the action soon...",
      });
      return context.octokit.issues.createComment(issueComment);
    }
  });

  app.on("pull_request.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this pull request!",
    });
    return context.octokit.issues.createComment(issueComment);
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
