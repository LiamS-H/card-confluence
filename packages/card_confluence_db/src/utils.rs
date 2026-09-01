pub fn is_subsequence<A: AsRef<str>, B: AsRef<str>>(search: &A, target: &B) -> bool {
    let mut target_iter = target.as_ref().chars();

    search.as_ref().chars().all(|s_char| {
        target_iter
            .find(|t_char| t_char.to_ascii_lowercase() == s_char.to_ascii_lowercase())
            .is_some()
    })
}
