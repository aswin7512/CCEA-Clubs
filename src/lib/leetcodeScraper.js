/* GRAPHQL QUERY command:
curl 'https://leetcode.com/graphql' \
            -H 'content-type: application/json' \
            --data-raw '{"query":"query userRecentSubmissions($username: String!) { recentSubmissionList(username: $username, limit: 8) { titleSlug statusDisplay } }","variables":{"username":"0x11a41"}}' | jq

EXAMPLE OUTPUT:
{
  "data": {
    "recentSubmissionList": [
      {
        "titleSlug": "string-to-integer-atoi",
        "statusDisplay": "Accepted"
      },
    ]
  }
}
*/

// returns statusDiplay field or null if not found (user didn't submit)
async function leetcodeScraper(username, targetSlug) {
  const proxyUrl = 'https://corsproxy.io/?';
  const targetUrl = 'https://leetcode.com/graphql';
  
  const graphqlQuery = {
    query: `
      query userRecentSubmissions($username: String!) {
        recentSubmissionList(username: $username, limit: 30) {
          titleSlug
          statusDisplay
        }
      }
    `,
    variables: { username: username }
  };

  try {
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graphqlQuery)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const json = await response.json();
    const submissions = json?.data?.recentSubmissionList || [];

    const matchingSubmission = submissions.find(sub => sub.titleSlug === targetSlug);

    return matchingSubmission ? matchingSubmission.statusDisplay : null;

  } catch (error) {
    console.error("CORS Proxy or Network failure:", error);
    return null;
  }
}

export { leetcodeScraper }
