export default {
    transport: {
        notConnected: 'The agents are not reachable',
        closedBeforeAnswer: 'The connection to the agents closed before they answered',
        badReply: 'Could not read the answer from the machine',
        notSent: 'Could not reach the agents. Try again.'
    },
    attachments: {
        rejected: {
            empty: 'Empty file',
            tooLarge: 'Larger than {{size}}',
            tooMany_one: 'At most {{count}} file per message',
            tooMany_other: 'At most {{count}} files per message',
            tooHeavy: 'At most {{size}} in total per message'
        },
        unreadable: 'Could not read {{name}}',
        unreadableThumbnail: 'Could not read the thumbnail'
    },
    references: {
        gone: 'Not in this project',
        untitled: 'Untitled'
    },
    fork: {
        refusal: {
            notInConversation: 'This turn is not in the conversation',
            cliCannotFork: 'This agent cannot fork its conversation',
            noConversation: 'Nothing to fork yet. Send a message first.',
            turnRunning: 'Wait for the turn to end',
            originalGone: 'Original no longer in this project'
        },
        point: {
            afterLast: 'After the last turn',
            afterThis: 'After this turn',
            afterTurn: 'After turn {{number}} of {{total}}',
            about: '{{where}}: "{{prompt}}"'
        },
        branch: {
            unnamed: 'Name the branch',
            taken: 'Name already taken'
        },
        pill: {
            label: 'Fork'
        }
    },
    resumeCompaction: {
        title: 'Resume with less context',
        carried: '{{tokens}} tokens from earlier',
        keep: 'Keep full history',
        compact: 'Compact',
        cacheExpired: {
            title: 'Cache expired',
            carried: 'The next message costs {{tokens}} tokens at full price'
        }
    },
    goal: {
        status: {
            active: 'Working toward a goal',
            paused: 'Goal paused',
            blocked: 'Goal blocked',
            'usage-limited': 'Goal stopped on a usage limit',
            'budget-limited': 'Goal used up its token budget',
            complete: 'Goal met'
        },
        pill: 'Goal',
        checks_one: '{{count}} check not met yet',
        checks_other: '{{count}} checks not met yet',
        tokens: '{{tokens}} tokens',
        budget: '{{tokens}} of {{budget}} tokens',
        lastCheck: 'Last check: {{check}}',
        pause: 'Pause',
        resume: 'Resume',
        clear: 'Clear',
        failed: 'Could not change goal'
    },
    limit: {
        usage: {
            pill: 'Limited',
            pillUntil: 'Limited until {{time}}',
            pillResumes: 'Resumes {{time}}',
            title: 'Stopped on a usage limit',
            resets: 'The limit resets at {{time}}.',
            resumes: 'Resumes at {{time}}.'
        },
        overload: {
            pill: 'Overloaded',
            pillRetry: 'Retry {{time}}',
            title: 'Model overloaded',
            sendAgain: 'Send a message to try again.',
            retries: 'Retries at {{time}}.'
        },
        toggle: 'Resume at reset',
        machineOff: 'Turned off for this machine. Turn it on in Settings, Agents.',
        continueOn: 'Continue on',
        continueOnAria: 'Continue on {{account}}',
        continueOnTip: 'Switches to {{account}}, which has the most room left, and resends the turn.',
        continueFailed: 'Could not continue on {{account}}',
        chooseAccount: 'Choose another account',
        continueInForkAria: 'Continue on {{account}} in a fork',
        inFork: 'in a fork'
    },
    contextMeter: {
        aria: '{{percent}}% of context used',
        title: 'Context',
        of: '{{used}} of {{window}}',
        used: '{{tokens}} used',
        percentUsed: '{{percent}} used',
        estimate: '≈{{tokens}}',
        parts: {
            toolOutput: 'Tool output',
            filesRead: 'Files read',
            conversation: 'Conversation',
            system: 'System'
        },
        compactNow: 'Compact now'
    },
    rows: {
        user: {
            heading: 'You',
            showAll: 'Show all',
            showLess: 'Show less',
            quoteGone: 'Quoted reply no longer in this chat.'
        },
        message: {
            heading: 'Message from {{name}}',
            unnamed: 'another node'
        },
        report: {
            heading: 'Report'
        },
        reply: {
            agent: 'Agent',
            writing: 'Writing…'
        },
        thinking: {
            live: 'Thinking…',
            thoughtFor: 'Thought for {{duration}}',
            thought: 'Thought'
        },
        note: {
            hide: 'Hide',
            show: 'Show',
            openFork: 'Open fork',
            openWaiting: 'Open to answer'
        },
        compaction: {
            plain: 'Context compacted',
            from: 'Context compacted from {{tokens}} tokens',
            summary: 'Everything above reaches the agent only as a summary'
        },
        approval: {
            allow: 'Allowed',
            'allow-always': 'Always allowed',
            deny: 'Denied',
            cancelled: 'No longer needed'
        },
        question: {
            notAnswered: '(not answered)',
            dismissed: '(dismissed)'
        },
        subagent: {
            task: 'Task',
            label: 'Sub-agent',
            background: 'background',
            doneIn: 'done in {{duration}}',
            failedIn: 'failed in {{duration}}',
            nothingYet: 'Nothing to show yet.',
            truncated: 'Only the start is kept.',
            showResult: 'Show result',
            hideResult: 'Hide result'
        },
        task: {
            named: '{{model}}: {{title}}',
            running: 'Running',
            waiting: 'Waiting for you',
            paused: 'Paused',
            pausedUntil: 'Paused until {{time}}',
            done: 'Done',
            failed: 'Failed',
            cancelled: 'Cancelled'
        },
        workflow: {
            notStarted: 'not started',
            waiting: 'waiting',
            stopped: 'stopped',
            stalled: 'No progress for five minutes. It is still running, and you can stop it.',
            running: 'Workflow running',
            done: 'Workflow done',
            failed: 'Workflow failed',
            agents_one: '{{count}} agent',
            agents_other: '{{count}} agents',
            working: '{{count}} working',
            finished: '{{count}} done',
            failedCount: '{{count}} failed'
        }
    },
    work: {
        moreCharacters_one: '[{{count}} more character]',
        moreCharacters_other: '[{{count}} more characters]',
        diffLabel: 'Changes in {{path}}',
        showDiff: 'Show diff',
        loadingDiff: 'Loading diff',
        diffUnavailable: 'Could not load this diff',
        runningFor: 'running for {{elapsed}}',
        awaitingApproval: 'waiting for you',
        forksAfter_one: 'Forked after this turn',
        forksAfter_other: '{{count}} forks after this turn',
        omitted: {
            binary: 'Binary file, no diff',
            tooLarge: 'Too large to show'
        },
        changedFiles_one: '{{count}} changed file',
        changedFiles_other: '{{count}} changed files',
        folderChanges_one: '{{count}} folder change this turn',
        folderChanges_other: '{{count}} folder changes this turn',
        baseMoved: 'Branch moved this turn ({{from}} to {{to}}). Includes its incoming changes.',
        andMore: 'and more',
        edits_one: '{{count}} edit',
        edits_other: '{{count}} edits',
        workingFor: 'Working for',
        exitCode: 'Exit code {{code}}',
        alsoRan: '+ {{programs}}',
        heredoc: 'heredoc',
        moreRuns_one: '+{{count}}',
        moreRuns_other: '+{{count}}',
        showFullOutput: 'Show full output',
        showFullDiff: 'Show full diff',
        wholeSize: '{{size}} in total',
        fullOutputFailed: 'Could not load the full output',
        fullDiffFailed: 'Could not load the full diff',
        retry: 'Try again'
    },
    timeline: {
        welcome: {
            morning: 'Good morning',
            afternoon: 'Good afternoon',
            evening: 'Good evening',
            night: 'Still up?'
        },
        empty: {
            ready: '{{model}} is ready.',
            ask: 'Ask anything.',
            canRead: 'It can read',
            worksIn: 'It works in'
        },
        loading: 'Loading conversation',
        loadingEarlier: 'Loading earlier messages',
        stripFailed: 'Could not show the messages',
        cardFailed: 'Could not show this card',
        actions: {
            label: 'Message actions',
            copied: 'Copied'
        },
        menu: {
            copyMessage: 'Copy message',
            copyCode: 'Copy code',
            copyMarkdown: 'Copy as Markdown',
            forkFromHere: 'Fork from here',
            openInPreview: 'Open in preview'
        }
    },
    group: {
        running_one: '{{count}} running',
        running_other: '{{count}} running',
        tools: {
            Read_one: 'Read {{count}} file',
            Read_other: 'Read {{count}} files',
            Write_one: 'Wrote {{count}} file',
            Write_other: 'Wrote {{count}} files',
            NotebookEdit_one: 'Edited {{count}} notebook',
            NotebookEdit_other: 'Edited {{count}} notebooks',
            Bash_one: 'Ran {{count}} command',
            Bash_other: 'Ran {{count}} commands',
            Grep_one: 'Searched {{count}} pattern',
            Grep_other: 'Searched {{count}} patterns',
            Glob_one: 'Listed {{count}} pattern',
            Glob_other: 'Listed {{count}} patterns',
            WebFetch_one: 'Fetched {{count}} page',
            WebFetch_other: 'Fetched {{count}} pages',
            WebSearch_one: 'Searched the web {{count}} query',
            WebSearch_other: 'Searched the web {{count}} queries',
            Task_one: 'Delegated {{count}} task',
            Task_other: 'Delegated {{count}} tasks',
            Agent_one: 'Delegated {{count}} task',
            Agent_other: 'Delegated {{count}} tasks',
            Skill_one: 'Used {{count}} skill',
            Skill_other: 'Used {{count}} skills',
            TodoWrite_one: 'Updated {{count}} plan',
            TodoWrite_other: 'Updated {{count}} plans'
        },
        calls_one: '{{name}} {{count}} call',
        calls_other: '{{name}} {{count}} calls',
        edited_one: 'Edited {{count}} file',
        edited_other: 'Edited {{count}} files',
        toolCalls_one: '{{count}} tool call',
        toolCalls_other: '{{count}} tool calls',
        otherCalls_one: '{{count}} other tool call',
        otherCalls_other: '{{count}} other tool calls'
    },
    turn: {
        about: '{{what}}: {{label}}',
        wokenByTask_one: 'Woken by a task',
        wokenByTask_other: 'Woken by {{count}} tasks',
        wokenByMessage_one: 'Woken by a message',
        wokenByMessage_other: 'Woken by {{count}} messages',
        subagentFinished: 'Sub-agent finished: {{label}}',
        continued: 'Continued on its own',
        stopped: 'Stopped after {{duration}}',
        youStopped: 'You stopped after {{duration}}',
        failed: 'Failed after {{duration}}',
        worked: 'Worked for {{duration}}'
    },
    composer: {
        slotFailed: 'Could not show this control',
        inputLabel: 'Message',
        menu: {
            commands: 'Commands',
            skills: 'Skills',
            mentions: 'Mentions',
            references: 'Views and nodes'
        },
        held: {
            question: 'Question waiting. Opens when you pause typing.',
            approval: 'Approval waiting. Opens when you pause typing.',
            show: 'Show now'
        },
        commands: {
            model: 'Switch model',
            compact: 'Compact context',
            clear: 'Start a new context',
            goal: 'Work until a goal is met',
            skill: 'Skill',
            cli: '{{cli}} command',
            anyCli: 'CLI'
        },
        notice: {
            effort: 'Reasoning set to {{effort}}',
            effortHighest: '{{effort}} is the most reasoning {{model}} takes',
            effortLowest: '{{effort}} is the least reasoning {{model}} takes',
            noEffort: '{{model}} takes no reasoning effort',
            clearFailed: 'Could not clear thread',
            stashChatsDropped_one: 'Left out 1 chat from another project',
            stashChatsDropped_other: 'Left out {{count}} chats from other projects',
            compactFailed: 'Could not compact context',
            noAttachments: '{{agent}} takes no attachments',
            thisAgent: 'This agent',
            rejected: '{{name}}: {{reason}}',
            queuedDoesNotFit: '{{name}} does not fit beside this draft ({{reason}}). The message stays queued.',
            thatFile: 'That file',
            unreadable: 'Could not read that file'
        },
        placeholder: {
            disconnected: 'Not connected to the machine',
            lead: 'Ask anything',
            joiner: ', or',
            commands: 'commands',
            files: 'files',
            skills: 'skills',
            readOnly: 'Go back to the main agent to write'
        },
        jumpToEnd: 'Jump to end',
        mentions: {
            here: 'Files in this folder',
            files: 'Files',
            noMatch: 'No files match',
            empty: 'No files here'
        },
        references: {
            canvas: 'On this canvas',
            views: 'Views',
            noMatch: 'No view or node matches',
            kinds: {
                canvas: 'canvas',
                chat: 'chat',
                terminal: 'terminal',
                note: 'note',
                text: 'text',
                drawing: 'drawing',
                diagram: 'diagram',
                browser: 'browser',
                device: 'device',
                file: 'file',
                database: 'table'
            }
        },
        queue: {
            attachments_one: '{{count}} attachment',
            attachments_other: '{{count}} attachments',
            alreadySent: 'Already sent',
            editFailed: 'Could not edit message',
            sendNow: 'Send now',
            paused: 'Queue paused. Send a message or choose Send now.'
        },
        quote: {
            add: 'Quote',
            remove: 'Remove quote',
            goToSource: 'Go to reply'
        },
        removeAttachment: 'Remove {{name}}',
        attach: 'Attach files',
        tooLong: 'characters, too long to send',
        stop: 'Stop. Shift-click stops sub-agents too',
        queueButton: 'Queue',
        continue: 'Continue',
        continueHint: 'Continue the stopped turn',
        send: 'Send',
        sendActions: 'More send options',
        clear: {
            title: 'Clear thread?',
            description: 'A turn is running.',
            confirm: 'Stop and clear'
        },
        waitingBelow: 'Answer below',
        steerButton: 'Send now. Hold Option or Alt to queue.',
        queueWithSteerButton: 'Queue after this turn. Hold Option or Alt to send now.'
    },
    activity: {
        subagents_one: '{{count}} sub-agent',
        subagents_other: '{{count}} sub-agents',
        shells_one: '{{count}} shell',
        shells_other: '{{count}} shells',
        monitors_one: '{{count}} monitor',
        monitors_other: '{{count}} monitors',
        pausedUntil: 'paused until {{time}}',
        progress: '{{done}} of {{total}} sub-agents done',
        workflow: 'Workflow',
        workflows_one: '{{count}} workflow',
        workflows_other: '{{count}} workflows',
        workflowProgress: '{{name}} · {{done}}/{{total}}',
        workflowStalled: '{{name}} · no progress',
        needsYou_one: '{{count}} needs you',
        needsYou_other: '{{count}} need you',
        took: {
            done: 'done in {{duration}}',
            failed: 'failed after {{duration}}',
            cancelled: 'cancelled after {{duration}}'
        },
        shell: 'Shell',
        monitor: 'Monitor',
        stop: 'Stop',
        stopFailed: 'Could not stop task'
    },
    subagents: {
        stop: {
            task: 'Stop task',
            native: 'Stop sub-agent',
            mark: 'Mark as stopped. It may keep working until the chat stops.'
        },
        stale: 'This sub-agent is no longer running.',
        title: 'Sub-agents',
        backToMain: 'Back to main agent',
        loading: 'Loading conversation…',
        working: 'Working…',
        unsupported: 'Update Ruimte on this machine to read sub-agents.',
        unreadable: 'Could not read conversation.',
        noAnswer: 'The machine did not answer',
        stopFailed: 'Could not stop sub-agent',
        info: {
            label: 'About this sub-agent',
            tokens: '{{tokens}} tokens'
        }
    },
    modes: {
        supervised: {
            label: 'Supervised',
            hint: 'Asks before commands and file changes',
            short: 'Ask'
        },
        'auto-accept-edits': {
            label: 'Auto-accept edits',
            hint: 'File edits go through, commands still ask',
            short: 'Edits'
        },
        auto: {
            label: 'Auto',
            hint: 'Reviews routine actions itself',
            short: 'Auto'
        },
        'full-access': {
            label: 'Full access',
            hint: 'Never asks for approval',
            short: 'Full access'
        }
    },
    pickers: {
        settings: {
            title: 'Model and permissions'
        },
        model: {
            choose: 'Choose model',
            search: 'Search models',
            noProvider: 'No chat provider installed',
            noMatch: 'No models match',
            allGroup_one: 'Models ({{count}})',
            allGroup_other: 'Models ({{count}})',
            legacyGroup_one: 'Legacy models ({{count}})',
            legacyGroup_other: 'Legacy models ({{count}})',
            legacy: 'Legacy',
            tools: 'Can use tools',
            requires: 'Requires {{cli}} {{version}} or later on {{machine}}',
            requiresHere: 'Requires {{cli}} {{version}} or later',
            providerSettings: 'Provider settings',
            star: 'Add to favorites',
            unstar: 'Remove from favorites'
        },
        stash: {
            title: 'Stashed prompts',
            noText: 'No text',
            files_one: '{{count}} file, not kept',
            files_other: '{{count}} files, not kept',
            chats_one: '{{count}} chat attached',
            chats_other: '{{count}} chats attached'
        },
        mode: {
            label: 'Permissions',
            effective: 'Running with {{effective}}. Selected: {{requested}}.'
        },
        account: {
            label: 'Account',
            manage: 'Manage accounts…',
            resets: 'resets {{time}}',
            forkToSwitch: '{{account}} cannot open this conversation. Fork the chat to continue on {{account}}.'
        }
    },
    scrubber: {
        strip: 'Messages',
        tasks: 'Tasks'
    },
    bookmarks: {
        menu: 'Bookmarks',
        add: 'Bookmark message',
        rename: 'Rename bookmark',
        remove: 'Remove bookmark',
        unnamed: 'Bookmark',
        nameLabel: 'Bookmark name',
        namePlaceholder: 'Optional',
        removed: 'Bookmark removed',
        addFailed: 'Could not add bookmark',
        renameFailed: 'Could not rename bookmark',
        removeFailed: 'Could not remove bookmark'
    },
    visuals: {
        actions: 'Actions for {{title}}',
        expand: 'Open large',
        more: 'More actions',
        remove: 'Remove visual',
        removeTitle: 'Remove visual?',
        removeDescription: '{{title}} is deleted from the chat. This cannot be undone.',
        removeFailed: 'Could not remove visual',
        loading: 'Loading {{title}}',
        failed: 'Could not load {{title}}',
        renderFailed: 'Could not show this visual'
    },
    image: {
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        reset: 'Reset',
        previous: 'Previous image',
        next: 'Next image',
        position: '{{index}} of {{count}}'
    },
    generatedImage: {
        label: 'Generated image',
        generating: 'Generating image',
        failed: 'Could not generate image',
        empty: 'Image is empty',
        notImage: 'Not an image',
        tooLarge: 'Larger than {{size}}',
        dimensions: '{{width}} × {{height}}',
        transparent: 'transparent',
        actions: 'Image actions',
        more: 'More actions',
        copyPrompt: 'Copy prompt',
        open: 'Open',
        openLarge: 'Open large',
        save: 'Save to project…',
        saved: 'Saved',
        savedTo: 'Saved to <file>{{path}}</file>',
        renderFailed: 'Could not show this image'
    },
    account: {
        pill: '{{provider}} account {{account}}'
    },
    common: {
        action: {
            close: 'Close',
            copy: 'Copy',
            delete: 'Delete',
            dismiss: 'Dismiss',
            edit: 'Edit',
            remove: 'Remove',
            selectAll: 'Select all',
            undo: 'Undo'
        },
        status: {
            running: 'running',
            paused: 'paused',
            done: 'done',
            failed: 'failed',
            cancelled: 'cancelled'
        }
    },
    code: {
        actions: 'Code actions',
        copyFailed: 'Could not copy code.',
        mermaid: {
            diagram: 'Diagram',
            showSource: 'Show source',
            showDiagram: 'Show diagram',
            failed: 'Could not show diagram. Showing its source.',
            crashed: 'Could not show this diagram'
        }
    },
    blocks: {
        label: 'Interactive block',
        progress: {
            label: 'Progress',
            of: '{{value}} of {{max}}'
        },
        step: {
            done: 'Done',
            running: 'Running',
            pending: 'Waiting',
            failed: 'Failed',
            skipped: 'Skipped'
        },
        event: {
            tone: {
                neutral: 'Neutral',
                info: 'Info',
                success: 'Success',
                warning: 'Warning',
                danger: 'Danger'
            }
        },
        stat: {
            change: '{{change}} from {{previous}}',
            from: 'from {{previous}}'
        },
        table: {
            label: 'Table of {{columns}}',
            showAll: 'Show all {{total}} rows'
        },
        chart: {
            values: 'Values',
            summary: '{{count}} values, highest {{label}} at {{value}}',
            summarySeries: '{{count}} categories, highest {{series}} for {{label}} at {{value}}',
            rowsLeftOut: 'Showing {{shown}} of {{total}} rows.',
            seriesLeftOut_one: '{{series}} not shown.',
            seriesLeftOut_other: '{{series}} not shown.',
            sideBySide: 'Negative values cannot stack. Series shown side by side.',
            showValues: 'Show all values',
            hideValues: 'Hide values'
        },
        gallery: {
            label_one: '{{count}} image',
            label_other: '{{count}} images'
        },
        map: {
            label_one: 'Map of {{count}} place',
            label_other: 'Map of {{count}} places',
            omitted_one: '{{count}} more place not shown',
            omitted_other: '{{count}} more places not shown',
            show: 'Show map',
            waiting: 'Waiting to draw the map. Only a few maps show at once.',
            contextLost: 'Could not show the map. The places stay listed.',
            lookingUp: 'Looking up',
            notFound: 'Not on the map',
            zoomIn: 'Zoom in',
            zoomOut: 'Zoom out',
            showAll: 'Show all places',
            scrollHint: 'Hold ⌘ or Ctrl and scroll to zoom',
            touchHint: 'Use two fingers to move the map',
            offline: 'No map tiles offline. The places stay listed.',
            disabled: 'Map tiles are off.',
            signedOut: 'Sign in to show map tiles.',
            unavailable: 'Map tiles unavailable.'
        },
        compare: {
            label: 'Compare {{before}} and {{after}}',
            before: 'Before',
            after: 'After',
            missing: 'One image missing'
        },
        image: {
            label: 'Image',
            unavailable: 'Image unavailable'
        },
        model: {
            label: '3D model',
            unavailable: 'Model unavailable',
            crashed: 'Could not show this model'
        },
        sources: 'Sources',
        citation: 'Source {{number}}: {{title}}',
        outsideProject: 'Outside the project, shown as text',
        textField: {
            count: '{{used}} of {{max}} characters'
        },
        options: 'Options',
        choices: 'Choices',
        checklist: 'Checklist',
        choice: {
            waiting: 'Available when the reply is done',
            reading: 'Available once the live data is read',
            unavailable: 'Not available',
            sent: 'Sent',
            queued: 'Queued',
            failed: 'Could not send. Try again.',
            ready: 'Choices are ready'
        },
        answered: 'Answered with “{{label}}”',
        chose: 'Chose “{{label}}”',
        choseOlder: 'Chose “{{label}}” on the reply of {{time}}',
        notes_one: '{{count}} note',
        notes_other: '{{count}} notes',
        shownAsText: 'Shown as text',
        unknownComponent: 'This version cannot draw {{component}}',
        renderFailed: 'Could not show this part',
        unreadable: 'Could not read block',
        live: {
            label: 'Live',
            read: 'read {{time}}',
            sources: 'Reads {{sources}}',
            failed: 'Could not read {{source}}',
            refused: 'Not allowed to read {{source}}',
            notRead: 'Not read',
            reasons: {
                'access-unavailable': 'The chat that made this no longer has access.',
                'block-stale': 'This block changed since it was drawn.',
                busy: 'Too many live blocks reading.',
                'link-unchecked': 'This link has to be checked again.',
                'link-unsupported': 'The machine cannot open this link.',
                'links-unsupported': 'The machine does not open links from blocks.',
                'no-unique-match': 'No single match for that name.',
                'outside-project': "Outside the agent's project.",
                'query-undeclared': 'This block does not read that source.',
                'refresh-limit': 'This source reads at most once every ten seconds.',
                'result-too-large': 'Result too large.',
                'snapshot-too-large': 'The first readings were too large to keep.',
                'source-unregistered': 'The machine does not know this source.',
                'stale-read': 'Read the source again before you choose.',
                'target-unavailable': 'Target no longer available.',
                'timed-out': 'Source timed out.',
                unreadable: 'Could not read the source.'
            }
        }
    },
    modelOptions: {
        effort: {
            label: 'Reasoning',
            choices: {
                low: 'Low',
                medium: 'Medium',
                high: 'High',
                xhigh: 'Extra high',
                max: 'Max'
            }
        },
        contextWindow: { label: 'Context window' },
        fastMode: { label: 'Fast mode' },
        thinking: { label: 'Thinking' },
        serviceTier: { label: 'Priority' }
    },
    readingWidth: {
        label: 'Reading width',
        narrow: {
            label: 'Narrow',
            hint: 'Short, easy lines.'
        },
        comfortable: {
            label: 'Comfortable',
            hint: 'About 90 characters per line.'
        },
        full: {
            label: 'Full',
            hint: 'As wide as the view.'
        }
    },
    sendKey: {
        label: 'Send with',
        enter: {
            label: 'Enter',
            hint: 'Enter sends and Shift+Enter adds a line.'
        },
        'mod-enter-multiline': {
            label: 'Enter, {{mod}}+Enter for more lines',
            hint: 'Enter sends one line. With more lines, Enter adds a line and {{mod}}+Enter sends.'
        },
        'mod-enter': {
            label: '{{mod}}+Enter',
            hint: 'Enter adds a line and {{mod}}+Enter sends.'
        }
    }
};
