// Provider cost fetchers. Each returns { totalUsd, lastEndTime, raw }
// or throws an Error with a human-readable message.
//
// Both providers expose paginated cost reports keyed off an admin API key
// (NOT a regular API key). These admin keys are created in the org settings
// of each provider's console.

// Two auto-sync modes:
//   mode: 'cost'    — provider returns cumulative spend; we subtract from
//                     starting balance + top-ups (OpenAI, Anthropic).
//   mode: 'balance' — provider returns the remaining balance directly; we
//                     store it as-is (fal.ai, fish.audio).
// Providers without `autoSync: true` are tracked manually.
const PROVIDER_CONFIG = {
  openai: {
    label: 'OpenAI',
    consoleUrl: 'https://platform.openai.com/settings/organization/admin-keys',
    keyPrefix: 'sk-admin-',
    autoSync: true,
    mode: 'cost',
  },
  anthropic: {
    label: 'Anthropic',
    consoleUrl: 'https://console.anthropic.com/settings/admin-keys',
    keyPrefix: 'sk-ant-admin',
    autoSync: true,
    mode: 'cost',
  },
  google: {
    label: 'Google AI',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    autoSync: false,
  },
  fal: {
    label: 'fal.ai',
    consoleUrl: 'https://fal.ai/dashboard/keys',
    autoSync: true,
    mode: 'balance',
  },
  fish: {
    label: 'fish.audio',
    consoleUrl: 'https://fish.audio/go-api/api-keys/',
    autoSync: true,
    mode: 'balance',
  },
  ollama: {
    label: 'Ollama',
    consoleUrl: 'https://ollama.com',
    autoSync: false,
  },
  openrouter: {
    label: 'OpenRouter',
    consoleUrl: 'https://openrouter.ai/settings/keys',
    autoSync: false,
  },
  replicate: {
    label: 'Replicate',
    consoleUrl: 'https://replicate.com/account/api-tokens',
    autoSync: false,
  },
  groq: {
    label: 'Groq',
    consoleUrl: 'https://console.groq.com/keys',
    autoSync: false,
  },
  mistral: {
    label: 'Mistral',
    consoleUrl: 'https://console.mistral.ai/api-keys/',
    autoSync: false,
  },
  together: {
    label: 'Together AI',
    consoleUrl: 'https://api.together.ai/settings/api-keys',
    autoSync: false,
  },
  custom: {
    label: 'Other / Custom',
    consoleUrl: '',
    autoSync: false,
  },
};

export const getProviderConfig = (provider) => PROVIDER_CONFIG[provider] || null;

export const providerSupportsAutoSync = (provider) =>
  Boolean(PROVIDER_CONFIG[provider]?.autoSync);

export const getProviderMode = (provider) =>
  PROVIDER_CONFIG[provider]?.mode || null;

const toUsdNumber = (value) => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Pull cost for a date range from OpenAI's organization costs endpoint.
// Docs: https://platform.openai.com/docs/api-reference/usage/costs
async function fetchOpenAICost(adminKey, startDate) {
  const startUnix = Math.floor(new Date(startDate).getTime() / 1000);
  let total = 0;
  let nextPage = null;
  let pageCount = 0;
  const maxPages = 60; // hard guard against runaway pagination

  do {
    const params = new URLSearchParams({
      start_time: String(startUnix),
      bucket_width: '1d',
      limit: '180',
    });
    if (nextPage) params.set('page', nextPage);

    const url = `https://api.openai.com/v1/organization/costs?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300) || res.statusText}`);
    }

    const json = await res.json();
    const buckets = Array.isArray(json?.data) ? json.data : [];
    for (const bucket of buckets) {
      const results = Array.isArray(bucket?.results) ? bucket.results : [];
      for (const item of results) {
        // OpenAI returns { amount: { value, currency } }
        total += toUsdNumber(item?.amount?.value);
      }
    }
    nextPage = json?.has_more ? json?.next_page || null : null;
    pageCount += 1;
  } while (nextPage && pageCount < maxPages);

  return { totalUsd: total };
}

// Pull cost for a date range from Anthropic's cost report endpoint.
// Docs: https://docs.claude.com/en/api/admin-api/usage-cost/get-cost-report
async function fetchAnthropicCost(adminKey, startDate) {
  const startIso = new Date(startDate).toISOString();
  let total = 0;
  let nextPage = null;
  let pageCount = 0;
  const maxPages = 60;

  do {
    const params = new URLSearchParams({
      starting_at: startIso,
      bucket_width: '1d',
      limit: '31',
    });
    if (nextPage) params.set('page', nextPage);

    const url = `https://api.anthropic.com/v1/organizations/cost_report?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': adminKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300) || res.statusText}`);
    }

    const json = await res.json();
    const buckets = Array.isArray(json?.data) ? json.data : [];
    for (const bucket of buckets) {
      const results = Array.isArray(bucket?.results) ? bucket.results : [];
      for (const item of results) {
        // Anthropic reports amounts as decimal strings in cents — divide by 100
        // for USD. Per https://docs.claude.com/.../usage-cost-api ("All costs in
        // USD, reported as decimal strings in lowest units (cents)").
        total += toUsdNumber(item?.amount) / 100;
      }
    }
    nextPage = json?.has_more ? json?.next_page || null : null;
    pageCount += 1;
  } while (nextPage && pageCount < maxPages);

  return { totalUsd: total };
}

export async function fetchProviderCost(provider, adminKey, startDate) {
  // Manual providers have no cost API — caller should treat balance as
  // startingBalance + topups only.
  if (!providerSupportsAutoSync(provider)) return { totalUsd: 0 };
  if (!adminKey) throw new Error('Admin key is required');
  if (provider === 'openai') return fetchOpenAICost(adminKey, startDate);
  if (provider === 'anthropic') return fetchAnthropicCost(adminKey, startDate);
  throw new Error(`Unsupported provider: ${provider}`);
}

// fal.ai exposes the *remaining* balance directly (USD).
// Docs: https://fal.ai/docs/platform-apis/v1/account/billing
async function fetchFalBalance(apiKey) {
  const url = 'https://api.fal.ai/v1/account/billing?expand=credits';
  const res = await fetch(url, {
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fal.ai ${res.status}: ${text.slice(0, 300) || res.statusText}`);
  }
  const json = await res.json();
  return { balanceUsd: toUsdNumber(json?.credits?.current_balance) };
}

// fish.audio exposes the remaining API-credit wallet.
// Docs: https://docs.fish.audio/api-reference/endpoint/wallet/get-api-credit
async function fetchFishCredit(apiKey) {
  const url = 'https://api.fish.audio/wallet/self/api-credit';
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fish.audio ${res.status}: ${text.slice(0, 300) || res.statusText}`);
  }
  const json = await res.json();
  // fish returns `credit` as a string; treat it as USD-equivalent.
  return { balanceUsd: toUsdNumber(json?.credit) };
}

export async function fetchProviderBalance(provider, apiKey) {
  if (!apiKey) throw new Error('API key is required');
  if (provider === 'fal') return fetchFalBalance(apiKey);
  if (provider === 'fish') return fetchFishCredit(apiKey);
  throw new Error(`Provider ${provider} does not expose a live balance endpoint`);
}

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_CONFIG);
