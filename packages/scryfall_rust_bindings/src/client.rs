use reqwest::{
    Client,
    header::{ACCEPT, HeaderMap, HeaderValue, USER_AGENT},
};
use std::sync::OnceLock;

static CLIENT: OnceLock<Client> = OnceLock::new();

pub fn get_client() -> &'static Client {
    CLIENT.get_or_init(|| {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("card-confluence/0.0"));
        headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
        Client::builder().default_headers(headers).build().unwrap()
    })
}
