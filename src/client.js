const LINEAR_API_URL = 'https://api.linear.app/graphql';

export function getApiKey() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) {
    throw new Error('LINEAR_API_KEY is required');
  }
  return key;
}

export async function linearRequest(query, variables = {}) {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: getApiKey(),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Linear API request failed with status ${response.status}: ${JSON.stringify(payload)}`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  return payload.data;
}
