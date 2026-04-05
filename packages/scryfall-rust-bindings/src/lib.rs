use regex::Regex;
use serde::{Deserialize, Serialize};
use url::Url;

use crate::{
    client::get_client,
    types::{
        bulk::ScryfallBulkData, card::ScryfallCardList, error::ScryfallError,
        migration::ScryfallMigrationList, set::ScryfallSetList,
    },
};

pub mod client;
pub mod types;

#[derive(Debug, Serialize, Clone, Deserialize, Default)]
pub struct ScryfallSearchSettings {
    pub unique: Option<String>,
    pub order: Option<String>,
    pub dir: Option<String>,
    pub include_extras: Option<bool>,
    pub include_multilingual: Option<bool>,
    pub include_variations: Option<bool>,
    pub page: Option<u32>,
    pub format: Option<String>,
    pub pretty: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagResult {
    pub otags: Vec<String>,
    pub atags: Vec<String>,
}

pub async fn fetch_bulk(endpoint: &str) -> Result<ScryfallBulkData, Box<dyn std::error::Error>> {
    let url = format!("https://api.scryfall.com/bulk-data/{}", endpoint);

    let response = get_client().get(url).send().await?;
    let data = response.json::<ScryfallBulkData>().await?;
    Ok(data)
}

pub async fn fetch_migrations(
    page: Option<u32>,
    fixed_url: Option<&str>,
) -> Result<ScryfallMigrationList, Box<dyn std::error::Error>> {
    if fixed_url.is_some() && page.is_some() {
        return Err("overwriting page with fixed url.".into());
    }

    let url = if let Some(url) = fixed_url {
        url.to_string()
    } else {
        format!("https://api.scryfall.com/migrations/{}", page.unwrap_or(1))
    };

    let response = get_client().get(url).send().await?;
    let data = response.json::<ScryfallMigrationList>().await?;
    Ok(data)
}

pub async fn fetch_sets() -> Result<ScryfallSetList, Box<dyn std::error::Error>> {
    let url = Url::parse("https://api.scryfall.com/sets")?;

    let response = get_client().get(url).send().await?;
    let data = response.json::<ScryfallSetList>().await?;
    Ok(data)
}

pub enum ScryfallSearchResponse {
    List(ScryfallCardList),
    Error(ScryfallError),
}

pub async fn fetch_search(
    query: &str,
    settings: Option<ScryfallSearchSettings>,
) -> Result<ScryfallSearchResponse, Box<dyn std::error::Error>> {
    let mut url = Url::parse("https://api.scryfall.com/cards/search")?;
    {
        let mut query_params = url.query_pairs_mut();
        query_params.append_pair("q", query);

        if let Some(settings) = settings {
            if let Some(unique) = settings.unique {
                query_params.append_pair("unique", &unique);
            }
            if let Some(order) = settings.order {
                query_params.append_pair("order", &order);
            }
            if let Some(dir) = settings.dir {
                query_params.append_pair("dir", &dir);
            }
            if let Some(include_extras) = settings.include_extras {
                query_params.append_pair("include_extras", &include_extras.to_string());
            }
            if let Some(include_multilingual) = settings.include_multilingual {
                query_params.append_pair("include_multilingual", &include_multilingual.to_string());
            }
            if let Some(include_variations) = settings.include_variations {
                query_params.append_pair("include_variations", &include_variations.to_string());
            }
            if let Some(page) = settings.page {
                query_params.append_pair("page", &page.to_string());
            }
            if let Some(format) = settings.format {
                query_params.append_pair("format", &format);
            }
            if let Some(pretty) = settings.pretty {
                query_params.append_pair("pretty", &pretty.to_string());
            }
        }
    }

    let response = get_client().get(url).send().await?;
    let raw_text = response.text().await?;
    if let Ok(error) = serde_json::from_str::<ScryfallError>(&raw_text) {
        return Ok(ScryfallSearchResponse::Error(error));
    };

    match serde_json::from_str::<ScryfallCardList>(&raw_text) {
        Ok(list) => Ok(ScryfallSearchResponse::List(list)),
        Err(e) => Err(Box::new(e)),
    }
}

pub async fn fetch_all_tags() -> Result<TagResult, Box<dyn std::error::Error>> {
    let mut otags = Vec::new();
    let mut atags = Vec::new();

    let response = get_client()
        .get("https://scryfall.com/docs/tagger-tags")
        .send()
        .await?;
    let text = response.text().await?;

    let section_regex = Regex::new(r"(?s)<h2[^>]*>(.*?)</h2>\s*<p[^>]*>(.*?)</p>").unwrap();
    let link_regex = Regex::new(r"<a[^>]*>(.*?)</a>").unwrap();

    for section in section_regex.captures_iter(&text) {
        let header = section.get(1).map_or("", |m| m.as_str());
        let p_content = section.get(2).map_or("", |m| m.as_str());

        let mut tags = Vec::new();
        for link_cap in link_regex.captures_iter(p_content) {
            if let Some(tag) = link_cap.get(1) {
                tags.push(tag.as_str().trim().to_string());
            }
        }

        if header.ends_with("(functional)") {
            otags.extend(tags);
        } else {
            atags.extend(tags);
        }
    }

    Ok(TagResult { otags, atags })
}
