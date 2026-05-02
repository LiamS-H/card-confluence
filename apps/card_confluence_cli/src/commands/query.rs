use anyhow::Result;
use card_confluence_db::{
    autocompletion::autocomplete,
    query_executor::context::{get_context, get_latest_paths},
    query_parser::parse_query,
};
use datafusion::{
    arrow::util::pretty::pretty_format_batches, logical_expr::col, prelude::SessionContext,
};
use object_store::ObjectStore;
use rustyline::completion::{Completer, Pair};
use rustyline::config::Configurer;
use rustyline::error::ReadlineError;
use rustyline::highlight::Highlighter;
use rustyline::hint::Hinter;
use rustyline::validate::Validator;
use rustyline::{Editor, Helper};

use std::io::Write;
use std::{fs::File, sync::Arc};
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

        let Some(completion) = suggestions else {
            println!("No Completions!");
            return Ok((pos, vec![]));
        };
        let matches: Vec<&String> = completion
            .strings
            .iter()
            .filter(|s| {
                s.to_lowercase()
                    .starts_with(&line[completion.start..completion.end].to_lowercase())
            })
            .collect();

        let pairs = matches
            .into_iter()
            .map(|s| Pair {
                display: s.clone(),
                replacement: s.clone(),
            })
            .collect();
        Ok((completion.start, pairs))
    }
}

impl Hinter for QueryHelper {
    type Hint = String;
}

impl Highlighter for QueryHelper {}

impl Validator for QueryHelper {}

pub async fn exec(parquet_store: Arc<dyn ObjectStore>, text: String) -> Result<()> {
    let paths = get_latest_paths(parquet_store.clone()).await?;
    let ctx = get_context(parquet_store, paths).await?;
    let plan = parse_query(&ctx, &text).await?;
    let df = ctx.execute_logical_plan(plan).await?;
    // let df = df.select(vec![col("name"), col("colors"), col("mana_cost")])?;
    println!("Found: {} results", df.clone().count().await?);
    df.collect().await?;
    Ok(())
}

pub async fn rustyline_exec(parquet_store: Arc<dyn ObjectStore>) -> Result<()> {
    let paths = get_latest_paths(parquet_store.clone()).await?;
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
                let plan = match parse_query(&ctx, &line).await {
                    Ok(plan) => plan,
                    Err(e) => {
                        eprintln!("Parse error: {:?}", e);
                        continue;
                    }
                };
                let df = match ctx.execute_logical_plan(plan).await {
                    Ok(df) => df,
                    Err(e) => {
                        eprintln!("Execution error: {:?}", e);
                        continue;
                    }
                };
                let df = df.select(vec![col("name"), col("mana_cost")])?;
                let explain_df = df.clone().explain(false, true)?;
                let explain_batches = explain_df.collect().await?;
                let formatted_string = pretty_format_batches(&explain_batches).unwrap();

                let mut file = File::create("explain_query_plan.txt").unwrap();
                write!(file, "{}", formatted_string).unwrap();
                if let Err(e) = df.show().await {
                    eprintln!("Error showing results: {:?}", e);
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
