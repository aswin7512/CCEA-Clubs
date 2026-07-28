import { parseLeetCodeSlugs } from './integrations';

/* GRAPHQL QUERY command:
curl 'https://leetcode.com/graphql' \
            -H 'content-type: application/json' \
            --data-raw '{"query":"query userRecentSubmissions($username: String!) { recentSubmissionList(username: $username, limit: 50) { titleSlug statusDisplay } }","variables":{"username":"0x11a41"}}' | jq
*/

/**
 * Executes a client-side CORS proxy request to query LeetCode's GraphQL API for a user's recent submissions.
 * @param {string} username - Raw LeetCode handle
 * @returns {Promise<Array>} - List of recent submissions [{ titleSlug, statusDisplay }]
 */
async function fetchRecentSubmissions(username) {
  if (!username) return [];

  const proxyUrl = 'https://corsproxy.io/?';
  const targetUrl = 'https://leetcode.com/graphql';
  
  const graphqlQuery = {
    query: `
      query userRecentSubmissions($username: String!) {
        recentSubmissionList(username: $username, limit: 50) {
          titleSlug
          statusDisplay
        }
      }
    `,
    variables: { username: username.trim() }
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
    return json?.data?.recentSubmissionList || [];
  } catch (error) {
    console.error("CORS Proxy or Network failure:", error);
    return [];
  }
}

/**
 * Backward compatible single-slug scraper function
 */
async function leetcodeScraper(username, targetSlug) {
  if (!username || !targetSlug) return null;
  const submissions = await fetchRecentSubmissions(username);
  const cleanTargetSlug = targetSlug.toLowerCase().trim();
  const matchingSubmission = submissions.find(sub => sub.titleSlug?.toLowerCase() === cleanTargetSlug);
  return matchingSubmission ? matchingSubmission.statusDisplay : null;
}

/**
 * Evaluates LeetCode ground truth status for a user & problem slug(s).
 * Supports single slug or multiple comma/space/newline separated slugs!
 * Returns structured result:
 *  - verificationStatus: 'completed' | 'attempted' | 'not_done'
 *  - rawStatusDisplay: string | null
 *  - message: descriptive status message
 * @param {string} username 
 * @param {string} targetSlug 
 */
async function evaluateLeetCodeSubmission(username, targetSlug) {
  if (!username || !username.trim()) {
    return {
      verificationStatus: 'not_done',
      rawStatusDisplay: null,
      message: 'No LeetCode username registered for user.'
    };
  }

  if (!targetSlug || !targetSlug.trim()) {
    return {
      verificationStatus: 'not_done',
      rawStatusDisplay: null,
      message: 'No target LeetCode problem slug provided for task.'
    };
  }

  const targetSlugs = parseLeetCodeSlugs(targetSlug);
  if (targetSlugs.length === 0) {
    return {
      verificationStatus: 'not_done',
      rawStatusDisplay: null,
      message: 'Invalid LeetCode target slug or URL provided.'
    };
  }

  const submissions = await fetchRecentSubmissions(username);

  // Evaluate each target slug
  const slugResults = targetSlugs.map(slug => {
    const match = submissions.find(s => s.titleSlug?.toLowerCase() === slug);
    const status = match ? match.statusDisplay : null;
    const isAccepted = status?.toLowerCase() === 'accepted';
    return { slug, status, isAccepted };
  });

  const totalCount = targetSlugs.length;
  const acceptedCount = slugResults.filter(r => r.isAccepted).length;
  const attemptedCount = slugResults.filter(r => r.status && !r.isAccepted).length;

  if (acceptedCount === totalCount) {
    // All problems completed!
    return {
      verificationStatus: 'completed',
      rawStatusDisplay: totalCount > 1 ? `Accepted (${acceptedCount}/${totalCount})` : 'Accepted',
      message: totalCount > 1 
        ? `Verified! All ${totalCount} assigned LeetCode problems are Accepted!`
        : `Verified! Solution is Accepted on LeetCode.`
    };
  }

  if (acceptedCount > 0 || attemptedCount > 0) {
    // Partial progress or attempted
    return {
      verificationStatus: 'attempted',
      rawStatusDisplay: totalCount > 1 ? `${acceptedCount}/${totalCount} Accepted` : slugResults[0].status,
      message: totalCount > 1
        ? `Attempted ${acceptedCount}/${totalCount} problems Accepted on LeetCode. Please solve all assigned questions to complete this task.`
        : `Attempted on LeetCode (Status: "${slugResults[0].status}"). Solution not yet Accepted.`
    };
  }

  return {
    verificationStatus: 'not_done',
    rawStatusDisplay: null,
    message: totalCount > 1
      ? `No recent submissions found for any of the ${totalCount} target problems under username "${username}".`
      : `No recent submission found for "${targetSlugs[0]}" under username "${username}". Make sure you submitted your code on LeetCode.`
  };
}

export { leetcodeScraper, evaluateLeetCodeSubmission }

