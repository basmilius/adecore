# Error codes

A refusal carries a code. Branch on the code and show the message.

| Code                                                     |                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `bad-request`, `unknown-request`                         | The frame, the name or the payload does not fit the protocol.                    |
| `chat-not-found`                                         | Create or load the chat first.                                                    |
| `chat-unreadable`                                        | Its record is from a version this one cannot read. It is left on disk.           |
| `chat-busy`                                              | A turn runs; wait, or ask for `force`.                                            |
| `request-not-found`                                      | The approval, question or queued message is no longer there: read the state again. |
| `history-expired`                                        | The cursor is gone; attach again.                                                 |
| `chat-unsupported`                                       | This host or this CLI does not do that.                                           |
| `project-config-unsupported`                             | `projectConfigFor` turned the folder's configuration off and this CLI cannot ignore it; the turn does not start. |
| `invalid-attachments`                                    | An attachment the host could not take.                                            |
| `account-unavailable`, `account-incompatible`, `invalid-account` | The account is not there, cannot take the chat over, or is not valid.     |
| `secrets-unavailable`                                    | No keychain on this machine.                                                      |
| `internal`                                               | Something else failed; the host logged it.                                        |

Others name what was not found (`subagent-not-found`, `task-not-found`, `turn-not-found`, `item-not-found`, `bookmark-not-found`), `too-many-bookmarks`, a visual that breaks a limit (`visual-invalid`, `visual-too-large`), and a CLI transcript that is missing or not readable (`transcript-missing`, `transcript-format`). [Tools](/agents/tools#refusals) refuse in their own format.
