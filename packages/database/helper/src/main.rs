use std::sync::Arc;
use std::time::Duration;

use adecore_database_helper::dispatcher::Dispatcher;
use adecore_database_helper::protocol::ready_line;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;
use tokio::task::JoinSet;

/// How long requests still in flight get to answer once the input has ended.
const GRACE: Duration = Duration::from_secs(2);

#[tokio::main]
async fn main() {
    let (output, mut lines) = mpsc::unbounded_channel::<String>();

    let writer = tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();

        while let Some(mut line) = lines.recv().await {
            line.push('\n');

            if stdout.write_all(line.as_bytes()).await.is_err() || stdout.flush().await.is_err() {
                return;
            }
        }
    });

    let _ = output.send(ready_line(env!("CARGO_PKG_VERSION")));

    let dispatcher = Arc::new(Dispatcher::new());
    let mut in_flight = JoinSet::new();
    let mut input = BufReader::new(tokio::io::stdin()).lines();

    loop {
        match input.next_line().await {
            Ok(Some(line)) => {
                if line.trim().is_empty() {
                    continue;
                }

                let answer = dispatcher.submit(&line);
                let output = output.clone();

                in_flight.spawn(async move {
                    let _ = output.send(answer.await);
                });

                while in_flight.try_join_next().is_some() {}
            }
            Ok(None) => break,
            Err(e) => {
                eprintln!("adecore-database: could not read stdin: {e}");
                break;
            }
        }
    }

    let _ = tokio::time::timeout(GRACE, async { while in_flight.join_next().await.is_some() {} }).await;
    dispatcher.shutdown().await;
    in_flight.abort_all();

    drop(output);
    let _ = tokio::time::timeout(GRACE, writer).await;
}
