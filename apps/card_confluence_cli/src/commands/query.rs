use anyhow::{anyhow, Result};
use card_confluence_db::{
    autocompletion::autocomplete,
    query_executor::context::{get_context, TablePaths},
    query_parser::parse_query,
    utils::get_latest,
};
use datafusion::prelude::{col, SessionContext};
use object_store::{path::Path as ObjectPath, ObjectStore};
use rustyline::completion::{Completer, Pair};
use rustyline::config::Configurer;
use rustyline::error::ReadlineError;
use rustyline::highlight::Highlighter;
use rustyline::hint::Hinter;
use rustyline::validate::Validator;
use rustyline::{Editor, Helper};
use std::sync::Arc;
use tokio::runtime::Handle;

struct QueryHelper {
    ctx: SessionContext,
    handle: Handle,
}

impl Helper for QueryHelper {}

impl Completer for QueryHelper {
    type Candidate = Pair;

    fn complete(
        &self,
        line: &str,
        pos: usize,
        _ctx: &rustyline::Context<'_>,
    ) -> rustyline::Result<(usize, Vec<Pair>)> {
        let suggestions = tokio::task::block_in_place(|| {
            self.handle
                .block_on(async { autocomplete(&self.ctx, line, pos).await })
        });

        if let Some(completion) = suggestions {
            let pairs = completion
                .strings
                .into_iter()
                .map(|s| Pair {
                    display: s.clone(),
                    replacement: s,
                })
                .collect();
            Ok((completion.start, pairs))
        } else {
            Ok((pos, vec![]))
        }
    }
}

impl Hinter for QueryHelper {
    type Hint = String;
}

impl Highlighter for QueryHelper {}

impl Validator for QueryHelper {}

pub async fn exec(parquet_store: Arc<dyn ObjectStore>) -> Result<()> {
    let latest_cards = get_latest(&parquet_store, &ObjectPath::from("cards"), "parquet")
        .await
        .ok_or_else(|| anyhow!("No card parquet files found. Run seed first."))?;
    let latest_rulings = get_latest(&parquet_store, &ObjectPath::from("rulings"), "parquet")
        .await
        .ok_or_else(|| anyhow!("No ruling parquet files found. Run seed first."))?;
    let latest_sets = get_latest(&parquet_store, &ObjectPath::from("sets"), "parquet")
        .await
        .ok_or_else(|| anyhow!("No set parquet files found. Run seed first."))?;

    let paths = TablePaths {
        cards: format!("db://data/{}", latest_cards),
        rulings: format!("db://data/{}", latest_rulings),
        sets: format!("db://data/{}", latest_sets),
    };

    let ctx = get_context(parquet_store, paths).await?;
    let handle = Handle::current();

    let h = QueryHelper {
        ctx: ctx.clone(),
        handle,
    };

    let mut rl = Editor::new()?;
    rl.set_helper(Some(h));
    rl.set_completion_type(rustyline::CompletionType::Circular);

    let history_path = ".query_history";
    if rl.load_history(history_path).is_err() {
        println!("No previous history.");
    }

    println!("Card Confluence Query TUI");
    println!("Type your query and press Enter. Press Ctrl-C or Ctrl-D to exit.");

    loop {
        let readline = rl.readline(">> ");
        match readline {
            Ok(line) => {
                if line.trim().is_empty() {
                    continue;
                }
                rl.add_history_entry(line.as_str())?;
                rl.save_history(history_path)?;
                match parse_query(&ctx, &line).await {
                    Ok(plan) => match ctx.execute_logical_plan(plan).await {
                        Ok(df) => {
                            let df =
                                df.select(vec![col("name"), col("colors"), col("mana_cost")])?;
                            if let Err(e) = df.show().await {
                                eprintln!("Error showing results: {:?}", e);
                            }
                        }
                        Err(e) => eprintln!("Execution error: {:?}", e),
                    },
                    Err(e) => eprintln!("Parse error: {:?}", e),
                }
            }
            Err(ReadlineError::Interrupted) => {
                println!("Interrupted");
                break;
            }
            Err(ReadlineError::Eof) => {
                println!("EOF");
                break;
            }
            Err(err) => {
                println!("Error: {:?}", err);
                break;
            }
        }
    }

    Ok(())
}
