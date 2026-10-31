export default {
    limits: {
        title: 'Limits',
        explain: 'The mark shows where usage would be at an even pace. Past the mark, you use it up faster than it resets.',
        loading: 'Loading limits…',
        used: '{{percent}}% used',
        bar: '{{window}}, {{percent}}% used',
        windowPassed: '{{percent}}% of the window passed',
        faster: 'Using it faster than it resets.',
        slower: 'Using it slower than it resets.',
        pace: {
            ahead: '{{percent}}% used, ahead of an even pace of {{pace}}%',
            behind: '{{percent}}% used, behind an even pace of {{pace}}%',
            even: '{{percent}}% used, on an even pace'
        },
        even: 'Using it as fast as it resets.',
        resets: 'Resets {{at}}',
        none: 'No limits reported yet.',
        notInstalled: 'Not installed on this machine.',
        noSubscription: 'API key, no plan limits.',
        unreachable: 'Could not check the limits.',
        filter: 'Accounts shown',
        signedOut: 'Not logged in',
        signedOutDetail: 'Not logged in. Log in to see limits.',
        logIn: 'Log in',
        checked: {
            now: 'now',
            ago: '{{duration}} ago',
            fromTurn: 'From a turn · {{when}}'
        }
    },
    settings: {
        currency: {
            label: 'Currency',
            dollars: 'Prices as published, in dollars.',
            noRate: 'No exchange rate yet. Showing dollars.',
            converted: 'Converted at the ECB rate of {{date}}.',
            options: {
                USD: 'Dollars',
                EUR: 'Euros'
            }
        },
        page: {
            label: 'Usage page',
            description: 'Cost, tokens and plan limits, per account.',
            open: 'Open usage'
        }
    },
    section: {
        label: 'Usage',
        description: 'Currency of the usage page.'
    },
    dialog: {
        title: 'Usage',
        description: 'Cost, tokens and plan limits',
        close: 'Close usage',
        rescan: 'Scan again',
        period: 'Period',
        metric: 'Metric',
        failed: 'Could not show usage',
        periods: {
            today: 'Today',
            '7d': '7 days',
            '30d': '30 days',
            '90d': '90 days'
        },
        metrics: {
            cost: 'Cost',
            tokens: 'Tokens'
        },
        accounts: {
            label: 'Account',
            all: 'All accounts'
        }
    },
    empty: {
        noTranscripts: 'No Claude or Codex chats found on this machine yet.',
        noUsage: 'No usage yet.'
    },
    agents: {
        none: 'No agent CLI installed.',
        installed: 'Installed: {{list}}.',
        settings: 'Agent settings'
    },
    provenance: {
        failed: 'Could not read the latest usage. Showing the last results.',
        scanned_one: 'Scanned {{time}}, {{files}} file',
        scanned_other: 'Scanned {{time}}, {{files}} files',
        bundledPrices: 'Built-in prices',
        fetchedPrices: 'Prices of {{date}}',
        rate: '{{currency}} at the ECB rate of {{date}}'
    },
    summary: {
        sessions_one: '{{sessions}} session',
        sessions_other: '{{sessions}} sessions',
        calls_one: '{{calls}} call',
        calls_other: '{{calls}} calls',
        apiRates: 'at API rates'
    },
    tiles: {
        processed: 'Processed',
        uncachedInput: 'Uncached input',
        cachedInput: 'Cached input',
        cacheWrites: 'Cache writes',
        output: 'Output',
        cacheSavings: 'Cache savings'
    },
    chart: {
        total: 'Total'
    },
    breakdown: {
        title: 'Breakdown',
        tabs: {
            models: 'Models',
            projects: 'Projects',
            day: 'Day'
        },
        models: {
            model: 'Model',
            calls: 'Calls',
            input: 'Input',
            output: 'Output',
            cache: 'Cache R/W',
            cost: 'Cost',
            share: 'Share',
            pricedAs: 'Priced as {{model}}',
            noPrice: 'No known price'
        },
        days: {
            day: 'Day',
            total: 'Total',
            tokens: 'Tokens',
            empty: 'No activity in this window.'
        }
    }
};
