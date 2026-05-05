use serde::{Deserialize, Serialize};
use tsify::Tsify;

use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
#[derive(
    Debug,
    Clone,
    Serialize,
    Deserialize,
    Default,
    Tsify,
    ArrowField,
    ArrowSerialize,
    ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct CompletionOption {
    pub label: String,
    pub info: Option<String>,
    pub detail: Option<String>,
    pub group: Option<String>,
}
impl From<String> for CompletionOption {
    fn from(label: String) -> Self {
        Self {
            label,
            ..Default::default()
        }
    }
}
impl From<&str> for CompletionOption {
    fn from(label: &str) -> Self {
        Self {
            label: label.into(),
            ..Default::default()
        }
    }
}
impl From<CompletionOption> for String {
    fn from(completion: CompletionOption) -> String {
        completion.label
    }
}
